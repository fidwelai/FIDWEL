export const DELIVERY_FEE = 1500;
export const FREE_DELIVERY_THRESHOLD = 25000;

// Unpaid orders older than this are considered abandoned and are cancelled by
// the maintenance cron job (and flagged on the admin dashboard).
export const STALE_UNPAID_ORDER_HOURS = 48;

export function computeDeliveryFee(subtotal: number): number {
  if (subtotal <= 0) {
    return 0;
  }
  return subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
}

export function computeOrderTotal(subtotal: number): number {
  return subtotal + computeDeliveryFee(subtotal);
}

export function formatNaira(amount: number | string): string {
  return `₦${Number(amount).toLocaleString("en-NG")}`;
}

export const ORDER_TIMELINE = [
  "pending",
  "paid",
  "processing",
  "shipped",
  "delivered",
] as const;

export type OrderStatus =
  | "pending"
  | "paid"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending payment",
  paid: "Paid",
  processing: "Processing",
  shipped: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

const STATUS_TONES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  processing: "bg-sky-50 text-sky-700 border-sky-200",
  shipped: "bg-indigo-50 text-indigo-700 border-indigo-200",
  delivered: "bg-green-50 text-green-700 border-green-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
  refunded: "bg-gray-100 text-gray-600 border-gray-200",
};

export function orderStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function orderStatusTone(status: string): string {
  return STATUS_TONES[status] ?? "bg-gray-100 text-gray-600 border-gray-200";
}

export function isYielding(status: string): boolean {
  return status === "cancelled" || status === "refunded";
}

export const FULFILLMENT_TIMELINE = [
  "pending",
  "processing",
  "shipped",
  "delivered",
] as const;

export type FulfillmentStatus =
  | "pending"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

const FULFILLMENT_LABELS: Record<string, string> = {
  pending: "New",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const FULFILLMENT_TONES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  processing: "bg-sky-50 text-sky-700 border-sky-200",
  shipped: "bg-indigo-50 text-indigo-700 border-indigo-200",
  delivered: "bg-green-50 text-green-700 border-green-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

export function fulfillmentLabel(status: string): string {
  return FULFILLMENT_LABELS[status] ?? status;
}

export function fulfillmentTone(status: string): string {
  return FULFILLMENT_TONES[status] ?? "bg-gray-100 text-gray-600 border-gray-200";
}
