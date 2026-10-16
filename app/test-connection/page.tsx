"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
export default function TestConnectionPage() {
  const [status, setStatus] = useState("Testing connection...");
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    async function testConnection() {
      const { data, error } = await supabase
        .from("categories")
        .select("name")
        .order("name");

      if (error) {
  setStatus(`Connection query failed: ${error.message}`);
  return;
}

      setCategories(data.map((item) => item.name));
      setStatus("Connected successfully!");
    }

    testConnection();
  }, []);

  return (
    <main className="min-h-screen bg-green-50 p-8">
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-8 shadow">
        <h1 className="text-3xl font-bold text-green-800">
          FIDWEL Connection Test
        </h1>

        <p className="mt-4">{status}</p>

        <h2 className="mt-8 text-xl font-semibold">
          Product Categories
        </h2>

        {categories.length > 0 ? (
          <ul className="mt-4 list-inside list-disc space-y-2">
            {categories.map((category) => (
              <li key={category}>{category}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-gray-500">
            Categories will appear here when available.
          </p>
        )}

        <Link
          href="/"
          className="mt-8 inline-block font-semibold text-green-700"
        >
          ← Back to FIDWEL homepage
        </Link>
      </div>
    </main>
  );
}