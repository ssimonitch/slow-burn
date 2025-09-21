import { z } from "zod";

const supabaseEnvSchema = z
  .object({
    VITE_SUPABASE_URL: z
      .string()
      .url({ message: "VITE_SUPABASE_URL must be a valid URL" }),
    VITE_SUPABASE_ANON_KEY: z
      .string()
      .min(1, { message: "VITE_SUPABASE_ANON_KEY is required" }),
  })
  .passthrough();

export interface SupabaseEnvConfig {
  url: string;
  anonKey: string;
}

export function resolveSupabaseEnv(): SupabaseEnvConfig {
  const result = supabaseEnvSchema.safeParse(import.meta.env);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `• ${issue.message}`)
      .join("\n");
    throw new Error(
      [
        "Supabase configuration missing or invalid.",
        "Provide VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in packages/app/.env.local",
        issues,
      ].join("\n"),
    );
  }

  return {
    url: result.data.VITE_SUPABASE_URL,
    anonKey: result.data.VITE_SUPABASE_ANON_KEY,
  };
}
