import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

process.env.N8N_WEBHOOK_URL = "https://n8n.example.com/webhook/brandvault";
process.env.N8N_WEBHOOK_SECRET = "shh";

const realFetch = globalThis.fetch;
const fetchMock = vi.fn(async () => new Response("ok"));

const signup = await import("@/app/api/auth/signup/route");
const brand = await import("@/app/api/brand/route");
const assetsRoute = await import("@/app/api/assets/route");
const trash = await import("@/app/api/assets/[id]/trash/route");
const restore = await import("@/app/api/assets/[id]/restore/route");
const saveTags = await import("@/app/api/assets/[id]/ai-tags/save/route");
const { call, sessionCookie } = await import("./helpers");

let cookie: string;
let assetId: string;

beforeAll(async () => {
  const r = await call(signup.POST, {
    method: "POST",
    body: { email: "hooks@example.com", password: "Password1!" },
  });
  cookie = sessionCookie(r.res);
  await call(brand.POST, {
    method: "POST",
    cookie,
    body: { name: "Hooks", primaryColor: "#000000", secondaryColor: "#FFFFFF" },
  });
  const a = await call(assetsRoute.POST, {
    method: "POST",
    cookie,
    body: { name: "Logo", type: "logo", url: "https://cdn.example.com/logo.png" },
  });
  assetId = a.body.asset.id;
});

beforeEach(() => {
  fetchMock.mockClear();
  globalThis.fetch = fetchMock as typeof fetch;
  return () => {
    globalThis.fetch = realFetch;
  };
});

const sent = async () => {
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  return { url, headers: init.headers as Record<string, string>, body: JSON.parse(init.body as string) };
};

describe("n8n webhooks", () => {
  it("fires brand.updated with brand id, user email and timestamp", async () => {
    await call(brand.PATCH, { method: "PATCH", cookie, body: { name: "Hooks Inc" } });
    const { url, headers, body } = await sent();
    expect(url).toBe("https://n8n.example.com/webhook/brandvault");
    expect(headers["x-brandvault-secret"]).toBe("shh");
    expect(body).toMatchObject({ event: "brand.updated", assetId: null, userEmail: "hooks@example.com" });
    expect(body.brandId).toEqual(expect.any(String));
    expect(new Date(body.timestamp).toString()).not.toBe("Invalid Date");
  });

  it("fires asset.restored on restore (not on trash)", async () => {
    await call(trash.POST, { method: "POST", cookie, params: { id: assetId } });
    expect(fetchMock).not.toHaveBeenCalled();
    await call(restore.POST, { method: "POST", cookie, params: { id: assetId } });
    expect((await sent()).body).toMatchObject({ event: "asset.restored", assetId });
  });

  it("fires asset.ai_tags_saved when a reviewed suggestion is saved", async () => {
    await call(saveTags.PATCH, {
      method: "PATCH",
      cookie,
      params: { id: assetId },
      body: { tags: ["logo"], description: "Main logo.", usage_suggestion: "Website header." },
    });
    expect((await sent()).body).toMatchObject({ event: "asset.ai_tags_saved", assetId });
  });

  it("does not fire when the action fails", async () => {
    await call(restore.POST, { method: "POST", cookie, params: { id: assetId } }); // not in trash -> 409
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a failing webhook never breaks the request", async () => {
    fetchMock.mockRejectedValueOnce(new Error("n8n down"));
    const r = await call(brand.PATCH, { method: "PATCH", cookie, body: { name: "Still works" } });
    expect(r.status).toBe(200);
  });
});

describe("webhook secret hygiene", () => {
  it("never logs the error message (it can contain the secret)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockRejectedValueOnce(
      new TypeError('Headers.append: "shh-secret-value" is an invalid header value'),
    );
    await call(brand.PATCH, { method: "PATCH", cookie, body: { name: "Hygiene" } });
    await vi.waitFor(() => expect(spy).toHaveBeenCalled());
    expect(spy.mock.calls.flat().join(" ")).not.toContain("shh-secret-value");
    spy.mockRestore();
  });
});
