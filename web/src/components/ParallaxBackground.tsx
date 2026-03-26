"use client";

import { useEffect, useRef } from "react";

/* eslint-disable @next/next/no-img-element */

const PARALLAX_WARPLETS = [
  // Back layer (slow, heavy blur — out of focus)
  { id: 0, fid: 4, x: 5, y: 8, size: 70, opacity: 0.1, speed: 0.02, rotate: 12, blur: 6 },
  { id: 1, fid: 9, x: 25, y: 15, size: 90, opacity: 0.12, speed: 0.025, rotate: -8, blur: 5 },
  { id: 2, fid: 20, x: 70, y: 5, size: 80, opacity: 0.1, speed: 0.02, rotate: 20, blur: 6 },
  { id: 3, fid: 194, x: 85, y: 20, size: 60, opacity: 0.09, speed: 0.015, rotate: -15, blur: 7 },
  { id: 4, fid: 239, x: 50, y: 65, size: 85, opacity: 0.1, speed: 0.02, rotate: 5, blur: 6 },
  { id: 5, fid: 10, x: 15, y: 75, size: 75, opacity: 0.09, speed: 0.018, rotate: -22, blur: 5 },
  { id: 6, fid: 1000, x: 90, y: 55, size: 65, opacity: 0.1, speed: 0.022, rotate: 30, blur: 7 },
  // Mid layer (medium speed, mild blur)
  { id: 7, fid: 1, x: 12, y: 35, size: 110, opacity: 0.15, speed: 0.05, rotate: -5, blur: 3 },
  { id: 8, fid: 616, x: 42, y: 25, size: 120, opacity: 0.16, speed: 0.06, rotate: 10, blur: 2 },
  { id: 9, fid: 3, x: 78, y: 40, size: 100, opacity: 0.14, speed: 0.045, rotate: -18, blur: 3 },
  { id: 10, fid: 680, x: 55, y: 80, size: 115, opacity: 0.15, speed: 0.055, rotate: 15, blur: 2 },
  { id: 11, fid: 5, x: 30, y: 55, size: 95, opacity: 0.13, speed: 0.04, rotate: -12, blur: 3 },
  { id: 12, fid: 69, x: 92, y: 75, size: 105, opacity: 0.14, speed: 0.05, rotate: 8, blur: 2.5 },
  { id: 13, fid: 6, x: 62, y: 45, size: 100, opacity: 0.13, speed: 0.045, rotate: -8, blur: 3 },
  // Front layer (fastest, largest, sharp — in focus)
  { id: 14, fid: 99, x: 8, y: 50, size: 160, opacity: 0.2, speed: 0.1, rotate: -3, blur: 0 },
  { id: 15, fid: 2, x: 65, y: 18, size: 180, opacity: 0.22, speed: 0.12, rotate: 7, blur: 0 },
  { id: 16, fid: 4567, x: 35, y: 85, size: 150, opacity: 0.18, speed: 0.09, rotate: -10, blur: 0 },
  { id: 17, fid: 8, x: 82, y: 70, size: 170, opacity: 0.2, speed: 0.11, rotate: 14, blur: 0 },
];

export default function ParallaxBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const handleScroll = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const y = window.scrollY;
        const children = containerRef.current?.children;
        if (!children) return;
        PARALLAX_WARPLETS.forEach((w, i) => {
          (children[i] as HTMLElement).style.transform =
            `translateY(${y * w.speed * -1}px) rotate(${w.rotate}deg)`;
        });
      });
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 0 }}
    >
      {PARALLAX_WARPLETS.map((w) => (
        <div
          key={w.id}
          className="absolute warplet-parallax-item"
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
          <img
            src={`/warplets/warplet-${w.fid}.png`}
            alt=""
            draggable={false}
            style={{
              width: "100%",
              height: "100%",
              borderRadius: 8,
              filter: `brightness(1.3) saturate(1.2)${w.blur ? ` blur(${w.blur}px)` : ""}`,
            }}
          />
        </div>
      ))}
    </div>
  );
}
