"use client";

import { useState, useEffect } from "react";

const FONTS = [
  { name: "Inter", variable: "--font-inter" },
  { name: "Space Grotesk", variable: "--font-space-grotesk" },
  { name: "DM Sans", variable: "--font-dm-sans" },
  { name: "Outfit", variable: "--font-outfit" },
  { name: "Sora", variable: "--font-sora" },
  { name: "EB Garamond", variable: "--font-eb-garamond" },
] as const;

export default function FontToggle() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--font-active",
      `var(${FONTS[index].variable})`
    );
  }, [index]);

  return (
    <button
      onClick={() => setIndex((i) => (i + 1) % FONTS.length)}
      className="fixed bottom-4 right-4 z-50 px-3 py-1.5 rounded-lg bg-base-300/80 backdrop-blur-sm border border-base-content/10 text-xs text-base-content/50 hover:text-base-content/80 transition-colors"
    >
      {FONTS[index].name}
    </button>
  );
}
