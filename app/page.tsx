"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { resolveAccountDestination } from "@/lib/account";
import { useCart } from "@/lib/cart";

const THEME_EVENT = "fidwel-theme-change";

function subscribeTheme(callback: () => void) {
  window.addEventListener(THEME_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(THEME_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getThemeSnapshot() {
  return document.documentElement.classList.contains("dark");
}

function getThemeServerSnapshot() {
  return false;
}

type Product = {
  id: number;
  name: string;
  price: number;
  unit: string;
  image_url: string | null;
  location?: string;
};

type CategoryItem = {
  name: string;
  iconType: string;
};

const DEFAULT_CATEGORIES: CategoryItem[] = [
  { name: "Plantain", iconType: "plantain" },
  { name: "Fish", iconType: "fish" },
  { name: "Yam", iconType: "yam" },
  { name: "Cassava", iconType: "cassava" },
  { name: "Vegetables", iconType: "vegetables" },
  { name: "Fruits", iconType: "fruits" },
  { name: "Meat", iconType: "meat" },
  { name: "More", iconType: "more" },
];

function normalizeUnit(name: string, unit: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("plantain") || lower.includes("cassava")) {
    return "kg";
  }
  return unit;
}

const DEFAULT_FEATURED: Product[] = [
  {
    id: 101,
    name: "Fresh Plantains",
    price: 3500,
    unit: "kg",
    image_url: "/images/plantain.jpg",
  },
  {
    id: 102,
    name: "Fresh Farm Catfish",
    price: 5200,
    unit: "kg",
    image_url: "/images/fish.jpg",
  },
  {
    id: 103,
    name: "Fresh Cassava",
    price: 2200,
    unit: "kg",
    image_url: "/images/tubers.jpg",
  },
  {
    id: 104,
    name: "Organic Tuber Yams",
    price: 4500,
    unit: "tuber",
    image_url: "/images/tubers.jpg",
  },
];

export default function Home() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("Lagos, Nigeria");
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>(DEFAULT_FEATURED);
  const {
    items: cart,
    count: totalCartCount,
    subtotal,
    addItem,
    updateQuantity,
    removeItem,
  } = useCart();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const isDarkMode = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getThemeServerSnapshot
  );
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"home" | "categories" | "cart" | "orders" | "profile">("home");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [accountDestination, setAccountDestination] = useState("/login");
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [staffRole, setStaffRole] = useState<"admin" | "agent" | null>(null);

  // Load Theme Preference (the DOM class is the source of truth; the toggle
  // re-reads it via useSyncExternalStore, so this effect only applies it once).
  useEffect(() => {
    const savedTheme = localStorage.getItem("fidwel_theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldBeDark = savedTheme ? savedTheme === "dark" : prefersDark;

    if (shouldBeDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  // Load Auth Session
  useEffect(() => {
    async function loadAccountDestination() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUserEmail(user?.email ?? null);
      setAvatarUrl(user?.user_metadata?.avatar_url ?? null);

      if (!user) {
        setAccountDestination("/login");
        setUnreadNotifications(0);
        return;
      }

      setAccountDestination(await resolveAccountDestination(user));

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        return;
      }

      const authHeader = { Authorization: `Bearer ${session.access_token}` };

      const [notificationsResponse, adminResponse] = await Promise.all([
        fetch("/api/notifications?unread=1&limit=1", {
          headers: authHeader,
          cache: "no-store",
        }),
        fetch("/api/admin/session", {
          headers: authHeader,
          cache: "no-store",
        }),
      ]);

      const notificationsPayload = (await notificationsResponse
        .json()
        .catch(() => null)) as { unread?: number } | null;

      setUnreadNotifications(Number(notificationsPayload?.unread ?? 0));

      const adminPayload = (await adminResponse.json().catch(() => null)) as
        | { isAdmin?: boolean }
        | null;

      if (adminPayload?.isAdmin) {
        setStaffRole("admin");
        return;
      }

      const agentResponse = await fetch("/api/agent/session", {
        headers: authHeader,
        cache: "no-store",
      });

      const agentPayload = (await agentResponse.json().catch(() => null)) as
        | { isAgent?: boolean }
        | null;

      if (agentPayload?.isAgent) {
        setStaffRole("agent");
      }
    }

    void loadAccountDestination();
  }, []);

  function toggleTheme() {
    const next = !document.documentElement.classList.contains("dark");
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("fidwel_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("fidwel_theme", "light");
    }
    window.dispatchEvent(new Event(THEME_EVENT));
  }

  // Load Products from Supabase or Fallback
  useEffect(() => {
    async function loadData() {
      try {
        const { data: prods } = await supabase
          .from("products")
          .select("id, name, price, unit, image_url")
          .eq("is_available", true)
          .eq("approval_status", "approved")
          .limit(8);

        if (prods && prods.length > 0) {
          const normalized = prods.map((p) => ({
            ...p,
            unit: normalizeUnit(p.name, p.unit),
          }));
          setFeaturedProducts(normalized);
        }
      } catch {
        // Fallback to default
      }
    }

    loadData();
  }, []);

  // Cart operations
  function addToCart(product: Product) {
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      unit: normalizeUnit(product.name, product.unit),
      image_url: product.image_url || "/images/plantain.jpg",
    });
    setIsCartOpen(true);
  }

  const deliveryFee = subtotal > 0 ? (subtotal >= 25000 ? 0 : 1500) : 0;
  const orderTotal = subtotal + deliveryFee;

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchTerm.trim()) params.set("q", searchTerm.trim());
    if (selectedLocation) params.set("location", selectedLocation);
    router.push(`/products?${params.toString()}`);
  }

  function handleCategoryClick(catName: string) {
    if (catName === "More") {
      router.push("/products");
      return;
    }
    router.push(`/products?q=${encodeURIComponent(catName)}`);
  }

  return (
    <div className={`min-h-screen w-full font-sans flex flex-col transition-colors duration-200 ${
      isDarkMode ? "bg-slate-950 text-slate-100" : "bg-gray-50/70 text-gray-900"
    }`}>
      {/* TOP HEADER */}
      <header className={`w-full sticky top-0 z-40 transition-colors duration-200 border-b ${
        isDarkMode
          ? "bg-slate-900/95 border-slate-800 text-white backdrop-blur-md"
          : "bg-white/95 border-gray-100 text-gray-900 backdrop-blur-md shadow-xs"
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
          {/* Logo with Green Leaf */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="w-8 h-8 rounded-xl bg-green-700 flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A9.49 9.49 0 0 0 12 21c7 0 11-8 11-15 0-3-2-5-5-5-4 0-7 2-8 5 .9-1.2 2.5-2 4-2 3.8 0 7 3.2 7 7-3 0-5.5-1.5-7-4 0 2 1.5 5 3 6z" />
              </svg>
            </div>
            <span className="font-extrabold text-2xl tracking-tight text-green-700">
              FIDWEL
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold">
            <Link href="/" className="text-green-700 font-bold hover:text-green-800 transition">
              Home
            </Link>
            <Link
              href="/products"
              className={`transition hover:text-green-700 ${
                isDarkMode ? "text-slate-300" : "text-gray-600"
              }`}
            >
              Marketplace
            </Link>
            <Link
              href="/products"
              className={`transition hover:text-green-700 ${
                isDarkMode ? "text-slate-300" : "text-gray-600"
              }`}
            >
              Categories
            </Link>
            <Link
              href="/vendor/register"
              className={`transition hover:text-green-700 ${
                isDarkMode ? "text-slate-300" : "text-gray-600"
              }`}
            >
              Become a Vendor
            </Link>
            {staffRole && (
              <Link
                href={staffRole === "admin" ? "/admin" : "/agent"}
                className="inline-flex items-center gap-1.5 rounded-full bg-green-700 px-3.5 py-1.5 text-white font-bold hover:bg-green-800 transition"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                  />
                </svg>
                {staffRole === "admin" ? "Admin" : "Agent"}
              </Link>
            )}
          </nav>

          {/* Actions & Utilities */}
          <div className="flex items-center gap-2 sm:gap-3.5">
            {/* Location selector on header */}
            <button
              onClick={() => setShowLocationModal(true)}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                isDarkMode
                  ? "bg-slate-800 hover:bg-slate-700 text-slate-200"
                  : "bg-gray-100 hover:bg-gray-200/80 text-gray-700"
              }`}
            >
              <svg className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500 shrink-0" viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
              </svg>
              <span>{selectedLocation.split(",")[0]}</span>
              <span className="text-gray-400 text-[10px]">▼</span>
            </button>

            {/* LIGHT / DARK MODE TOGGLE */}
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-full transition flex items-center justify-center ${
                isDarkMode
                  ? "bg-slate-800 text-amber-300 hover:bg-slate-700"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              aria-label="Toggle Theme"
            >
              {isDarkMode ? (
                // Sun Icon
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="5" />
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
              ) : (
                // Moon Icon
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>

            {/* Quick Search */}
            <button
              onClick={() => router.push("/products")}
              className={`p-2 rounded-full transition ${
                isDarkMode
                  ? "text-slate-300 hover:text-green-500 hover:bg-slate-800"
                  : "text-gray-600 hover:text-green-700 hover:bg-gray-100"
              }`}
              aria-label="Search"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </button>

            {/* NOTIFICATIONS BELL */}
            {userEmail && (
              <Link
                href="/notifications"
                className={`relative p-2 rounded-full transition ${
                  isDarkMode
                    ? "text-slate-300 hover:text-green-500 hover:bg-slate-800"
                    : "text-gray-700 hover:text-green-700 hover:bg-gray-100"
                }`}
                aria-label="Notifications"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {unreadNotifications > 0 && (
                  <span className="absolute top-0.5 right-0.5 min-w-4 h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900">
                    {unreadNotifications > 9 ? "9+" : unreadNotifications}
                  </span>
                )}
              </Link>
            )}

            {/* CART BUTTON WITH DRAWER TRIGGER */}
            <button
              onClick={() => setIsCartOpen(true)}
              className={`relative p-2 rounded-full transition ${
                isDarkMode
                  ? "text-slate-300 hover:text-green-500 hover:bg-slate-800"
                  : "text-gray-700 hover:text-green-700 hover:bg-gray-100"
              }`}
              aria-label="Open Shopping Cart"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              {totalCartCount > 0 && (
                <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-emerald-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 animate-pulse">
                  {totalCartCount}
                </span>
              )}
            </button>

            {/* User Profile Avatar */}
            <Link
              href={accountDestination}
              className={`flex items-center gap-2 p-1 pl-1.5 rounded-full transition ${
                isDarkMode ? "hover:bg-slate-800" : "hover:bg-gray-100"
              }`}
              aria-label="User Account"
            >
              <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-sm font-bold shadow-xs overflow-hidden ${
                userEmail
                  ? "bg-green-100 border-green-300 text-green-800"
                  : "bg-amber-100 border-amber-300 text-amber-800"
              }`}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : userEmail ? (
                  userEmail[0].toUpperCase()
                ) : (
                  "🧑\u200d🌾"
                )}
              </div>
              <span className={`hidden lg:inline text-xs font-semibold ${
                isDarkMode ? "text-slate-300" : "text-gray-700"
              }`}>
                {userEmail ?? "Sign in"}
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* FULL-WIDTH RESPONSIVE BODY */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-8 sm:space-y-12 pb-24 md:pb-16">
        
        {/* HERO BANNER */}
        <section className="relative rounded-3xl overflow-hidden shadow-xl min-h-[260px] sm:min-h-[320px] md:min-h-[380px] flex flex-col justify-between p-6 sm:p-10 md:p-12 bg-green-950 text-white">
          {/* Background image */}
          <div
            className="absolute inset-0 bg-cover bg-center brightness-[0.72] transform scale-105 transition duration-700 hover:scale-100"
            style={{ backgroundImage: "url('/images/hero-banner.jpg')" }}
          />

          {/* Gradient Overlay for high-contrast legible text */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/35" />

          {/* Hero Headlines */}
          <div className="relative z-10 max-w-2xl">
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold leading-tight drop-shadow-md text-white">
              Fresh Agricultural Products Near You
            </h1>
            <p className="mt-2 sm:mt-3 text-xs sm:text-base text-white/90 drop-shadow font-medium max-w-lg">
              Quality food, Local vendors, Trusted agricultural marketplace.
            </p>
          </div>

          {/* SEARCH BAR */}
          <div className="relative z-10 mt-6 max-w-2xl">
            <form
              onSubmit={handleSearchSubmit}
              className={`rounded-full p-2 pl-4 flex items-center shadow-2xl border backdrop-blur-md gap-2 transition ${
                isDarkMode
                  ? "bg-slate-900/90 border-slate-700 text-white"
                  : "bg-white rounded-full border-white/50 text-gray-900"
              }`}
            >
              {/* Magnifying Glass */}
              <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>

              {/* Search Input */}
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search for product, farm, vendor..."
                className={`w-full bg-transparent px-2 py-1 text-xs sm:text-sm outline-none font-medium ${
                  isDarkMode
                    ? "text-white placeholder-slate-400"
                    : "text-gray-800 placeholder-gray-400"
                }`}
              />

              {/* Location Selector Chip */}
              <button
                type="button"
                onClick={() => setShowLocationModal(true)}
                className={`shrink-0 flex items-center gap-1.5 border rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  isDarkMode
                    ? "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
                    : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                }`}
              >
                <svg className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500" viewBox="0 0 24 24">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
                <span className="hidden sm:inline">{selectedLocation}</span>
                <span className="sm:hidden truncate max-w-[85px]">{selectedLocation.split(",")[0]}</span>
              </button>

              {/* Search Button for Desktop */}
              <button
                type="submit"
                className="hidden sm:inline-flex bg-green-700 hover:bg-green-800 text-white rounded-full px-5 py-2 text-xs font-bold transition shadow-sm"
              >
                Search
              </button>
            </form>

            {/* Sub-location indicator */}
            <div className="flex items-center gap-1.5 mt-3 text-xs sm:text-sm text-white/95 font-medium pl-2">
              <svg className="w-4 h-4 fill-current text-white shrink-0" viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
              </svg>
              <span>{selectedLocation}</span>
            </div>
          </div>
        </section>

        {/* CATEGORIES GRID */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className={`text-lg sm:text-xl font-extrabold tracking-tight ${
              isDarkMode ? "text-white" : "text-gray-900"
            }`}>
              Agricultural Categories
            </h2>
            <Link
              href="/products"
              className="text-xs sm:text-sm font-semibold text-green-600 hover:text-green-500 transition"
            >
              View all →
            </Link>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-8 gap-3 sm:gap-4 md:gap-5">
            {DEFAULT_CATEGORIES.map((cat) => (
              <button
                key={cat.name}
                onClick={() => handleCategoryClick(cat.name)}
                className={`flex flex-col items-center group transition active:scale-95 p-3 sm:p-4 rounded-2xl border shadow-xs hover:shadow-md ${
                  isDarkMode
                    ? "bg-slate-900 border-slate-800 hover:border-green-600 hover:bg-slate-800/80"
                    : "bg-white border-gray-100 hover:border-green-300 hover:bg-green-50/50"
                }`}
              >
                <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center p-2 transition ${
                  isDarkMode ? "bg-slate-800 group-hover:bg-slate-700" : "bg-gray-50 group-hover:bg-green-100/50"
                }`}>
                  <CategoryIcon type={cat.iconType} />
                </div>
                <span className={`mt-2 text-xs sm:text-sm font-semibold transition text-center truncate w-full ${
                  isDarkMode ? "text-slate-200 group-hover:text-green-400" : "text-gray-800 group-hover:text-green-700"
                }`}>
                  {cat.name}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* FEATURED PRODUCTS SECTION */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className={`text-lg sm:text-xl font-extrabold tracking-tight ${
                isDarkMode ? "text-white" : "text-gray-900"
              }`}>
                Featured Products
              </h2>
              <p className={`text-xs sm:text-sm mt-0.5 ${
                isDarkMode ? "text-slate-400" : "text-gray-500"
              }`}>
                Top picks directly from local farmers and vendors
              </p>
            </div>
            <Link
              href="/products"
              className="text-xs sm:text-sm font-semibold text-green-600 hover:text-green-500 transition"
            >
              See all products →
            </Link>
          </div>

          {/* Product cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {featuredProducts.map((item) => (
              <div
                key={item.id}
                className={`group rounded-2xl sm:rounded-3xl overflow-hidden border shadow-xs hover:shadow-xl transition duration-200 flex flex-col ${
                  isDarkMode
                    ? "bg-slate-900 border-slate-800 hover:border-slate-700"
                    : "bg-white border-gray-100 hover:border-gray-200"
                }`}
              >
                <div className="h-36 sm:h-48 w-full overflow-hidden bg-gray-100 dark:bg-slate-800 relative">
                  <img
                    src={item.image_url || "/images/plantain.jpg"}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                  <span className="absolute top-2.5 right-2.5 bg-emerald-600 text-white text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-full shadow-xs">
                    In Stock
                  </span>
                </div>
                <div className="p-3.5 sm:p-5 flex flex-col justify-between flex-1">
                  <div>
                    <h3 className={`text-xs sm:text-base font-bold line-clamp-1 group-hover:text-green-600 transition ${
                      isDarkMode ? "text-white" : "text-gray-900"
                    }`}>
                      {item.name}
                    </h3>
                    <p className="mt-1 text-sm sm:text-lg font-extrabold text-green-600 dark:text-green-400">
                      ₦{Number(item.price).toLocaleString("en-NG")}
                      <span className={`text-[11px] sm:text-xs font-normal ml-1 ${
                        isDarkMode ? "text-slate-400" : "text-gray-500"
                      }`}>
                        / {item.unit}
                      </span>
                    </p>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => addToCart(item)}
                      className="flex-1 rounded-xl bg-green-700 hover:bg-green-800 text-white py-2 px-3 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                      <span>Add to Cart</span>
                    </button>
                    <button
                      onClick={() => router.push(`/products?q=${encodeURIComponent(item.name)}`)}
                      className={`p-2 rounded-xl border transition flex items-center justify-center ${
                        isDarkMode
                          ? "border-slate-700 text-slate-300 hover:bg-slate-800"
                          : "border-gray-200 text-gray-700 hover:bg-gray-100"
                      }`}
                      title="View Details"
                    >
                      →
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

      </main>

      {/* FOOTER */}
      <footer className={`w-full border-t py-8 px-4 sm:px-8 mt-auto text-xs sm:text-sm transition-colors ${
        isDarkMode
          ? "bg-slate-950 border-slate-800 text-slate-400"
          : "bg-white border-gray-200 text-gray-500"
      }`}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-base text-green-700">FIDWEL</span>
            <span>• Nigeria&apos;s Agricultural Marketplace</span>
          </div>
          <div className={`flex gap-6 ${isDarkMode ? "text-slate-400" : "text-gray-600"}`}>
            <Link href="/products" className="hover:text-green-700 transition">Products</Link>
            <Link href="/vendor/register" className="hover:text-green-700 transition">Vendors</Link>
            <Link href="/notifications" className="hover:text-green-700 transition">Notifications</Link>
            <Link href="/login" className="hover:text-green-700 transition">Account</Link>
          </div>
          <div>© 2026 FIDWEL. All rights reserved.</div>
        </div>
      </footer>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className={`md:hidden fixed bottom-0 inset-x-0 border-t px-6 py-2.5 flex items-center justify-between shadow-[0_-4px_16px_rgba(0,0,0,0.08)] z-40 backdrop-blur-md transition-colors ${
        isDarkMode
          ? "bg-slate-900/95 border-slate-800 text-slate-400"
          : "bg-white/95 border-gray-200/80 text-gray-400"
      }`}>
        {/* 1. Home */}
        <button
          onClick={() => setActiveTab("home")}
          className={`flex flex-col items-center gap-1 transition ${
            activeTab === "home" ? "text-green-700 font-bold" : "hover:text-gray-600 dark:hover:text-slate-200"
          }`}
        >
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
          </svg>
          <span className="text-[10px]">Home</span>
        </button>

        {/* 2. Categories */}
        <button
          onClick={() => {
            setActiveTab("categories");
            router.push("/products");
          }}
          className={`flex flex-col items-center gap-1 transition ${
            activeTab === "categories" ? "text-green-700 font-bold" : "hover:text-gray-600 dark:hover:text-slate-200"
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
            <rect x="3" y="3" width="7" height="7" rx="2" />
            <rect x="14" y="3" width="7" height="7" rx="2" />
            <rect x="14" y="14" width="7" height="7" rx="2" />
            <rect x="3" y="14" width="7" height="7" rx="2" />
          </svg>
          <span className="text-[10px]">Categories</span>
        </button>

        {/* 3. Cart Trigger */}
        <button
          onClick={() => {
            setActiveTab("cart");
            setIsCartOpen(true);
          }}
          className={`flex flex-col items-center gap-1 transition relative ${
            activeTab === "cart" || isCartOpen ? "text-green-700 font-bold" : "hover:text-gray-600 dark:hover:text-slate-200"
          }`}
        >
          <div className="relative">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            {totalCartCount > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-emerald-600 text-white text-[9px] w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold">
                {totalCartCount}
              </span>
            )}
          </div>
          <span className="text-[10px]">Cart</span>
        </button>

        {/* 4. Orders */}
        <button
          onClick={() => {
            setActiveTab("orders");
            router.push("/orders");
          }}
          className={`flex flex-col items-center gap-1 transition ${
            activeTab === "orders" ? "text-green-700 font-bold" : "hover:text-gray-600 dark:hover:text-slate-200"
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <span className="text-[10px]">Orders</span>
        </button>

        {/* 5. Profile */}
        <button
          onClick={() => {
            setActiveTab("profile");
            router.push(accountDestination);
          }}
          className={`flex flex-col items-center gap-1 transition ${
            activeTab === "profile" ? "text-green-700 font-bold" : "hover:text-gray-600 dark:hover:text-slate-200"
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span className="text-[10px]">Profile</span>
        </button>
      </nav>

      {/* CART DRAWER */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-200">
          {/* Backdrop */}
          <div
            onClick={() => setIsCartOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
          />

          {/* Drawer container */}
          <div className={`relative w-full max-w-md h-full flex flex-col shadow-2xl z-10 transition-transform duration-300 animate-in slide-in-from-right ${
            isDarkMode ? "bg-slate-900 text-white border-l border-slate-800" : "bg-white text-gray-900"
          }`}>
            {/* Drawer Header */}
            <div className={`p-5 flex items-center justify-between border-b ${
              isDarkMode ? "border-slate-800" : "border-gray-100"
            }`}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-green-700 flex items-center justify-center text-white">
                  <svg className="w-4 h-4 fill-none stroke-current" strokeWidth="2.5" viewBox="0 0 24 24">
                    <circle cx="9" cy="21" r="1" />
                    <circle cx="20" cy="21" r="1" />
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-extrabold text-base">Your Cart</h2>
                  <p className="text-xs text-gray-400">
                    {totalCartCount} item{totalCartCount === 1 ? "" : "s"}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsCartOpen(false)}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition ${
                  isDarkMode ? "bg-slate-800 hover:bg-slate-700 text-slate-300" : "bg-gray-100 hover:bg-gray-200 text-gray-600"
                }`}
              >
                ✕
              </button>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-12">
                  <div className="text-5xl mb-3">🌾</div>
                  <h3 className="font-bold text-base mb-1">Your cart is empty</h3>
                  <p className="text-xs text-gray-400 max-w-xs mb-5">
                    Explore fresh agricultural produce from local farmers and vendors to get started!
                  </p>
                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="bg-green-700 hover:bg-green-800 text-white rounded-full px-5 py-2.5 text-xs font-bold transition"
                  >
                    Start Shopping
                  </button>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3.5 p-3 rounded-2xl border transition ${
                      isDarkMode
                        ? "bg-slate-800/60 border-slate-800"
                        : "bg-gray-50/70 border-gray-100"
                    }`}
                  >
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-16 h-16 rounded-xl object-cover shrink-0"
                    />

                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-xs truncate">{item.name}</h4>
                      <p className="text-xs font-bold text-green-600 dark:text-green-400 mt-0.5">
                        ₦{Number(item.price).toLocaleString("en-NG")}{" "}
                        <span className="font-normal text-[11px] text-gray-400">/ {item.unit}</span>
                      </p>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold transition ${
                            isDarkMode
                              ? "bg-slate-700 hover:bg-slate-600 text-white"
                              : "bg-white border hover:bg-gray-100 text-gray-800 shadow-xs"
                          }`}
                        >
                          -
                        </button>
                        <span className="text-xs font-bold px-1.5">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold transition ${
                            isDarkMode
                              ? "bg-slate-700 hover:bg-slate-600 text-white"
                              : "bg-white border hover:bg-gray-100 text-gray-800 shadow-xs"
                          }`}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="text-right flex flex-col justify-between items-end h-16">
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-gray-400 hover:text-red-500 text-xs transition"
                        title="Remove"
                      >
                        🗑️
                      </button>
                      <span className="font-extrabold text-xs">
                        ₦{(item.price * item.quantity).toLocaleString("en-NG")}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Drawer Footer with Calculations */}
            {cart.length > 0 && (
              <div className={`p-5 border-t space-y-3 ${
                isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-gray-100"
              }`}>
                <div className="space-y-1.5 text-xs text-gray-500 dark:text-slate-400">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-semibold text-gray-800 dark:text-slate-200">
                      ₦{subtotal.toLocaleString("en-NG")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Delivery ({selectedLocation.split(",")[0]})</span>
                    <span className="font-semibold text-gray-800 dark:text-slate-200">
                      {deliveryFee === 0 ? "Free" : `₦${deliveryFee.toLocaleString("en-NG")}`}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-100 dark:border-slate-800 text-sm font-extrabold text-gray-900 dark:text-white">
                    <span>Total</span>
                    <span className="text-green-600 dark:text-green-400">
                      ₦{orderTotal.toLocaleString("en-NG")}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setIsCartOpen(false);
                    router.push("/cart");
                  }}
                  className="w-full bg-green-700 hover:bg-green-800 text-white font-bold py-3 rounded-2xl text-xs sm:text-sm transition shadow-lg flex items-center justify-center gap-2"
                >
                  <span>Proceed to Checkout</span>
                  <span>(₦{orderTotal.toLocaleString("en-NG")})</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* LOCATION SELECTOR MODAL */}
      {showLocationModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className={`w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 ${
            isDarkMode ? "bg-slate-900 text-white" : "bg-white text-gray-900"
          }`}>
            <div className={`flex items-center justify-between pb-3 border-b ${
              isDarkMode ? "border-slate-800" : "border-gray-100"
            }`}>
              <h3 className="font-extrabold text-base">Select Your Location</h3>
              <button
                onClick={() => setShowLocationModal(false)}
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition ${
                  isDarkMode ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                ✕
              </button>
            </div>
            <div className="mt-4 space-y-2 max-h-[60vh] overflow-y-auto">
              {[
                "Lagos, Nigeria",
                "Abuja (FCT), Nigeria",
                "Ibadan, Oyo State",
                "Port Harcourt, Rivers",
                "Kano, Kano State",
                "Enugu, Enugu State",
                "Benin City, Edo State",
                "Kaduna, Kaduna State",
              ].map((loc) => (
                <button
                  key={loc}
                  onClick={() => {
                    setSelectedLocation(loc);
                    setShowLocationModal(false);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-2xl text-xs sm:text-sm font-semibold flex items-center justify-between transition ${
                    selectedLocation === loc
                      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800"
                      : isDarkMode
                      ? "hover:bg-slate-800 text-slate-200 border border-transparent"
                      : "hover:bg-gray-50 text-gray-700 border border-transparent"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-base">📍</span>
                    <span>{loc}</span>
                  </span>
                  {selectedLocation === loc && (
                    <span className="text-emerald-600 font-bold text-sm">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryIcon({ type }: { type: string }) {
  switch (type) {
    case "plantain":
      return (
        <span className="text-3xl sm:text-4xl filter drop-shadow-sm" role="img" aria-label="Plantain">
          🍌
        </span>
      );
    case "fish":
      return (
        <span className="text-3xl sm:text-4xl filter drop-shadow-sm" role="img" aria-label="Fish">
          🐟
        </span>
      );
    case "yam":
      return (
        <span className="text-3xl sm:text-4xl filter drop-shadow-sm" role="img" aria-label="Yam">
          🥔
        </span>
      );
    case "cassava":
      return (
        <span className="text-3xl sm:text-4xl filter drop-shadow-sm" role="img" aria-label="Cassava">
          🍠
        </span>
      );
    case "vegetables":
      return (
        <span className="text-3xl sm:text-4xl filter drop-shadow-sm" role="img" aria-label="Vegetables">
          🥬
        </span>
      );
    case "fruits":
      return (
        <span className="text-3xl sm:text-4xl filter drop-shadow-sm" role="img" aria-label="Fruits">
          🍊
        </span>
      );
    case "meat":
      return (
        <span className="text-3xl sm:text-4xl filter drop-shadow-sm" role="img" aria-label="Meat">
          🥩
        </span>
      );
    case "more":
      return (
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center">
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
          </div>
        </div>
      );
    default:
      return <span>🌱</span>;
  }
}
