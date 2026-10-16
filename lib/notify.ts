import { supabaseAdmin } from "@/lib/supabase-admin";
import { renderEmail, sendEmail, type EmailInput } from "@/lib/email";

export const NOTIFICATION_TYPES = {
  orderPlaced: "order_placed",
  orderPaid: "order_paid",
  vendorApproved: "vendor_approved",
  vendorRejected: "vendor_rejected",
  subscriptionActive: "subscription_active",
} as const;

type CreateNotificationInput = {
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string | null;
  email?: EmailInput | null;
};

// Writes an in-app notification and (optionally) sends an email. This is
// best-effort: it never throws, so a missing table, missing email config, or a
// provider outage can never break the order/payment flow that triggered it.
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  if (!supabaseAdmin) {
    return;
  }

  try {
    await supabaseAdmin.from("notifications").insert({
      user_id: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link ?? null,
    });
  } catch {
    // Ignore — the notification inbox is not worth failing a checkout over.
  }

  if (input.email?.to) {
    await sendEmail(input.email);
  }
}

export async function emailForUser(userId: string): Promise<string | null> {
  if (!supabaseAdmin) {
    return null;
  }

  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (error || !data.user) {
      return null;
    }
    return data.user.email ?? null;
  } catch {
    return null;
  }
}

function naira(value: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function shortId(id: string): string {
  return `#${id.slice(0, 8)}`;
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "";
}

function actionFor(link: string, label: string) {
  const base = siteUrl();
  return base ? { label, url: `${base.replace(/\/$/, "")}${link}` } : undefined;
}

export async function notifyOrderPlaced(input: {
  userId: string;
  email?: string | null;
  orderId: string;
  total: number;
}): Promise<void> {
  const link = `/orders/${input.orderId}`;
  const body = `We received your order ${shortId(input.orderId)} for ${naira(
    input.total
  )}. Complete payment to confirm it.`;

  await createNotification({
    userId: input.userId,
    type: NOTIFICATION_TYPES.orderPlaced,
    title: "Order received",
    body,
    link,
    email: input.email
      ? {
          to: input.email,
          subject: "Your FIDWEL order was received",
          html: renderEmail({
            heading: "Order received",
            lines: [body, "We will notify you as soon as your payment is confirmed."],
            action: actionFor(link, "View your order"),
          }),
        }
      : null,
  });
}

export async function notifyOrderPaid(input: {
  userId: string;
  email?: string | null;
  orderId: string;
  total: number;
}): Promise<void> {
  const link = `/orders/${input.orderId}`;
  const body = `Your payment of ${naira(
    input.total
  )} for order ${shortId(input.orderId)} is confirmed. The vendor has been notified to prepare your items.`;

  await createNotification({
    userId: input.userId,
    type: NOTIFICATION_TYPES.orderPaid,
    title: "Payment confirmed",
    body,
    link,
    email: input.email
      ? {
          to: input.email,
          subject: "Payment confirmed for your FIDWEL order",
          html: renderEmail({
            heading: "Payment confirmed",
            lines: [body],
            action: actionFor(link, "Track your order"),
          }),
        }
      : null,
  });
}

export async function notifyVendorDecision(input: {
  userId: string;
  email?: string | null;
  businessName: string;
  approved: boolean;
}): Promise<void> {
  const link = "/vendor-dashboard";
  const title = input.approved ? "Vendor account approved" : "Vendor registration rejected";
  const body = input.approved
    ? `Congratulations — ${input.businessName} is now approved. You can publish products on the FIDWEL marketplace.`
    : `Your vendor registration for ${input.businessName} was not approved. Reply to this message if you think this is a mistake.`;

  await createNotification({
    userId: input.userId,
    type: input.approved
      ? NOTIFICATION_TYPES.vendorApproved
      : NOTIFICATION_TYPES.vendorRejected,
    title,
    body,
    link,
    email: input.email
      ? {
          to: input.email,
          subject: input.approved
            ? "Your FIDWEL vendor account is approved"
            : "About your FIDWEL vendor registration",
          html: renderEmail({
            heading: title,
            lines: [body],
            action: actionFor(link, "Open vendor dashboard"),
          }),
        }
      : null,
  });
}

export async function notifySubscriptionActive(input: {
  userId: string;
  email?: string | null;
  planName: string;
  periodEnd?: string | null;
}): Promise<void> {
  const link = "/vendor/subscription";
  const until = input.periodEnd
    ? ` Your plan is active until ${new Date(input.periodEnd).toLocaleDateString("en-NG", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })}.`
    : "";
  const body = `Your ${input.planName} plan is active.${until}`;

  await createNotification({
    userId: input.userId,
    type: NOTIFICATION_TYPES.subscriptionActive,
    title: "Subscription active",
    body,
    link,
    email: input.email
      ? {
          to: input.email,
          subject: `Your FIDWEL ${input.planName} plan is active`,
          html: renderEmail({
            heading: "Subscription active",
            lines: [body],
            action: actionFor(link, "Manage subscription"),
          }),
        }
      : null,
  });
}
