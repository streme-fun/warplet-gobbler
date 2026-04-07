"use client";

import { useEffect, useMemo, useRef } from "react";
import { warpletImageSrc } from "@/lib/warplet-image-src";

/* eslint-disable @next/next/no-img-element */

/** Layout slots only — FIDs come from `queueFids` (auction queue strip) to warm-reuse cached art. */
const PARALLAX_SLOTS = [
  { id: 0, x: 5, y: 8, size: 70, opacity: 0.1, speed: 0.02, rotate: 12, blur: 6, smHide: true },
  { id: 1, x: 25, y: 15, size: 90, opacity: 0.12, speed: 0.025, rotate: -8, blur: 5, smHide: false },
  { id: 2, x: 70, y: 5, size: 80, opacity: 0.1, speed: 0.02, rotate: 20, blur: 6, smHide: true },
  { id: 3, x: 85, y: 20, size: 60, opacity: 0.09, speed: 0.015, rotate: -15, blur: 7, smHide: true },
  { id: 4, x: 50, y: 65, size: 85, opacity: 0.1, speed: 0.02, rotate: 5, blur: 6, smHide: true },
  { id: 5, x: 15, y: 75, size: 75, opacity: 0.09, speed: 0.018, rotate: -22, blur: 5, smHide: false },
  { id: 6, x: 90, y: 55, size: 65, opacity: 0.1, speed: 0.022, rotate: 30, blur: 7, smHide: true },
  { id: 7, x: 12, y: 35, size: 110, opacity: 0.15, speed: 0.05, rotate: -5, blur: 3, smHide: false },
  { id: 8, x: 42, y: 25, size: 120, opacity: 0.16, speed: 0.06, rotate: 10, blur: 2, smHide: true },
  { id: 9, x: 78, y: 40, size: 100, opacity: 0.14, speed: 0.045, rotate: -18, blur: 3, smHide: true },
  { id: 10, x: 55, y: 80, size: 115, opacity: 0.15, speed: 0.055, rotate: 15, blur: 2, smHide: true },
  { id: 11, x: 30, y: 55, size: 95, opacity: 0.13, speed: 0.04, rotate: -12, blur: 3, smHide: false },
  { id: 12, x: 92, y: 75, size: 105, opacity: 0.14, speed: 0.05, rotate: 8, blur: 2.5, smHide: true },
  { id: 13, x: 62, y: 45, size: 100, opacity: 0.13, speed: 0.045, rotate: -8, blur: 3, smHide: true },
  { id: 14, x: 8, y: 50, size: 160, opacity: 0.2, speed: 0.1, rotate: -3, blur: 0, smHide: false },
  { id: 15, x: 65, y: 18, size: 180, opacity: 0.22, speed: 0.12, rotate: 7, blur: 0, smHide: false },
  { id: 16, x: 35, y: 85, size: 150, opacity: 0.18, speed: 0.09, rotate: -10, blur: 0, smHide: true },
  { id: 17, x: 82, y: 70, size: 170, opacity: 0.2, speed: 0.11, rotate: 14, blur: 0, smHide: true },
] as const;

function assignQueueFidsToSlots(queueFids: number[]) {
  const hasFids = queueFids.length > 0;
  const pool = hasFids ? queueFids : [];
  return PARALLAX_SLOTS.map((s, i) => ({
    ...s,
    fid: hasFids ? pool[i % pool.length]! : null,
  }));
}

export default function ParallaxBackground({
  queueFids,
  /** When true, use neutral skeleton tiles (e.g. wallet confirmed empty — avoids “ghost faces” vs empty picker). */
  neutralTiles = false,
}: {
  /** Same FIDs as the auction queue strip (after the live lot). */
  queueFids: number[];
  neutralTiles?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  const warplets = useMemo(
    () =>
      neutralTiles
        ? PARALLAX_SLOTS.map((s) => ({ ...s, fid: null as number | null }))
        : assignQueueFidsToSlots(queueFids),
    [queueFids, neutralTiles],
  );

  useEffect(() => {
    const handleScroll = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const y = window.scrollY;
        const children = containerRef.current?.children;
        if (!children) return;
        warplets.forEach((w, i) => {
          const el = children[i] as HTMLElement | undefined;
          if (el) {
            el.style.transform = `translateY(${y * w.speed * -1}px) rotate(${w.rotate}deg)`;
          }
        });
      });
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      cancelAnimationFrame(rafRef.current);
    };
  }, [warplets]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 0 }}
    >
      {warplets.map((w) => (
        <div
          key={w.id}
          className={`absolute warplet-parallax-item${w.smHide ? " hidden sm:block" : ""}`}
          style={{
            left: `${w.x}%`,
            top: `${w.y}%`,
            width: w.size,
            height: w.size,
            opacity: w.opacity,
            transform: `rotate(${w.rotate}deg)`,
            willChange: w.blur ? undefined : "transform",
            // @ts-expect-error CSS custom properties
            "--drift-duration": `${18 + w.id * 3}s`,
            "--drift-delay": `${w.id * -2.5}s`,
          }}
        >
          {w.fid != null ? (
            <img
              src={warpletImageSrc(w.fid)}
              alt=""
              draggable={false}
              loading="lazy"
              decoding="async"
              style={{
                width: "100%",
                height: "100%",
                borderRadius: 8,
                filter: `brightness(1.3) saturate(1.2)${w.blur ? ` blur(${w.blur}px)` : ""}`,
              }}
            />
          ) : (
            <div
              className="skeleton w-full h-full"
              style={{
                borderRadius: 8,
                filter: w.blur ? `blur(${w.blur}px)` : undefined,
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
