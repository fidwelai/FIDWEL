"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { resolveAccountDestination } from "@/lib/account";

export default function LoginPage() {
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // If the visitor already has a session, keep them signed in: send them
  // straight to their account instead of showing the sign-in form again.
  useEffect(() => {
    let active = true;

    async function redirectIfSignedIn() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!active) return;

        if (!user) {
          setChecking(false);
          return;
        }

        const params = new URLSearchParams(window.location.search);
        const next = params.get("next");

        if (next && next.startsWith("/") && !next.startsWith("//")) {
          window.location.replace(next);
          return;
        }

        window.location.replace(await resolveAccountDestination(user));
      } catch {
        if (active) {
          setChecking(false);
        }
      }
    }

    void redirectIfSignedIn();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setTimeout(() => {
          void redirectIfSignedIn();
        }, 0);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleLogin(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      setMessage(
        "Login failed. Check your email and password, then try again."
      );
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");

    // Allow only local paths to prevent external redirects.
    if (next && next.startsWith("/") && !next.startsWith("//")) {
      window.location.replace(next);
      return;
    }

    const destination = await resolveAccountDestination(data.user);

    window.location.replace(destination);
  }

  const inputClass =
    "w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600";

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
        <p className="text-sm text-gray-500">Checking your session…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
                <Link
          href="/"
          className="mb-5 inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:border-green-600 hover:text-green-700 focus:outline-none focus:ring-2 focus:ring-green-600"
        >
          <span aria-hidden="true">←</span> Back to homepage
        </Link>

        <Link href="/" className="text-2xl font-bold text-green-700">
          FIDWEL
        </Link>

        <h1 className="mt-6 text-3xl font-bold text-gray-900">
          Welcome back
        </h1>

        <p className="mt-2 text-gray-600">
          Sign in to access your FIDWEL account.
        </p>

        <form onSubmit={handleLogin} className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block font-medium">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="mb-2 block font-medium">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={inputClass}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
          </div>

          <div className="flex justify-end -mt-2">
            <Link href="/forgot-password" className="text-sm font-semibold text-green-700 hover:underline">
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-green-700 px-5 py-3 font-semibold text-white hover:bg-green-800 disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

          {message && (
            <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {message}
            </p>
          )}
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          New to FIDWEL?{" "}
          <Link
            href="/register"
            className="font-semibold text-green-700 hover:underline"
          >
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
