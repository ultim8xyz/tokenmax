import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/** Bypasses RLS. Only ever call this from route handlers, never from a page. */
export function getServiceClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "service client misconfigured: " +
        `url=${url ? "set" : "MISSING"} key=${key ? "set" : "MISSING"}`,
    );
  }

  cached = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return cached;
}
