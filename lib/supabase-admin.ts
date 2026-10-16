import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

// Server-only client. The secret key bypasses Row Level Security, so this must
// never be imported into a component that ships to the browser. Route handlers
// use it to write orders and confirm payments after validating the caller.
export const supabaseAdmin =
  supabaseUrl && secretKey
    ? createClient(supabaseUrl, secretKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

export function isAdminConfigured(): boolean {
  return supabaseAdmin !== null;
}
