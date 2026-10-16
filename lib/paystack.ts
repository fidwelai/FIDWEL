export type PaystackResponse = {
  reference: string;
  status?: string;
  message?: string;
};

export type PaystackOptions = {
  key: string;
  email: string;
  amount: number;
  currency?: string;
  ref?: string;
  metadata?: Record<string, unknown>;
  callback: (response: PaystackResponse) => void;
  onClose: () => void;
};

type PaystackHandler = {
  openIframe: () => void;
};

declare global {
  interface Window {
    PaystackPop?: {
      setup: (options: PaystackOptions) => PaystackHandler;
    };
  }
}

const SCRIPT_SRC = "https://js.paystack.co/v1/inline.js";

// Paystack rejects a reference that has already been used, so each payment
// attempt for an order needs its own unique reference. The order id is kept as
// a prefix so the charge can still be traced back to the order.
export function makeOrderReference(orderId: string): string {
  const stamp = Date.now().toString(36);
  const nonce = Math.random().toString(36).slice(2, 8);
  return `${orderId}-${stamp}-${nonce}`;
}

let scriptPromise: Promise<void> | null = null;

export function loadPaystack(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Paystack can only load in the browser."));
  }

  if (window.PaystackPop) {
    return Promise.resolve();
  }

  if (scriptPromise) {
    return scriptPromise;
  }

  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Could not load the payment library. Check your connection."));
    };
    document.body.appendChild(script);
  });

  return scriptPromise;
}
