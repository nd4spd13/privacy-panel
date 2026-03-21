"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface SearchBarProps {
  placeholder?: string;
  size?: "default" | "large";
  defaultValue?: string;
}

export function SearchBar({ placeholder = "Search companies…", size = "default", defaultValue = "" }: SearchBarProps) {
  const [query, setQuery] = useState(defaultValue);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    startTransition(() => {
      router.push(`/directory?q=${encodeURIComponent(query.trim())}`);
    });
  }

  const inputClass = size === "large"
    ? "w-full border border-gray-300 rounded-lg px-5 py-4 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
    : "w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent";

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className={inputClass}
        autoComplete="off"
      />
      <button
        type="submit"
        className="bg-black text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors flex-shrink-0"
      >
        Search
      </button>
    </form>
  );
}
