"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

export type CartItem = {
  id: number;
  name: string;
  price: number;
  unit: string;
  image_url: string;
  quantity: number;
};

const STORAGE_KEY = "fidwel_cart";
const EMPTY: CartItem[] = [];

let snapshot: CartItem[] = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

function readStorage(): CartItem[] {
  if (typeof window === "undefined") {
    return EMPTY;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return EMPTY;
    }

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return EMPTY;
    }

    return parsed.filter(
      (item): item is CartItem =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as CartItem).id === "number" &&
        typeof (item as CartItem).price === "number" &&
        typeof (item as CartItem).quantity === "number" &&
        typeof (item as CartItem).name === "string"
    );
  } catch {
    return EMPTY;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): CartItem[] {
  if (!hydrated) {
    snapshot = readStorage();
    hydrated = true;
  }
  return snapshot;
}

function getServerSnapshot(): CartItem[] {
  return EMPTY;
}

function commit(next: CartItem[]): void {
  snapshot = next;

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage can be unavailable (private mode / quota); keep in-memory state.
    }
  }

  listeners.forEach((listener) => listener());
}

export function useCart() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const count = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items]
  );

  const addItem = useCallback(
    (item: Omit<CartItem, "quantity">, quantity = 1) => {
      const current = getSnapshot();
      const existing = current.find((entry) => entry.id === item.id);

      if (existing) {
        commit(
          current.map((entry) =>
            entry.id === item.id
              ? { ...entry, quantity: entry.quantity + quantity }
              : entry
          )
        );
      } else {
        commit([...current, { ...item, quantity }]);
      }
    },
    []
  );

  const updateQuantity = useCallback((id: number, delta: number) => {
    const current = getSnapshot();
    const next = current
      .map((entry) =>
        entry.id === id
          ? { ...entry, quantity: entry.quantity + delta }
          : entry
      )
      .filter((entry) => entry.quantity > 0);

    commit(next);
  }, []);

  const setQuantity = useCallback((id: number, quantity: number) => {
    const current = getSnapshot();
    if (quantity <= 0) {
      commit(current.filter((entry) => entry.id !== id));
      return;
    }

    commit(
      current.map((entry) =>
        entry.id === id ? { ...entry, quantity } : entry
      )
    );
  }, []);

  const removeItem = useCallback((id: number) => {
    commit(getSnapshot().filter((entry) => entry.id !== id));
  }, []);

  const clear = useCallback(() => {
    commit(EMPTY);
  }, []);

  return {
    items,
    count,
    subtotal,
    addItem,
    updateQuantity,
    setQuantity,
    removeItem,
    clear,
  };
}
