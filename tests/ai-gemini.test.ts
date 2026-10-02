import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const generateContent = vi.fn();
vi.mock("@google/genai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@google/genai")>();
  class FakeGoogleGenAI {
    models = { generateContent };
  }
  return { ...actual, GoogleGenAI: FakeGoogleGenAI };
});
const anthropicParse = vi.fn();
vi.mock("@anthropic-ai/sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@anthropic-ai/sdk")>();
  class FakeAnthropic {
    messages = { parse: anthropicParse };
  }
  Object.assign(FakeAnthropic, actual.default);
  return { ...actual, default: FakeAnthropic };
});

// Both keys set: Gemini should win.
process.env.GEMINI_API_KEY = "test-gemini-key";
process.env.ANTHROPIC_API_KEY = "test-anthropic-key";

const { ApiError } = await import("@google/genai");
const { POST: suggest } = await import("@/app/api/assets/[id]/ai-tags/route");
const assetsRoute = await import("@/app/api/assets/route");
const signup = await import("@/app/api/auth/signup/route");
const { call, sessionCookie } = await import("./helpers");

let cookie: string;
let assetId: string;

beforeAll(async () => {
  const r = await call(signup.POST, {
    method: "POST",
    body: { email: "gemini@example.com", password: "Password1!" },
  });
  cookie = sessionCookie(r.res);
  const a = await call(assetsRoute.POST, {
    method: "POST",
    cookie,
    body: { name: "Spring lookbook", type: "document", url: "https://cdn.example.com/lookbook.pdf" },
  });
  assetId = a.body.asset.id;
});

beforeEach(() => {
  generateContent.mockReset();
  anthropicParse.mockReset();
});

const suggestNow = () => call(suggest, { method: "POST", cookie, params: { id: assetId } });

describe("AI tagging via Gemini", () => {
  it("uses Gemini when its key is set, with JSON schema output, and validates the result", async () => {
    generateContent.mockResolvedValue({
      text: JSON.stringify({
        tags: ["Lookbook", "spring", "lookbook"],
        description: "Spring lookbook PDF.",
        usage_suggestion: "Share with retail partners.",
      }),
    });
    const r = await suggestNow();
    expect(r.status).toBe(200);
    expect(r.body.suggestion.tags).toEqual(["lookbook", "spring"]);
    expect(anthropicParse).not.toHaveBeenCalled();

    const req = generateContent.mock.calls[0][0];
    expect(req.contents).toContain("Spring lookbook");
    expect(req.config.responseMimeType).toBe("application/json");
    expect(req.config.responseJsonSchema).toMatchObject({ type: "object" });
    expect(req.config.systemInstruction).toContain("BrandVault");
  });

  it("returns 502 for non-JSON output", async () => {
    generateContent.mockResolvedValue({ text: "Sure! Here are some tags: logo, brand" });
    expect((await suggestNow()).status).toBe(502);
  });

  it("returns 502 when the JSON fails validation", async () => {
    generateContent.mockResolvedValue({
      text: JSON.stringify({ tags: [], description: "", usage_suggestion: "" }),
    });
    expect((await suggestNow()).status).toBe(502);
  });

  it("retries when the model is overloaded and falls back to the lite model", async () => {
    generateContent
      .mockRejectedValueOnce(new ApiError({ message: "high demand", status: 503 }))
      .mockRejectedValueOnce(new ApiError({ message: "high demand", status: 503 }))
      .mockResolvedValueOnce({
        text: JSON.stringify({ tags: ["lookbook"], description: "Lookbook.", usage_suggestion: "Retail." }),
      });
    const r = await suggestNow();
    expect(r.status).toBe(200);
    expect(generateContent.mock.calls.map((c) => c[0].model)).toEqual([
      "gemini-flash-latest",
      "gemini-flash-latest",
      "gemini-flash-lite-latest",
    ]);
  });

  it("returns 503 ai_busy when every attempt is rate-limited", async () => {
    generateContent.mockRejectedValue(new ApiError({ message: "quota", status: 429 }));
    const r = await suggestNow();
    expect(r.status).toBe(503);
    expect(r.body.error.code).toBe("ai_busy");
    expect(generateContent).toHaveBeenCalledTimes(3);
  });

  it("does not retry non-transient errors (e.g. bad key)", async () => {
    generateContent.mockRejectedValue(new ApiError({ message: "API key not valid", status: 400 }));
    expect((await suggestNow()).status).toBe(502);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });
});
