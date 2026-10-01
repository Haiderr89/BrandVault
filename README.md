# BrandVault

A brand kit and asset library: one brand profile per workspace, plus nested folders, search, sort, trash/restore and AI-assisted tagging.

- **Live demo:** _TBD_
- **Demo login:** `demo@brandvault.dev` / `Demo1234!`, or click **Continue as demo** on the sign-in page
- **Tests:** `npm test` (18 API tests, no database needed)

## Stack

| Layer      | Choice                                                                                         |
| ---------- | ---------------------------------------------------------------------------------------------- |
| App + API  | Next.js 16 (App Router) + TypeScript. Route handlers under `src/app/api`.                      |
| Database   | PostgreSQL (Neon in production), Drizzle ORM, SQL migrations in `drizzle/`                     |
| Auth       | Email + password (bcrypt), HS256 JWT in an httpOnly, SameSite=Lax cookie (`jose`)              |
| Validation | Zod, shared by API input, AI output and the AI save endpoint                                   |
| GenAI      | Anthropic Claude (`claude-opus-5`, low effort) via `@anthropic-ai/sdk` with structured outputs |
| UI         | Tailwind CSS v4, lucide icons, light/dark via `prefers-color-scheme`                           |
| Tests      | Vitest, run against in-memory Postgres (PGlite) with the real migrations                       |
| Hosting    | Vercel (app + API) + Neon (Postgres)                                                           |

## Local setup

Requires Node 20+ and a Postgres database.

```bash
git clone https://github.com/<you>/brandvault && cd brandvault
npm install
cp .env.example .env            # then set DATABASE_URL, AUTH_SECRET, ANTHROPIC_API_KEY
createdb brandvault             # or point DATABASE_URL at any Postgres
npm run db:migrate
npm run db:seed                 # creates the demo account with sample data
npm run dev                     # http://localhost:3000
npm test
```

## Architecture

```
src/
  app/api/…          HTTP layer: parse + validate input, call a service, map errors
  server/…           Services: all DB access, always scoped by workspaceId
  lib/http.ts        route() / authedRoute() wrappers, HttpError, Origin check
  lib/session.ts     sign/verify session cookie
  lib/validation.ts  Zod schemas (API input + AI output)
  db/schema.ts       Drizzle schema → drizzle/*.sql migrations
  components/…       Client UI (library, brand editor, trash, AI review modal)
  proxy.ts           Optimistic page redirects (not an auth boundary)
prompts/asset-tagging.md   System prompt for the AI tagging assistant
tests/               API tests (PGlite)
```

The frontend is a set of client components that call the same JSON API a third party would. There are no server actions or back channels, so every UI flow goes through the validated, authorized endpoints.

### Data model

```
users 1──1 workspaces 1──1 brands
                     1──* folders (self-referencing parent_id, depth 1–3)
                     1──* assets  (folder_id → folders, nullable; deleted_at for trash)
```

- `workspaces.owner_id` is unique, so each user has exactly one workspace. It is created in the same transaction as the user.
- `brands.workspace_id` is unique (one brand per workspace). Hex colors are checked by a DB `CHECK` constraint as well as by Zod.
- `folders.parent_id` uses `ON DELETE RESTRICT`. `folders.depth` is stored and constrained to 1–3.
- `assets.folder_id` uses `ON DELETE SET NULL` (see folder deletion below). `assets.url` must start with `https://` (DB `CHECK`).
- `assets.deleted_at` is the soft delete. Indexes cover `(workspace_id, folder_id, deleted_at)` and `(workspace_id, deleted_at)`.
- `assets.tags text[]`, `description` and `usage_suggestion` hold the reviewed AI output.

### API

All endpoints return JSON. Errors have the shape `{ "error": { "code", "message", "details?" } }`.

| Method    | Path                                             | Notes                                                                                               |
| --------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| POST      | `/api/auth/signup`, `/login`, `/logout`, `/demo` | `demo` creates the demo account if needed, then signs in                                            |
| GET       | `/api/auth/me`                                   |                                                                                                     |
| GET       | `/api/brand`                                     | `{ brand: null }` if not created yet                                                                |
| POST      | `/api/brand`                                     | 409 if the workspace already has one                                                                |
| PATCH     | `/api/brand`                                     | Partial update                                                                                      |
| GET       | `/api/folders?parentId=`                         | Children of a folder (root if omitted). `?all=true` returns a flat list                             |
| POST      | `/api/folders`                                   | `{ name, parentId? }`. 400 beyond depth 3                                                           |
| GET       | `/api/folders/:id`                               | Folder + ancestor path (breadcrumbs)                                                                |
| PATCH     | `/api/folders/:id`                               | Rename                                                                                              |
| DELETE    | `/api/folders/:id`                               | 409 if not empty                                                                                    |
| GET       | `/api/assets?folderId=&q=&sort=`                 | Live assets only. `q` searches the whole workspace. `sort` = `updated_desc` (default) or `name_asc` |
| POST      | `/api/assets`                                    | `{ name, type, url, folderId? }`                                                                    |
| GET/PATCH | `/api/assets/:id`                                | PATCH also moves (`folderId`)                                                                       |
| DELETE    | `/api/assets/:id`                                | Permanent. Only allowed for trashed assets (else 409)                                               |
| POST      | `/api/assets/:id/trash`                          | Soft delete                                                                                         |
| POST      | `/api/assets/:id/restore`                        |                                                                                                     |
| GET       | `/api/trash`                                     | Trashed assets only                                                                                 |
| POST      | `/api/assets/:id/ai-tags`                        | Returns a suggestion. **Does not save.**                                                            |
| PATCH     | `/api/assets/:id/ai-tags/save`                   | Saves the reviewed suggestion (validated again)                                                     |

Status codes: **400** invalid input or JSON, **401** missing, invalid or expired session, **403** cross-origin mutation, **404** not found _or belongs to another workspace_, **409** state conflicts (duplicate email, brand exists, folder not empty, already trashed), **502/503** AI failures.

## Authorization rules

1. Every route except sign-up, sign-in, demo and logout requires a valid session cookie. Otherwise it returns 401. This is enforced by `authedRoute()`, not by the proxy.
2. The session carries the user's `workspaceId`. Every query in `src/server/*` filters on `workspace_id = session.workspaceId`. No endpoint takes a workspace id from the client.
3. Accessing another workspace's asset or folder by id returns **404**, not 403, so ids can't be probed. The same applies to referencing a foreign folder as a `parentId` or `folderId`.
4. Search runs inside the same workspace filter, so it never matches another user's assets.
5. Mutations from a browser on another origin get 403 (Origin check on top of SameSite=Lax cookies).
6. `tests/api.test.ts` has a dedicated test where one user tries to read, edit, trash, list and file into another user's data.

## Soft delete and folder deletion

- Trash sets `deleted_at`. Library listing, search and `GET /api/assets/:id` all filter `deleted_at IS NULL`. `/api/trash` returns only `deleted_at IS NOT NULL`.
- Edits and AI saves on a trashed asset return 404. It has to be restored first.
- **Folder deletion is blocked (409) while the folder has subfolders or live assets.** I chose this over cascading soft deletes because it's predictable and can't silently hide work. Trashed assets don't block deletion: their `folder_id` is set to NULL by the FK, so a later restore puts them at the library root. The UI tells you where a restored asset lands.

## GenAI: asset tag and description assistant

- **Provider:** Anthropic Claude. The model is configurable through `ANTHROPIC_MODEL` (default `claude-opus-5`, run at `effort: "low"` since the task is small).
- **Endpoint:** `POST /api/assets/:id/ai-tags`, then the user reviews and edits, then `PATCH /api/assets/:id/ai-tags/save`.
- **Prompt:** [`prompts/asset-tagging.md`](prompts/asset-tagging.md) (system prompt, loaded at runtime).
- **Input:** asset name, type, URL, folder name, and the brand's name, colors and font, wrapped in `<asset_context>` and marked as data, not instructions.
- **Grounding:** the prompt forbids describing visual content the model can't see, and forbids inventing products, dates or claims. Thin metadata should produce generic tags.
- **Validation:**
  1. Structured outputs (`output_config.format` via `zodOutputFormat`) constrain Claude to `{ tags: string[], description, usage_suggestion }`. The SDK throws if the output isn't valid JSON for that shape.
  2. `aiSuggestionSchema` (Zod) then enforces 1–10 lowercase, deduped tags of 32 characters or fewer, and non-empty description and usage of 300 characters or fewer. A refusal, a truncated response (`stop_reason !== "end_turn"`) or a schema failure returns **502** and nothing is saved.
  3. The save endpoint validates the (possibly edited) body with the same schema.
- **Safety:** the API key only exists server-side (`ANTHROPIC_API_KEY`). No AI call happens from the browser. Without a key the endpoint returns 503 and the UI shows the error with a retry.
- Covered by `tests/ai.test.ts`, which mocks the SDK: normalization, invalid output, truncation and the save validation.

## Bonus: n8n webhook

The backend sends a webhook to n8n for three events, and the n8n workflow sends an email notification.

| Event                 | When                                                              |
| --------------------- | ----------------------------------------------------------------- |
| `brand.updated`       | `PATCH /api/brand` succeeds                                       |
| `asset.restored`      | `POST /api/assets/:id/restore` succeeds                           |
| `asset.ai_tags_saved` | `PATCH /api/assets/:id/ai-tags/save` succeeds (after user review) |

**Payload** (POST, JSON, header `X-BrandVault-Secret: <N8N_WEBHOOK_SECRET>`):

```json
{
  "event": "asset.restored",
  "assetId": "5b0f…",
  "brandId": null,
  "userEmail": "demo@brandvault.dev",
  "timestamp": "2026-10-01T10:00:00.000Z"
}
```

- **Code:** [`src/server/webhooks.ts`](src/server/webhooks.ts). Events are sent with Next's `after()`, once the response has been returned, so a slow or down n8n never slows the app or fails the request. Failures are logged, and requests time out after 5s. If `N8N_WEBHOOK_URL` is unset, nothing is sent.
- **Workflow file:** [`n8n/brandvault-webhook.json`](n8n/brandvault-webhook.json): **Webhook** (Header Auth) → **Known event?** → **Format message** → **Send email**. Unknown events go to **Ignore**. Every run, with the formatted message, is also visible in n8n's _Executions_ log.
- **Setup:** in n8n, import the file, then:
  1. Create a _Header Auth_ credential with name `X-BrandVault-Secret` and your secret as the value.
  2. Attach an SMTP credential to _Send email_.
  3. Activate the workflow.
  4. Set `N8N_WEBHOOK_URL` to the production webhook URL and set `N8N_WEBHOOK_SECRET`.
- Covered by `tests/webhooks.test.ts`: payload shape, secret header, events not fired on failed actions, and a webhook failure never breaking the request.

## Tradeoffs and what I skipped

- **Real file upload:** skipped. Assets are URL-based metadata as the brief allows. Thumbnails render for image and logo URLs.
- **Moving folders** (re-parenting) isn't supported, only renaming. It would need cycle and depth re-checks for subtrees.
- **Hand-rolled session auth** instead of Auth.js. It's small and easy to audit for one credentials provider, but there's no password reset, email verification or session revocation (JWTs are valid until expiry, which is 7 days).
- **No rate limiting** on login or on the AI endpoint. In production I'd add Upstash or Redis rate limits.
- **Search** is `ILIKE` on the name (wildcards escaped), so it's case-insensitive substring matching. It doesn't search tags yet, and there's no pagination.
- **Shared demo account:** every reviewer uses the same demo workspace, so they may see each other's changes.
- Picked 2 nice-to-haves: **API tests** and **drag-and-drop move** (onto a folder card or a breadcrumb). Dark mode comes for free from the tokens.

## What I'd do next (another week)

1. **Real uploads** to S3 or R2 with presigned URLs, and send images to Claude as vision input so tags can describe actual content.
2. **Search and scale:** search tags and descriptions too (Postgres full-text or `pg_trgm`), cursor pagination, bulk select, move and trash.
3. **Hardening and ops:** rate limits, an activity log ("asset trashed by …"), a Playwright smoke test in CI, and an automatic 30-day trash purge.

## Environment variables

See [`.env.example`](.env.example): `DATABASE_URL`, `AUTH_SECRET`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `DEMO_PASSWORD`, and optionally `N8N_WEBHOOK_URL` and `N8N_WEBHOOK_SECRET`.
