const STORAGE_KEY = "fidwel_sales_tracking";
const ATTRIBUTION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SalesAttribution = {
  trackingId: string;
  capturedAt: number;
};

export function rememberSalesTrackingId(value: string | null | undefined): void {
  if (!value || !UUID_PATTERN.test(value)) return;

  const attribution: SalesAttribution = {
    trackingId: value,
    capturedAt: Date.now(),
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(attribution));
}

export function getSalesTrackingId(): string | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }

  const value = parsed as { trackingId?: unknown; capturedAt?: unknown };
  if (
    typeof value.trackingId !== "string" ||
    typeof value.capturedAt !== "number"
  ) {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }

  const attribution: SalesAttribution = {
    trackingId: value.trackingId,
    capturedAt: value.capturedAt,
  };
  if (
    !UUID_PATTERN.test(attribution.trackingId) ||
    !Number.isFinite(attribution.capturedAt) ||
    attribution.capturedAt > Date.now() ||
    Date.now() - attribution.capturedAt > ATTRIBUTION_WINDOW_MS
  ) {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }

  return attribution.trackingId;
}
