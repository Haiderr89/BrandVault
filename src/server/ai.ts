import { readFile } from "node:fs/promises";
import path from "node:path";
import Anthropic, { AnthropicError } from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { env } from "@/lib/env";
import { HttpError } from "@/lib/http";
import { aiSuggestionSchema, type AiSuggestion } from "@/lib/validation";
import { getAsset } from "./assets";
import { getBrand } from "./brand";

// Shape Claude is constrained to via structured outputs. Length and count
// limits are then enforced by `aiSuggestionSchema` before anything is returned.
const wireSchema = z.object({
  tags: z.array(z.string()),
  description: z.string(),
  usage_suggestion: z.string(),
});

let client: Anthropic | undefined;
let systemPrompt: string | undefined;

function getClient() {
  if (!env.ANTHROPIC_API_KEY) {
    throw new HttpError(503, "ai_not_configured", "AI tagging is not configured on this server.");
  }
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 45_000, maxRetries: 1 });
  return client;
}

async function getSystemPrompt() {
  systemPrompt ??= await readFile(path.join(process.cwd(), "prompts", "asset-tagging.md"), "utf8");
  return systemPrompt;
}

const aiFailed = (message: string) => new HttpError(502, "ai_failed", message);

/**
 * Ask Claude for tags / description / usage for one asset. Nothing is saved
 * here: the suggestion goes back to the user for review first.
 */
export async function suggestAssetTags(workspaceId: string, assetId: string): Promise<AiSuggestion> {
  const [asset, brand] = await Promise.all([getAsset(workspaceId, assetId), getBrand(workspaceId)]);
  const anthropic = getClient();

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

  let response;
  try {
    response = await anthropic.messages.parse({
      model: env.ANTHROPIC_MODEL,
      max_tokens: 4096,
      system: await getSystemPrompt(),
      output_config: { effort: "low", format: zodOutputFormat(wireSchema) },
      messages: [
        {
          role: "user",
          content: `<asset_context>\n${JSON.stringify(context, null, 2)}\n</asset_context>\n\nSuggest tags, a description and a usage suggestion for this asset.`,
        },
      ],
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      throw new HttpError(503, "ai_busy", "The AI service is busy. Try again in a moment.");
    }
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

  const result = aiSuggestionSchema.safeParse(response.parsed_output);
  if (!result.success) {
    console.error("AI output failed validation", result.error.issues);
    throw aiFailed("The AI returned an invalid suggestion. Try again.");
  }
  return result.data;
}
