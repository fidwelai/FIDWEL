import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export async function resolveAccountDestination(user: User): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role ?? user.user_metadata?.account_type;

  if (role === "admin") {
    return "/admin";
  }

  if (role === "agent") {
    return "/agent";
  }

  const { data: vendor } = await supabase
    .from("vendor_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (vendor) {
    return "/vendor-dashboard";
  }

  return role === "vendor" ? "/vendor/register" : "/";
}
