import { beforeAll, describe, expect, it } from "vitest";
import * as assetById from "@/app/api/assets/[id]/route";
import * as restore from "@/app/api/assets/[id]/restore/route";
import * as trashOne from "@/app/api/assets/[id]/trash/route";
import * as assetsRoute from "@/app/api/assets/route";
import * as signup from "@/app/api/auth/signup/route";
import * as brand from "@/app/api/brand/route";
import * as folderById from "@/app/api/folders/[id]/route";
import * as foldersRoute from "@/app/api/folders/route";
import * as trashList from "@/app/api/trash/route";
import { call, sessionCookie } from "./helpers";

async function newUser(email: string) {
  const r = await call(signup.POST, { method: "POST", body: { email, password: "Password1!" } });
  expect(r.status).toBe(201);
  return sessionCookie(r.res);
}

let alice: string;
let bob: string;

beforeAll(async () => {
  alice = await newUser("alice@example.com");
  bob = await newUser("bob@example.com");
});

describe("auth", () => {
  it("rejects unauthenticated requests with 401", async () => {
    expect((await call(assetsRoute.GET, { path: "/api/assets" })).status).toBe(401);
    expect((await call(assetsRoute.POST, { method: "POST", body: {} })).status).toBe(401);
  });

  it("rejects a tampered session cookie", async () => {
    const r = await call(assetsRoute.GET, { path: "/api/assets", cookie: alice.slice(0, -2) + "xx" });
    expect(r.status).toBe(401);
  });

  it("rejects duplicate signups with 409", async () => {
    const r = await call(signup.POST, { method: "POST", body: { email: "ALICE@example.com", password: "Password1!" } });
    expect(r.status).toBe(409);
  });

  it("rejects cross-origin mutations with 403", async () => {
    const r = await call(foldersRoute.POST, {
      method: "POST",
      cookie: alice,
      body: { name: "x" },
      headers: { origin: "https://evil.example" },
    });
    expect(r.status).toBe(403);
  });
});

describe("validation", () => {
  it("returns 400 with field errors for bad asset input", async () => {
    const r = await call(assetsRoute.POST, {
      method: "POST",
      cookie: alice,
      body: { name: "", type: "gif", url: "http://insecure.example.com/a.png" },
    });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe("validation_error");
    expect(Object.keys(r.body.error.details)).toEqual(expect.arrayContaining(["name", "type", "url"]));
  });

  it("rejects invalid hex colors on the brand", async () => {
    const r = await call(brand.POST, {
      method: "POST",
      cookie: alice,
      body: { name: "Acme", primaryColor: "red", secondaryColor: "#000000" },
    });
    expect(r.status).toBe(400);
  });
});

describe("brand kit", () => {
  it("creates, reads and updates the brand", async () => {
    const created = await call(brand.POST, {
      method: "POST",
      cookie: alice,
      body: { name: "Acme", primaryColor: "#ff0000", secondaryColor: "#00ff00", fontName: "" },
    });
    expect(created.status).toBe(201);
    expect(created.body.brand.primaryColor).toBe("#FF0000");
    expect(created.body.brand.fontName).toBeNull();

    const again = await call(brand.POST, {
      method: "POST",
      cookie: alice,
      body: { name: "Acme 2", primaryColor: "#ff0000", secondaryColor: "#00ff00" },
    });
    expect(again.status).toBe(409);

    const patched = await call(brand.PATCH, { method: "PATCH", cookie: alice, body: { name: "Acme Inc" } });
    expect(patched.body.brand.name).toBe("Acme Inc");

    // Bob sees his own (empty) brand, never Alice's.
    expect((await call(brand.GET, { cookie: bob })).body.brand).toBeNull();
  });
});

describe("folders, assets, trash", () => {
  it("full lifecycle with soft delete and restore", async () => {
    const f1 = await call(foldersRoute.POST, { method: "POST", cookie: alice, body: { name: "Campaigns" } });
    const f2 = await call(foldersRoute.POST, {
      method: "POST",
      cookie: alice,
      body: { name: "Q4", parentId: f1.body.folder.id },
    });
    const f3 = await call(foldersRoute.POST, {
      method: "POST",
      cookie: alice,
      body: { name: "Week 1", parentId: f2.body.folder.id },
    });
    expect(f3.body.folder.depth).toBe(3);
    const tooDeep = await call(foldersRoute.POST, {
      method: "POST",
      cookie: alice,
      body: { name: "Too deep", parentId: f3.body.folder.id },
    });
    expect(tooDeep.status).toBe(400);

    const path = await call(folderById.GET, { cookie: alice, params: { id: f3.body.folder.id } });
    expect(path.body.path.map((f: { name: string }) => f.name)).toEqual(["Campaigns", "Q4", "Week 1"]);

    const a = await call(assetsRoute.POST, {
      method: "POST",
      cookie: alice,
      body: { name: "Banner", type: "image", url: "https://cdn.example.com/b.png", folderId: f2.body.folder.id },
    });
    expect(a.status).toBe(201);
    const id = a.body.asset.id;
    await call(assetsRoute.POST, {
      method: "POST",
      cookie: alice,
      body: { name: "Another banner", type: "image", url: "https://cdn.example.com/c.png" },
    });

    // Listing is per folder; search spans the workspace.
    const inQ4 = await call(assetsRoute.GET, { cookie: alice, path: `/api/assets?folderId=${f2.body.folder.id}` });
    expect(inQ4.body.assets.map((x: { name: string }) => x.name)).toEqual(["Banner"]);
    const search = await call(assetsRoute.GET, { cookie: alice, path: "/api/assets?q=banner&sort=name_asc" });
    expect(search.body.assets.map((x: { name: string }) => x.name)).toEqual(["Another banner", "Banner"]);

    // Non-empty folder can't be deleted.
    expect((await call(folderById.DELETE, { method: "DELETE", cookie: alice, params: { id: f2.body.folder.id } })).status).toBe(409);

    // Move to root, then trash.
    const moved = await call(assetById.PATCH, { method: "PATCH", cookie: alice, params: { id }, body: { folderId: null } });
    expect(moved.body.asset.folderId).toBeNull();

    expect((await call(trashOne.POST, { method: "POST", cookie: alice, params: { id } })).status).toBe(200);
    expect((await call(trashOne.POST, { method: "POST", cookie: alice, params: { id } })).status).toBe(409);

    // Trashed assets vanish from the library and search, and appear in trash.
    const afterTrash = await call(assetsRoute.GET, { cookie: alice, path: "/api/assets?q=banner" });
    expect(afterTrash.body.assets.map((x: { name: string }) => x.name)).toEqual(["Another banner"]);
    expect((await call(assetById.GET, { cookie: alice, params: { id } })).status).toBe(404);
    const trash = await call(trashList.GET, { cookie: alice });
    expect(trash.body.assets.map((x: { id: string }) => x.id)).toEqual([id]);

    // Restore brings it back.
    expect((await call(restore.POST, { method: "POST", cookie: alice, params: { id } })).status).toBe(200);
    expect((await call(trashList.GET, { cookie: alice })).body.assets).toHaveLength(0);

    // Permanent delete only works from the trash.
    expect((await call(assetById.DELETE, { method: "DELETE", cookie: alice, params: { id } })).status).toBe(409);
    await call(trashOne.POST, { method: "POST", cookie: alice, params: { id } });
    expect((await call(assetById.DELETE, { method: "DELETE", cookie: alice, params: { id } })).status).toBe(204);
  });
});

describe("authorization: users cannot touch each other's data", () => {
  it("returns 404 for another workspace's assets and folders", async () => {
    const folder = await call(foldersRoute.POST, { method: "POST", cookie: alice, body: { name: "Private" } });
    const asset = await call(assetsRoute.POST, {
      method: "POST",
      cookie: alice,
      body: { name: "Secret logo", type: "logo", url: "https://cdn.example.com/secret.png" },
    });
    const aid = asset.body.asset.id;
    const fid = folder.body.folder.id;

    expect((await call(assetById.GET, { cookie: bob, params: { id: aid } })).status).toBe(404);
    expect((await call(assetById.PATCH, { method: "PATCH", cookie: bob, params: { id: aid }, body: { name: "pwned" } })).status).toBe(404);
    expect((await call(trashOne.POST, { method: "POST", cookie: bob, params: { id: aid } })).status).toBe(404);
    expect((await call(folderById.GET, { cookie: bob, params: { id: fid } })).status).toBe(404);
    expect((await call(folderById.DELETE, { method: "DELETE", cookie: bob, params: { id: fid } })).status).toBe(404);

    // Bob can't list Alice's folder or file assets into it.
    expect((await call(assetsRoute.GET, { cookie: bob, path: `/api/assets?folderId=${fid}` })).status).toBe(404);
    const intoAlice = await call(assetsRoute.POST, {
      method: "POST",
      cookie: bob,
      body: { name: "x", type: "image", url: "https://cdn.example.com/x.png", folderId: fid },
    });
    expect(intoAlice.status).toBe(404);

    // Bob's search never returns Alice's assets.
    const search = await call(assetsRoute.GET, { cookie: bob, path: "/api/assets?q=secret" });
    expect(search.body.assets).toHaveLength(0);

    // Alice's asset is untouched.
    expect((await call(assetById.GET, { cookie: alice, params: { id: aid } })).body.asset.name).toBe("Secret logo");
  });
});
