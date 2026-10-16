"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

const TYPE_ICON: Record<string, string> = {
  order_placed: "🧾",
  order_paid: "✅",
  vendor_approved: "🎉",
  vendor_rejected: "⚠️",
  subscription_active: "⭐",
};

function formatDate(value: string): string {
  return new Date(value).toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) {
        return;
      }

      if (!session) {
        router.push("/login?next=" + encodeURIComponent("/notifications"));
        return;
      }

      const response = await fetch("/api/notifications", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });

      const payload = (await response.json().catch(() => null)) as
        | { notifications?: NotificationRow[]; unread?: number }
        | null;

      if (!active) {
        return;
      }

      setItems(payload?.notifications ?? []);
      setUnread(Number(payload?.unread ?? 0));
      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, [router]);

  async function markRead(id: string) {
    const target = items.find((item) => item.id === id);

    if (!target || target.read_at) {
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return;
    }

    setBusy(true);

    await fetch("/api/notifications", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ id }),
    });

    const now = new Date().toISOString();
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, read_at: now } : item))
    );
    setUnread((count) => Math.max(0, count - 1));
    setBusy(false);
  }

  async function markAllRead() {
    if (unread === 0) {
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return;
    }

    setBusy(true);

    await fetch("/api/notifications", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ all: true }),
    });

    const now = new Date().toISOString();
    setItems((prev) =>
      prev.map((item) => (item.read_at ? item : { ...item, read_at: now }))
    );
    setUnread(0);
    setBusy(false);
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-green-700">
            FIDWEL
          </Link>
          <Link href="/products" className="text-sm font-medium hover:text-green-700">
            ← Continue shopping
          </Link>
        </div>
      </nav>

      <section className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-bold">
            Notifications
            {unread > 0 && (
              <span className="ml-3 align-middle rounded-full bg-green-700 px-3 py-1 text-sm font-semibold text-white">
                {unread} new
              </span>
            )}
          </h1>
          {unread > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              disabled={busy}
              className="rounded-xl border px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-50 disabled:opacity-50"
            >
              Mark all read
            </button>
          )}
        </div>

        {loading ? (
          <p className="mt-8 text-gray-500">Loading your notifications...</p>
        ) : items.length === 0 ? (
          <div className="mt-8 rounded-2xl bg-white p-10 text-center shadow-sm">
            <div className="text-5xl">🔔</div>
            <h2 className="mt-4 text-xl font-bold">You are all caught up</h2>
            <p className="mt-2 text-gray-600">
              Order updates and account messages will appear here.
            </p>
          </div>
        ) : (
          <ul className="mt-8 space-y-3">
            {items.map((item) => (
              <li key={item.id}>
                <div
                  className={`rounded-2xl border bg-white p-5 shadow-sm ${
                    item.read_at ? "" : "border-l-4 border-l-green-600"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <span className="text-2xl" aria-hidden>
                      {TYPE_ICON[item.type] ?? "🔔"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold">{item.title}</p>
                        {!item.read_at && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                            New
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-gray-600">{item.body}</p>
                      <p className="mt-2 text-xs text-gray-400">
                        {formatDate(item.created_at)}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        {item.link && (
                          <Link
                            href={item.link}
                            className="text-sm font-semibold text-green-700 hover:underline"
                          >
                            View details
                          </Link>
                        )}
                        {!item.read_at && (
                          <button
                            type="button"
                            onClick={() => markRead(item.id)}
                            disabled={busy}
                            className="text-sm font-medium text-gray-500 hover:text-gray-700 disabled:opacity-50"
                          >
                            Mark as read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
