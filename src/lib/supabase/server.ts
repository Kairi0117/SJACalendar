import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  // Allow build to succeed without env; runtime calls will throw.
  console.warn("Supabase env vars are not set.");
}

export const supabaseAdmin = createClient(
  url || "https://placeholder.supabase.co",
  serviceKey || "placeholder-key",
  {
    auth: { persistSession: false, autoRefreshToken: false },
  }
);
