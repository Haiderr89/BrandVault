import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The AI route reads its prompt from disk at runtime; make sure it ships with the function.
  outputFileTracingIncludes: {
    "/api/assets/[id]/ai-tags": ["./prompts/**/*"],
  },
};

export default nextConfig;
