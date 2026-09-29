import { NextResponse, type NextRequest } from "next/server";
import { z, ZodError, type ZodType } from "zod";
import { SESSION_COOKIE, readSession, type Session } from "./session";

export class HttpError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 422 | 502 | 503,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string, details?: unknown) => new HttpError(400, "bad_request", msg, details);
export const unauthorized = () => new HttpError(401, "unauthorized", "Sign in to continue.");
export const forbidden = (msg = "You don't have access to this resource.") =>
  new HttpError(403, "forbidden", msg);
export const notFound = (what = "Resource") => new HttpError(404, "not_found", `${what} not found.`);
export const conflict = (msg: string) => new HttpError(409, "conflict", msg);

export function toErrorResponse(err: unknown) {
  if (err instanceof HttpError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      { status: err.status },
    );
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: err.issues[0]?.message ?? "Invalid input.",
          details: z.flattenError(err).fieldErrors,
        },
      },
      { status: 400 },
    );
  }
  console.error(err);
  return NextResponse.json(
    { error: { code: "internal_error", message: "Something went wrong." } },
    { status: 500 },
  );
}

export async function readJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw badRequest("Request body must be valid JSON.");
  }
  return schema.parse(body);
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Cookies are SameSite=Lax, but we also reject cross-site mutating requests
// from browsers (which always send Origin on POST/PATCH/DELETE).
function assertSameOrigin(req: NextRequest) {
  if (!MUTATING.has(req.method)) return;
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host || new URL(origin).host !== host) throw forbidden("Cross-origin request rejected.");
}

type RouteCtx = { params: Promise<Record<string, string>> };
type Handler<A> = (req: NextRequest, args: A) => Promise<Response>;

export function route(handler: Handler<{ params: Record<string, string> }>) {
  return async (req: NextRequest, ctx: RouteCtx) => {
    try {
      assertSameOrigin(req);
      return await handler(req, { params: (await ctx?.params) ?? {} });
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}

/** Like `route`, but rejects with 401 unless there is a valid session. */
export function authedRoute(handler: Handler<{ params: Record<string, string>; session: Session }>) {
  return route(async (req, { params }) => {
    const session = await readSession(req.cookies.get(SESSION_COOKIE)?.value);
    if (!session) throw unauthorized();
    return handler(req, { params, session });
  });
}

const uuid = z.uuid({ message: "Invalid id." });
export const parseId = (value: string | undefined, what = "Resource") => {
  const result = uuid.safeParse(value);
  // A malformed id can never match a row, so treat it as not found.
  if (!result.success) throw notFound(what);
  return result.data;
};
