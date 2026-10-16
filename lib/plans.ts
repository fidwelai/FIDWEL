export type PlanId = "free" | "starter" | "growth";

export type Plan = {
  id: PlanId;
  name: string;
  price: number;
  tagline: string;
  features: string[];
};

// PLACEHOLDER PRICING: monthly price in NGN per vendor. Edit the tiers here and
// the vendor subscription page and payment routes pick them up automatically.
export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    tagline: "Start selling on the marketplace.",
    features: [
      "Up to 5 product listings",
      "Basic order management",
      "Community support",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    price: 5000,
    tagline: "For vendors who are growing.",
    features: [
      "Up to 50 product listings",
      "Full order and delivery management",
      "Delivery tracking",
      "Email support",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    price: 15000,
    tagline: "For high-volume vendors.",
    features: [
      "Unlimited product listings",
      "Priority marketplace placement",
      "Advanced order management",
      "Priority support",
    ],
  },
];

export function getPlan(id: string): Plan | undefined {
  return PLANS.find((plan) => plan.id === id);
}

export function isPaidPlan(id: string): boolean {
  const plan = getPlan(id);
  return Boolean(plan && plan.price > 0);
}

export const PAID_PLANS: Plan[] = PLANS.filter((plan) => plan.price > 0);
