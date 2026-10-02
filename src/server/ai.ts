import { readFile } from "node:fs/promises";
import path from "node:path";
import Anthropic, { AnthropicError } from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ApiError as GeminiApiError, GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { env } from "@/lib/env";
import { HttpError } from "@/lib/http";
import { aiSuggestionSchema, type AiSuggestion } from "@/lib/validation";
import { getAsset } from "./assets";
import { getBrand } from "./brand";

// Shape the model is constrained to (structured output on both providers).
// Length and count limits are then enforced by `aiSuggestionSchema` before
// anything is returned, whichever provider produced it.
const wireSchema = z.object({
  tags: z.array(z.string()),
  description: z.string(),
  usage_suggestion: z.string(),
});

const aiFailed = (message: string) => new HttpError(502, "ai_failed", message);
const aiBusy = () => new HttpError(503, "ai_busy", "The AI service is busy. Try again in a moment.");

let systemPrompt: string | undefined;
async function getSystemPrompt() {
  systemPrompt ??= await readFile(path.join(process.cwd(), "prompts", "asset-tagging.md"), "utf8");
  return systemPrompt;
}

/** Each provider returns the raw (unvalidated) object it produced. */
type Provider = (system: string, userMessage: string) => Promise<unknown>;

// ---------- Gemini ----------
let gemini: GoogleGenAI | undefined;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Overloaded / rate-limited / transient: worth retrying (common on the free tier).
const isTransient = (status: number) => status === 429 || status === 500 || status === 503;

const geminiProvider: Provider = async (system, userMessage) => {
  gemini ??= new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  // Two tries on the main model, then one on the lighter fallback model.
  const attempts = [env.GEMINI_MODEL, env.GEMINI_MODEL, env.GEMINI_FALLBACK_MODEL];
  let lastStatus = 0;
  let text: string | undefined;

  for (const [i, model] of attempts.entries()) {
    try {
      const response = await gemini.models.generateContent({
        model,
        contents: userMessage,
        config: {
          systemInstruction: system,
          responseMimeType: "application/json",
          responseJsonSchema: z.toJSONSchema(wireSchema),
          abortSignal: AbortSignal.timeout(20_000),
        },
      });
      text = response.text;
      break;
    } catch (err) {
      if (!(err instanceof GeminiApiError)) throw err;
      lastStatus = err.status;
      console.error(`Gemini API error (attempt ${i + 1}, ${model})`, err.status, err.message);
      if (!isTransient(err.status)) throw aiFailed("The AI service returned an error. Try again.");
      if (i < attempts.length - 1) await sleep(800 * (i + 1));
    }
  }

  if (text === undefined) {
    throw lastStatus ? aiBusy() : aiFailed("The AI could not produce a suggestion for this asset.");
  }
  try {
    return JSON.parse(text);
  } catch {
    console.error("Unparseable AI output", text.slice(0, 200));
    throw aiFailed("The AI returned an invalid response. Try again.");
  }
};

// ---------- Anthropic Claude ----------
let anthropic: Anthropic | undefined;
const anthropicProvider: Provider = async (system, userMessage) => {
  anthropic ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 45_000, maxRetries: 1 });
  let response;
  try {
    response = await anthropic.messages.parse({
      model: env.ANTHROPIC_MODEL,
      max_tokens: 4096,
      system,
      output_config: { effort: "low", format: zodOutputFormat(wireSchema) },
      messages: [{ role: "user", content: userMessage }],
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) throw aiBusy();
    if (err instanceof Anthropic.APIError) {
      console.error("Anthropic API error", err.status, err.message);
      throw aiFailed("The AI service returned an error. Try again.");
    }
    // Raised by the SDK when the output isn't valid JSON for the schema.
    if (err instanceof AnthropicError) {
      console.error("Unparseable AI output", err.message);
      throw aiFailed("The AI returned an invalid response. Try again.");
    }
    throw err;
  }
  if (response.stop_reason !== "end_turn" || !response.parsed_output) {
    console.error("AI did not complete", response.stop_reason);
    throw aiFailed("The AI could not produce a suggestion for this asset.");
  }
  return response.parsed_output;
};

/** Gemini when GEMINI_API_KEY is set, otherwise Claude; 503 if neither is configured. */
function pickProvider(): Provider {
  if (env.GEMINI_API_KEY) return geminiProvider;
  if (env.ANTHROPIC_API_KEY) return anthropicProvider;
  throw new HttpError(503, "ai_not_configured", "AI tagging is not configured on this server.");
}

/**
 * Ask the configured model for tags / description / usage for one asset.
 * Nothing is saved here: the suggestion goes back to the user for review first.
 */
export async function suggestAssetTags(workspaceId: string, assetId: string): Promise<AiSuggestion> {
  const [asset, brand] = await Promise.all([getAsset(workspaceId, assetId), getBrand(workspaceId)]);
  const provider = pickProvider();

  const context = {
    asset: { name: asset.name, type: asset.type, url: asset.url, folder: asset.folderName ?? null },
    brand: brand
      ? {
          name: brand.name,
          primary_color: brand.primaryColor,
          secondary_color: brand.secondaryColor,
          font: brand.fontName,
        }
      : null,
  };
  const userMessage = `<asset_context>\n${JSON.stringify(context, null, 2)}\n</asset_context>\n\nSuggest tags, a description and a usage suggestion for this asset.`;

  const raw = await provider(await getSystemPrompt(), userMessage);

  const result = aiSuggestionSchema.safeParse(raw);
  if (!result.success) {
    console.error("AI output failed validation", result.error.issues);
    throw aiFailed("The AI returned an invalid suggestion. Try again.");
  }
  return result.data;
}
