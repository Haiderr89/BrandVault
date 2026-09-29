import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-opus-5"),
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
