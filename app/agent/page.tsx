"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useStaffSession } from "@/lib/use-staff-session";

type ReferredVendor = {
  id: string;
  business_name: string;
  status: string;
  verified: boolean;
  state: string | null;
  town: string | null;
  created_at: string;
};

type DeliveryProfile = {
  user_id: string;
  state: string;
  lga: string;
  town: string | null;
  phone: string | null;
  is_active: boolean;
};

type DeliveryOrder = {
  id: string;
  status: string;
  payment_status: string;
  delivery_status: string;
  created_at: string;
  contact_name: string | null;
  contact_phone: string | null;
  delivery_state: string | null;
  delivery_lga: string | null;
  delivery_town: string | null;
  delivery_address: string | null;
  notes: string | null;
  delivery_fee: number;
  total: number;
};

type VerificationReport = {
  id: number;
  vendor_id: string;
  recommendation: "approve" | "follow_up" | "reject";
  review_status: "pending" | "reviewed";
  created_at: string;
};

function statusTone(status: string): string {
  if (status === "active" || status === "delivered") return "border-green-200 bg-green-50 text-green-700";
  if (status === "pending" || status === "assigned") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-gray-200 bg-gray-100 text-gray-600";
}

function titleCase(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatNaira(value: number): string {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 }).format(Number(value) || 0);
}

export default function AgentPortalPage() {
  const session = useStaffSession("agent", "/agent");
  const [origin, setOrigin] = useState("");
  const [vendors, setVendors] = useState<ReferredVendor[]>([]);
  const [profile, setProfile] = useState<DeliveryProfile | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryOrder[]>([]);
  const [area, setArea] = useState({ state: "", lga: "", town: "", phone: "" });
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [savingArea, setSavingArea] = useState(false);
  const [busyOrder, setBusyOrder] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [reports, setReports] = useState<VerificationReport[]>([]);
  const [reportVendorId, setReportVendorId] = useState("");
  const [reportForm, setReportForm] = useState({
    identityConfirmed: false,
    locationConfirmed: false,
    productsConfirmed: false,
    recommendation: "follow_up" as VerificationReport["recommendation"],
    notes: "",
  });
  const [reportNotice, setReportNotice] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);
  const [submittingReport, setSubmittingReport] = useState(false);

  useEffect(() => {
    if (!session.authorized || !session.userId) return;
    let active = true;

    (async () => {
      try {
        const pageOrigin = window.location.origin;
        const [
          { data, error: vendorsError },
          { data: auth, error: authError },
        ] = await Promise.all([
          supabase.from("vendor_profiles")
            .select("id, business_name, status, verified, state, town, created_at")
            .eq("agent_id", session.userId)
            .order("created_at", { ascending: false }),
          supabase.auth.getSession(),
        ]);

        if (vendorsError) throw new Error("Could not load your referred vendors.");
        if (authError) throw new Error("Could not verify your staff session.");
        if (!active) return;
        setOrigin(pageOrigin);
        setVendors((data as ReferredVendor[]) ?? []);

        if (auth.session) {
          const response = await fetch("/api/agent/deliveries", {
            headers: { Authorization: `Bearer ${auth.session.access_token}` },
          });
          const payload = await response.json().catch(() => null) as
            | { profile?: DeliveryProfile | null; deliveries?: DeliveryOrder[]; error?: string }
            | null;
          if (!active) return;
          if (response.ok && payload) {
            const saved = payload.profile ?? null;
            setProfile(saved);
            setArea({
              state: saved?.state ?? "",
              lga: saved?.lga ?? "",
              town: saved?.town ?? "",
              phone: saved?.phone ?? "",
            });
            setDeliveries(payload.deliveries ?? []);
          } else {
            setError(payload?.error ?? "Could not load delivery tasks.");
          }
        }
      } catch (caught) {
        if (active) {
          console.error("Agent workspace load error:", caught);
          setError(caught instanceof Error ? caught.message : "Could not load your agent workspace.");
        }
      } finally {
        if (active) setLoaded(true);
      }
    })();

    return () => { active = false; };
  }, [session.authorized, session.userId]);

  useEffect(() => {
    if (!session.authorized) return;
    let active = true;

    async function loadReports() {
      try {
        const { data: auth, error: authError } = await supabase.auth.getSession();
        if (authError) throw new Error("Could not verify your staff session.");
        if (!auth.session) throw new Error("Your session expired. Sign in again to view field reports.");

        const response = await fetch("/api/agent/reports", {
          headers: { Authorization: `Bearer ${auth.session.access_token}` },
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as
          | { reports?: VerificationReport[]; error?: string }
          | null;
        if (!active) return;
        if (!response.ok || !payload?.reports) {
          throw new Error(payload?.error ?? "Could not load field reports.");
        }
        setReports(payload.reports);
      } catch (caught) {
        if (active) {
          setReportNotice({
            kind: "error",
            message: caught instanceof Error ? caught.message : "Could not load field reports.",
          });
        }
      }
    }

    void loadReports();
    return () => {
      active = false;
    };
  }, [session.authorized]);

  const referralLink = origin && session.userId ? `${origin}/vendor/register?ref=${session.userId}` : "";
  const pending = vendors.filter((vendor) => vendor.status === "pending").length;
  const active = vendors.filter((vendor) => vendor.status === "active").length;
  const assignedCount = deliveries.filter((delivery) => delivery.delivery_status !== "delivered").length;

  async function authenticatedPost(body: Record<string, unknown>) {
    const { data: { session: authSession } } = await supabase.auth.getSession();
    if (!authSession) throw new Error("Your session expired. Please sign in again.");
    const response = await fetch("/api/agent/deliveries", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authSession.access_token}`,
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null) as
      | { ok?: boolean; error?: string; profile?: DeliveryProfile; assigned?: number; delivery?: { id: string; delivery_status: string } }
      | null;
    if (!response.ok) throw new Error(payload?.error ?? "The request could not be completed.");
    if (!payload) throw new Error("The server returned an invalid response.");
    return payload;
  }

  async function copyLink() {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      setError("Could not copy the referral link. Select and copy the link from the field above.");
    }
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReportNotice(null);
    setSubmittingReport(true);

    try {
      const { data: auth, error: authError } = await supabase.auth.getSession();
      if (authError) throw new Error("Could not verify your staff session.");
      if (!auth.session) throw new Error("Your session expired. Sign in again and retry.");

      const response = await fetch("/api/agent/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.session.access_token}`,
        },
        body: JSON.stringify({ vendorId: reportVendorId, ...reportForm }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { report?: VerificationReport; error?: string }
        | null;
      if (!response.ok || !payload?.report) {
        throw new Error(payload?.error ?? "Could not submit the field report.");
      }

      setReports((current) => [payload.report!, ...current]);
      setReportVendorId("");
      setReportForm({
        identityConfirmed: false,
        locationConfirmed: false,
        productsConfirmed: false,
        recommendation: "follow_up",
        notes: "",
      });
      setReportNotice({ kind: "success", message: "Field report submitted for admin review." });
    } catch (caught) {
      setReportNotice({
        kind: "error",
        message: caught instanceof Error ? caught.message : "Network error while submitting the field report.",
      });
    } finally {
      setSubmittingReport(false);
    }
  }

  async function saveArea(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingArea(true);
    setMessage("");
    setError("");
    try {
      const result = await authenticatedPost({ action: "save_area", ...area });
      setProfile(result.profile ?? null);
      setMessage(`Delivery area saved. ${result.assigned ?? 0} waiting order(s) matched to your area.`);
      try {
        const { data: { session: authSession }, error: authError } = await supabase.auth.getSession();
        if (authError) throw new Error("Could not verify your staff session.");
        if (authSession) {
          const response = await fetch("/api/agent/deliveries", {
            headers: { Authorization: `Bearer ${authSession.access_token}` },
          });
          const payload = await response.json().catch(() => null) as
            | { deliveries?: DeliveryOrder[]; error?: string }
            | null;
          if (!response.ok || !payload) {
            throw new Error(payload?.error ?? "Could not reload delivery tasks.");
          }
          setDeliveries(payload.deliveries ?? []);
        }
      } catch (caught) {
        const detail = caught instanceof Error ? caught.message : "Could not reload delivery tasks.";
        setError(`Your area was saved, but deliveries could not be refreshed. ${detail}`);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save delivery area.");
    } finally {
      setSavingArea(false);
    }
  }

  async function updateDelivery(order: DeliveryOrder, status: string) {
    setBusyOrder(order.id);
    setMessage("");
    setError("");
    try {
      await authenticatedPost({ orderId: order.id, status });
      setDeliveries((current) => current.map((item) => item.id === order.id ? { ...item, delivery_status: status } : item));
      setMessage(`Order #${order.id.slice(0, 8).toUpperCase()} updated to ${titleCase(status)}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update delivery.");
    } finally {
      setBusyOrder("");
    }
  }

  function nextAction(order: DeliveryOrder): { status: string; label: string } | null {
    if (order.delivery_status === "assigned") return { status: "picked_up", label: "Confirm pickup" };
    if (order.delivery_status === "picked_up") return { status: "in_transit", label: "Start delivery" };
    if (order.delivery_status === "in_transit") return { status: "delivered", label: "Mark delivered" };
    return null;
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-green-700">FIDWEL</Link>
          <span className="text-sm text-gray-500">Agent portal</span>
        </div>
      </nav>

      <section className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-bold">Agent workspace</h1>
        <p className="mt-2 text-gray-600">Manage your delivery area, update customer deliveries, and keep your vendor referrals.</p>

        {session.loading ? (
          <p className="mt-8 text-gray-500">Checking access...</p>
        ) : !session.authorized ? (
          <div className="mt-8 rounded-2xl bg-white p-10 text-center shadow-sm">
            <h2 className="text-xl font-bold">Agents only</h2>
            <p className="mt-2 text-gray-600">Your account is not set up as an agent.</p>
            <Link href="/" className="mt-6 inline-block rounded-xl bg-green-700 px-5 py-3 font-semibold text-white hover:bg-green-800">Back to marketplace</Link>
          </div>
        ) : (
          <>
            {error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>}
            {message && <div role="status" className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-green-800">{message}</div>}

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-gray-500">Active delivery tasks</p><p className="mt-2 text-3xl font-bold">{assignedCount}</p></div>
              <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-gray-500">Referred vendors</p><p className="mt-2 text-3xl font-bold">{vendors.length}</p></div>
              <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-gray-500">Active referred vendors</p><p className="mt-2 text-3xl font-bold text-green-700">{active}</p></div>
            </div>

            <div className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold">Your delivery service area</h2>
              <p className="mt-1 text-sm text-gray-600">FIDWEL matches paid orders to an active agent by state and LGA. A town-specific match is preferred when available. Use the same spelling customers enter at checkout.</p>
              <form onSubmit={saveArea} className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium">State *
                  <input required maxLength={100} value={area.state} onChange={(e) => setArea({ ...area, state: e.target.value })} className="mt-1 w-full rounded-xl border px-3 py-3 font-normal" placeholder="e.g. Delta" />
                </label>
                <label className="text-sm font-medium">Local Government Area (LGA) *
                  <input required maxLength={100} value={area.lga} onChange={(e) => setArea({ ...area, lga: e.target.value })} className="mt-1 w-full rounded-xl border px-3 py-3 font-normal" placeholder="e.g. Warri South" />
                </label>
                <label className="text-sm font-medium">Town (optional)
                  <input maxLength={100} value={area.town} onChange={(e) => setArea({ ...area, town: e.target.value })} className="mt-1 w-full rounded-xl border px-3 py-3 font-normal" placeholder="e.g. Effurun" />
                </label>
                <label className="text-sm font-medium">Delivery phone (optional)
                  <input maxLength={40} value={area.phone} onChange={(e) => setArea({ ...area, phone: e.target.value })} className="mt-1 w-full rounded-xl border px-3 py-3 font-normal" placeholder="Phone customers can call" />
                </label>
                <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
                  <button disabled={savingArea} className="rounded-xl bg-green-700 px-5 py-3 font-semibold text-white hover:bg-green-800 disabled:opacity-60">{savingArea ? "Saving..." : profile ? "Update service area" : "Activate delivery area"}</button>
                  {profile && <span className="text-sm text-green-700">Area active: {[profile.town, profile.lga, profile.state].filter(Boolean).join(", ")}</span>}
                </div>
              </form>
            </div>

            <div className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h2 className="text-xl font-bold">Assigned deliveries</h2><p className="mt-1 text-sm text-gray-600">Only paid orders assigned to your account appear here.</p></div>
                <button onClick={() => window.location.reload()} className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-gray-50">Refresh</button>
              </div>
              {!loaded ? <p className="mt-5 text-gray-500">Loading deliveries...</p> : deliveries.length === 0 ? (
                <div className="mt-5 rounded-xl bg-gray-50 p-6 text-sm text-gray-600">No deliveries assigned yet. Save your service area above; matching paid orders will appear here.</div>
              ) : (
                <div className="mt-5 space-y-4">
                  {deliveries.map((order) => {
                    const action = nextAction(order);
                    return <article key={order.id} className="rounded-xl border p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div><h3 className="font-bold">Order #{order.id.slice(0, 8).toUpperCase()}</h3><p className="mt-1 text-xs text-gray-500">{new Date(order.created_at).toLocaleString("en-NG")}</p></div>
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(order.delivery_status)}`}>{titleCase(order.delivery_status)}</span>
                      </div>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div className="text-sm"><p className="font-semibold">{order.contact_name || "Customer"} · {order.contact_phone || "No phone"}</p><p className="mt-1 text-gray-600">{order.delivery_address}</p><p className="text-gray-600">{[order.delivery_town, order.delivery_lga, order.delivery_state].filter(Boolean).join(", ")}</p>{order.notes && <p className="mt-2 text-gray-500">Note: {order.notes}</p>}</div>
                        <div className="rounded-lg bg-gray-50 p-3 text-sm"><p>Order total: <strong>{formatNaira(order.total)}</strong></p><p className="mt-1">Delivery fee: <strong>{formatNaira(order.delivery_fee)}</strong></p><p className="mt-1">Payment: <strong className="text-green-700">Paid</strong></p></div>
                      </div>
                      {action ? <button disabled={busyOrder === order.id} onClick={() => void updateDelivery(order, action.status)} className="mt-4 rounded-xl bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-60">{busyOrder === order.id ? "Updating..." : action.label}</button> : <p className="mt-4 text-sm font-semibold text-green-700">Delivery completed</p>}
                    </article>;
                  })}
                </div>
              )}
            </div>

            <div className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold">Vendor referral link</h2>
              <p className="mt-1 text-sm text-gray-600">Your existing vendor acquisition link still works.</p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <input readOnly value={referralLink} onFocus={(event) => event.target.select()} className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-700" />
                <button onClick={() => void copyLink()} className="shrink-0 rounded-xl bg-green-700 px-5 py-3 font-semibold text-white hover:bg-green-800">{copied ? "Copied" : "Copy link"}</button>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-gray-50 p-4"><p className="text-sm text-gray-500">Referred vendors</p><p className="mt-1 text-2xl font-bold">{vendors.length}</p></div>
                <div className="rounded-xl bg-gray-50 p-4"><p className="text-sm text-gray-500">Pending</p><p className="mt-1 text-2xl font-bold text-amber-600">{pending}</p></div>
                <div className="rounded-xl bg-gray-50 p-4"><p className="text-sm text-gray-500">Active</p><p className="mt-1 text-2xl font-bold text-green-700">{active}</p></div>
              </div>
              {vendors.length === 0 ? <p className="mt-4 text-sm text-gray-500">No one has registered through your link yet.</p> : <ul className="mt-4 divide-y">{vendors.map((vendor) => <li key={vendor.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-semibold">{vendor.business_name}</p><p className="text-sm text-gray-500">{[vendor.town, vendor.state].filter(Boolean).join(", ") || "Location not provided"}</p></div><span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold capitalize ${statusTone(vendor.status)}`}>{vendor.status}</span></li>)}</ul>}
            </div>

            <div className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold">Vendor field verification</h2>
              <p className="mt-1 text-sm text-gray-600">
                Submit factual checks for vendors you referred. An admin makes the final approval decision.
              </p>
              {reportNotice && (
                <p
                  role={reportNotice.kind === "error" ? "alert" : "status"}
                  className={`mt-3 rounded-lg p-3 text-sm ${
                    reportNotice.kind === "error"
                      ? "bg-red-50 text-red-800"
                      : "bg-green-50 text-green-800"
                  }`}
                >
                  {reportNotice.message}
                </p>
              )}
              {vendors.filter((vendor) => vendor.status === "pending").length === 0 ? (
                <p className="mt-4 text-sm text-gray-500">No pending referred vendors need a field report.</p>
              ) : (
                <form onSubmit={submitReport} className="mt-5 space-y-4">
                  <label className="block text-sm font-medium">
                    Referred vendor
                    <select
                      required
                      value={reportVendorId}
                      onChange={(event) => setReportVendorId(event.target.value)}
                      className="mt-1 w-full rounded-lg border bg-white px-3 py-2"
                    >
                      <option value="">Select a pending vendor</option>
                      {vendors.filter((vendor) => vendor.status === "pending").map((vendor) => (
                        <option key={vendor.id} value={vendor.id}>{vendor.business_name}</option>
                      ))}
                    </select>
                  </label>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {([
                      ["identityConfirmed", "Business identity checked"],
                      ["locationConfirmed", "Business location checked"],
                      ["productsConfirmed", "Products or stock checked"],
                    ] as const).map(([field, label]) => (
                      <label key={field} className="flex items-start gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={reportForm[field]}
                          onChange={(event) => setReportForm((current) => ({
                            ...current,
                            [field]: event.target.checked,
                          }))}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  <label className="block text-sm font-medium">
                    Recommendation
                    <select
                      value={reportForm.recommendation}
                      onChange={(event) => setReportForm((current) => ({
                        ...current,
                        recommendation: event.target.value as VerificationReport["recommendation"],
                      }))}
                      className="mt-1 w-full rounded-lg border bg-white px-3 py-2"
                    >
                      <option value="approve">Recommend approval</option>
                      <option value="follow_up">Follow up required</option>
                      <option value="reject">Recommend rejection</option>
                    </select>
                  </label>
                  <label className="block text-sm font-medium">
                    Visit notes
                    <textarea
                      value={reportForm.notes}
                      onChange={(event) => setReportForm((current) => ({
                        ...current,
                        notes: event.target.value,
                      }))}
                      maxLength={2000}
                      rows={3}
                      className="mt-1 w-full rounded-lg border bg-white px-3 py-2"
                      placeholder="Record factual observations for admin review."
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={submittingReport}
                    className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {submittingReport ? "Submitting..." : "Submit for admin review"}
                  </button>
                </form>
              )}
              {reports.length > 0 && (
                <ul className="mt-5 divide-y border-t">
                  {reports.map((report) => {
                    const vendor = vendors.find((item) => item.id === report.vendor_id);
                    return (
                      <li key={report.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                        <span>{vendor?.business_name ?? "Referred vendor"} · {titleCase(report.recommendation)}</span>
                        <span className="text-gray-500">
                          {titleCase(report.review_status)} · {new Date(report.created_at).toLocaleDateString("en-NG")}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
