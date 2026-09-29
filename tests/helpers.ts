import { NextRequest } from "next/server";

type Handler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

export async function call(
  handler: Handler,
  opts: { method?: string; path?: string; body?: unknown; cookie?: string; params?: Record<string, string>; headers?: Record<string, string> } = {},
) {
  const req = new NextRequest(`http://localhost${opts.path ?? "/"}`, {
    method: opts.method ?? "GET",
    headers: {
      "content-type": "application/json",
      host: "localhost",
      ...(opts.cookie ? { cookie: opts.cookie } : {}),
      ...opts.headers,
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const res = await handler(req, { params: Promise.resolve(opts.params ?? {}) });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, res };
}

export function sessionCookie(res: Response) {
  const raw = res.headers.get("set-cookie") ?? "";
  const match = raw.match(/bv_session=[^;]+/);
  if (!match) throw new Error("no session cookie");
  return match[0];
}
