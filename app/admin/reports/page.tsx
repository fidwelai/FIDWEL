"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useStaffSession } from "@/lib/use-staff-session";

type Report = {
  id: number;
  vendor_id: string;
  agent_id: string;
  agent_name: string;
  identity_confirmed: boolean;
  location_confirmed: boolean;
  products_confirmed: boolean;
  recommendation: "approve" | "follow_up" | "reject";
  notes: string;
  review_status: "pending" | "reviewed";
  admin_notes: string | null;
  created_at: string;
  vendor_profiles:
    | { business_name: string; state: string | null; lga: string | null; town: string | null }
    | { business_name: string; state: string | null; lga: string | null; town: string | null }[]
    | null;
};

function vendorDetails(report: Report) {
  const vendor = Array.isArray(report.vendor_profiles)
    ? report.vendor_profiles[0]
    : report.vendor_profiles;
  return vendor;
}

export default function AdminReportsPage() {
  const session = useStaffSession("admin", "/admin/reports");
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [notes, setNotes] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!session.authorized) return;
    let active = true;

    async function load() {
      const { data: auth } = await supabase.auth.getSession();
      if (!auth.session) {
        setMessage("Your session expired. Sign in again.");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/admin/reports", {
          headers: { Authorization: `Bearer ${auth.session.access_token}` },
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as
          | { reports?: Report[]; error?: string }
          | null;

        if (!active) return;
        if (!response.ok || !payload?.reports) {
          setMessage(payload?.error ?? "Could not load field reports.");
          setLoading(false);
          return;
        }
        setReports(payload.reports);
      } catch {
        if (active) setMessage("Network error while loading field reports.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [session.authorized]);

  async function markReviewed(report: Report) {
    const { data: auth } = await supabase.auth.getSession();
    if (!auth.session) {
      setMessage("Your session expired. Sign in again.");
      return;
    }

    setBusyId(report.id);
    setMessage("");
    try {
      const response = await fetch("/api/admin/reports", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.session.access_token}`,
        },
        body: JSON.stringify({
          reportId: report.id,
          adminNotes: notes[report.id] ?? "",
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { report?: { id: number; review_status: "reviewed"; admin_notes: string | null }; error?: string }
        | null;

      if (!response.ok || !payload?.report) {
        setMessage(payload?.error ?? "Could not save this review.");
        return;
      }

      setReports((current) =>
        current.map((item) =>
          item.id === report.id
            ? { ...item, review_status: "reviewed", admin_notes: payload.report!.admin_notes }
            : item
        )
      );
    } catch {
      setMessage("Network error while saving the review.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/admin" className="text-2xl font-bold text-green-700">FIDWEL</Link>
          <Link href="/admin" className="text-sm font-medium hover:text-green-700">← Admin</Link>
        </div>
      </nav>
      <section className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-3xl font-bold">Agent field reports</h1>
        <p className="mt-2 text-gray-600">
          Review field observations. Vendor approval and rejection remain separate admin decisions.
        </p>

        {session.loading ? (
          <p className="mt-8 text-gray-500">Checking access...</p>
        ) : !session.authorized ? (
          <p className="mt-8 text-gray-500">Admins only.</p>
        ) : loading ? (
          <p className="mt-8 text-gray-500">Loading reports...</p>
        ) : message ? (
          <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-white p-4 text-red-700">{message}</p>
        ) : reports.length === 0 ? (
          <p className="mt-8 rounded-xl border bg-white p-6 text-gray-600">No agent field reports have been submitted.</p>
        ) : (
          <ul className="mt-8 space-y-4">
            {reports.map((report) => {
              const vendor = vendorDetails(report);
              return (
                <li key={report.id} className="rounded-2xl border bg-white p-6 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-bold">{vendor?.business_name ?? "Vendor"}</h2>
                      <p className="mt-1 text-sm text-gray-500">
                        {[vendor?.town, vendor?.lga, vendor?.state].filter(Boolean).join(", ") || "Location not provided"}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Submitted by {report.agent_name} · {new Date(report.created_at).toLocaleString("en-NG")}
                      </p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${report.review_status === "pending" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-green-200 bg-green-50 text-green-700"}`}>
                      {report.review_status}
                    </span>
                  </div>

                  <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
                    <div><dt className="text-gray-500">Identity checked</dt><dd className="font-semibold">{report.identity_confirmed ? "Yes" : "No"}</dd></div>
                    <div><dt className="text-gray-500">Location checked</dt><dd className="font-semibold">{report.location_confirmed ? "Yes" : "No"}</dd></div>
                    <div><dt className="text-gray-500">Products checked</dt><dd className="font-semibold">{report.products_confirmed ? "Yes" : "No"}</dd></div>
                  </dl>
                  <p className="mt-4 text-sm">
                    Agent recommendation: <strong className="capitalize">{report.recommendation.replace("_", " ")}</strong>
                  </p>
                  {report.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{report.notes}</p>}
                  <Link href="/admin/vendors" className="mt-3 inline-block text-sm font-semibold text-green-700 hover:underline">
                    Open vendor approvals
                  </Link>

                  {report.review_status === "pending" ? (
                    <div className="mt-4 space-y-3 border-t pt-4">
                      <label className="block text-sm font-medium">
                        Admin review notes
                        <textarea
                          value={notes[report.id] ?? ""}
                          onChange={(event) => setNotes((current) => ({ ...current, [report.id]: event.target.value }))}
                          maxLength={2000}
                          rows={2}
                          className="mt-1 w-full rounded-lg border px-3 py-2"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => void markReviewed(report)}
                        disabled={busyId === report.id}
                        className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {busyId === report.id ? "Saving..." : "Mark reviewed"}
                      </button>
                    </div>
                  ) : report.admin_notes ? (
                    <p className="mt-4 border-t pt-3 text-sm text-gray-600"><strong>Admin note:</strong> {report.admin_notes}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {message && !loading && reports.length > 0 && (
          <p role="alert" className="mt-4 text-sm text-red-700">{message}</p>
        )}
      </section>
    </main>
  );
}
