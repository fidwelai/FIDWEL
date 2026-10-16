"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type StaffKind = "admin" | "agent";

type StaffSessionState = {
  loading: boolean;
  authorized: boolean;
  userId: string | null;
  email: string;
};

export function useStaffSession(kind: StaffKind, nextPath: string): StaffSessionState {
  const router = useRouter();
  const [state, setState] = useState<StaffSessionState>({
    loading: true,
    authorized: false,
    userId: null,
    email: "",
  });

  useEffect(() => {
    let active = true;

    async function check() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) {
        return;
      }

      if (!session) {
        router.push("/login?next=" + encodeURIComponent(nextPath));
        return;
      }

      const response = await fetch(`/api/${kind}/session`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const payload = (await response.json().catch(() => null)) as
        | { isAdmin?: boolean; isAgent?: boolean }
        | null;

      if (!active) {
        return;
      }

      const authorized =
        kind === "admin" ? Boolean(payload?.isAdmin) : Boolean(payload?.isAgent);

      setState({
        loading: false,
        authorized,
        userId: session.user.id,
        email: session.user.email ?? "",
      });
    }

    void check();

    return () => {
      active = false;
    };
  }, [kind, nextPath, router]);

  return state;
}
