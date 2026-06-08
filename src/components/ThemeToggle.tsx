"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="w-10 h-10 rounded-xl flex items-center justify-center border-2 border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-[#0F1A0A] dark:text-[#D6FB61] transition-all hover:-translate-y-1"
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}