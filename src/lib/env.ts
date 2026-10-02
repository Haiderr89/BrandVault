import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  // AI provider: Gemini is used when GEMINI_API_KEY is set, otherwise Claude.
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-flash-latest"),
  GEMINI_FALLBACK_MODEL: z.string().default("gemini-flash-lite-latest"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-opus-5"),
  // Optional n8n bonus. When unset, webhook events are skipped.
  N8N_WEBHOOK_URL: z
    .url()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  // Trimmed: a pasted trailing newline would make it an invalid header value.
  N8N_WEBHOOK_SECRET: z.string().trim().optional(),
});

type Env = z.infer<typeof schema>;

let cached: Env | undefined;

// Validated lazily so `next build` doesn't need runtime secrets.
export const env = new Proxy({} as Env, {
  get(_, key: string) {
    cached ??= schema.parse(process.env);
    return cached[key as keyof Env];
  },
});
