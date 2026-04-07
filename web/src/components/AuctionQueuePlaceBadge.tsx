"use client";

import type { ComponentPropsWithoutRef } from "react";

/** Handwritten-style place marker on the thumbnail (shared by queue + bump preview). */
export function AuctionQueuePlaceBadge({
  place,
  className = "",
  ...props
}: { place: number; className?: string } & ComponentPropsWithoutRef<"span">) {
  return (
    <span
      className={[
        "pointer-events-none absolute left-1 top-0.5 z-10 font-handwritten text-[1.35rem] sm:text-[1.55rem] font-bold leading-none tracking-tight text-[#34286e] [text-shadow:0_0_1px_#fff,0_0_4px_rgba(255,255,255,0.95),0_0_8px_rgba(255,255,255,0.55),0_1px_1px_rgba(255,255,255,0.9)] -rotate-1",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      #{place}
    </span>
  );
}
