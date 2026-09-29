import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const parse = vi.fn();
vi.mock("@anthropic-ai/sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@anthropic-ai/sdk")>();
  class FakeAnthropic {
    messages = { parse };
  }
  Object.assign(FakeAnthropic, actual.default);
  return { ...actual, default: FakeAnthropic };
});

process.env.ANTHROPIC_API_KEY = "test-key";

const { POST: suggest } = await import("@/app/api/assets/[id]/ai-tags/route");
const { PATCH: save } = await import("@/app/api/assets/[id]/ai-tags/save/route");
const assetsRoute = await import("@/app/api/assets/route");
const signup = await import("@/app/api/auth/signup/route");
const { call, sessionCookie } = await import("./helpers");

let cookie: string;
let assetId: string;

beforeAll(async () => {
  const r = await call(signup.POST, { method: "POST", body: { email: "ai@example.com", password: "Password1!" } });
  cookie = sessionCookie(r.res);
  const a = await call(assetsRoute.POST, {
    method: "POST",
    cookie,
    body: { name: "Summer sale banner", type: "image", url: "https://cdn.example.com/summer.png" },
  });
  assetId = a.body.asset.id;
});

beforeEach(() => parse.mockReset());

describe("AI tagging", () => {
  it("returns a validated, normalised suggestion without saving it", async () => {
    parse.mockResolvedValue({
      stop_reason: "end_turn",
      parsed_output: { tags: ["Sale", "summer", "sale", "banner"], description: " Banner. ", usage_suggestion: "Web hero." },
    });
    const r = await call(suggest, { method: "POST", cookie, params: { id: assetId } });
    expect(r.status).toBe(200);
    expect(r.body.suggestion).toEqual({ tags: ["sale", "summer", "banner"], description: "Banner.", usage_suggestion: "Web hero." });

    // The request carried the asset context, and nothing was saved yet.
    expect(parse.mock.calls[0][0].messages[0].content).toContain("Summer sale banner");
    const list = await call(assetsRoute.GET, { cookie, path: "/api/assets" });
    expect(list.body.assets[0].tags).toEqual([]);
  });

  it("rejects model output that fails validation with 502", async () => {
    parse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: { tags: [], description: "", usage_suggestion: "x" } });
    const r = await call(suggest, { method: "POST", cookie, params: { id: assetId } });
    expect(r.status).toBe(502);
    expect(r.body.error.code).toBe("ai_failed");
  });

  it("handles refusals / truncation with 502", async () => {
    parse.mockResolvedValue({ stop_reason: "max_tokens", parsed_output: null });
    expect((await call(suggest, { method: "POST", cookie, params: { id: assetId } })).status).toBe(502);
  });

  it("saves a reviewed suggestion, validating the body", async () => {
    const bad = await call(save, { method: "PATCH", cookie, params: { id: assetId }, body: { tags: "nope" } });
    expect(bad.status).toBe(400);

    const ok = await call(save, {
      method: "PATCH",
      cookie,
      params: { id: assetId },
      body: { tags: ["summer", "sale"], description: "Summer sale banner.", usage_suggestion: "Homepage hero." },
    });
    expect(ok.status).toBe(200);
    expect(ok.body.asset.tags).toEqual(["summer", "sale"]);
    expect(ok.body.asset.usageSuggestion).toBe("Homepage hero.");
  });
});
