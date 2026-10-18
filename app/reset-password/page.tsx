"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkRecoverySession() {
      const { data, error } = await supabase.auth.getSession();
      if (!active) return;

      if (!error && data.session) {
        setReady(true);
      } else {
        setMessage("This reset link may have expired or already been used. Request a new link to continue.");
      }
      setChecking(false);
    }

    void checkRecoverySession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        setReady(true);
        setChecking(false);
        setMessage("");
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSuccess(false);

    if (password.length < 8) {
      setMessage("Use a password with at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("The passwords do not match.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setMessage("We couldn't update your password. Your reset link may have expired; request a new one and try again.");
      return;
    }

    setSuccess(true);
    setMessage("Your password has been updated. You can now sign in with your new password.");
    await supabase.auth.signOut();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <Link href="/" className="text-2xl font-extrabold text-green-700">FIDWEL</Link>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-green-700">Secure your account</p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">Set a new password</h1>
        <p className="mt-2 text-sm leading-6 text-gray-600">Choose a new password for your FIDWEL account.</p>

        {checking ? (
          <p className="mt-7 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">Verifying your reset link…</p>
        ) : ready && !success ? (
          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-semibold text-gray-800">New password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                placeholder="At least 8 characters"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="mb-2 block text-sm font-semibold text-gray-800">Confirm new password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                placeholder="Enter the new password again"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            <button type="submit" disabled={loading} className="w-full rounded-xl bg-green-700 px-5 py-3 font-semibold text-white transition hover:bg-green-800 disabled:opacity-60">
              {loading ? "Updating password..." : "Update password"}
            </button>
          </form>
        ) : null}

        {message && (
          <p role={success ? "status" : "alert"} className={`mt-5 rounded-xl p-3 text-sm ${success ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"}`}>
            {message}
          </p>
        )}

        <div className="mt-6 flex flex-col items-center gap-3 text-sm">
          {success ? (
            <Link href="/login" className="font-semibold text-green-700 hover:underline">Continue to sign in</Link>
          ) : !checking && !ready ? (
            <Link href="/forgot-password" className="font-semibold text-green-700 hover:underline">Request a new reset link</Link>
          ) : null}
          <Link href="/" className="text-gray-600 hover:text-green-700">Back to FIDWEL</Link>
        </div>
      </div>
    </main>
  );
}
