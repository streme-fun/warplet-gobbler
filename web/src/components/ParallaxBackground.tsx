"use client";

import { useEffect, useRef } from "react";

/* eslint-disable @next/next/no-img-element */

/** Static warplet images from public/warplets/ — no live chain data needed. */
const STATIC_WARPLETS = [
  "warplet-1.png",
  "warplet-2.png",
  "warplet-3.png",
  "warplet-4.png",
  "warplet-5.png",
  "warplet-6.png",
  "warplet-8.png",
  "warplet-9.png",
  "warplet-10.png",
  "warplet-20.png",
  "warplet-69.png",
  "warplet-99.png",
  "warplet-194.png",
  "warplet-239.png",
  "warplet-616.png",
  "warplet-680.png",
  "warplet-4567.png",
];

const PARALLAX_SLOTS = [
  {
    id: 0,
    x: 5,
    y: 8,
    size: 70,
    opacity: 0.12,
    speed: 0.06,
    rotate: 12,
    blur: 6,
    smHide: true,
  },
  {
    id: 1,
    x: 25,
    y: 15,
    size: 90,
    opacity: 0.14,
    speed: 0.075,
    rotate: -8,
    blur: 5,
    smHide: false,
  },
  {
    id: 2,
    x: 70,
    y: 5,
    size: 80,
    opacity: 0.12,
    speed: 0.06,
    rotate: 20,
    blur: 6,
    smHide: true,
  },
  {
    id: 3,
    x: 85,
    y: 20,
    size: 60,
    opacity: 0.11,
    speed: 0.045,
    rotate: -15,
    blur: 7,
    smHide: true,
  },
  {
    id: 4,
    x: 50,
    y: 65,
    size: 85,
    opacity: 0.12,
    speed: 0.06,
    rotate: 5,
    blur: 6,
    smHide: false,
  },
  {
    id: 5,
    x: 15,
    y: 75,
    size: 75,
    opacity: 0.11,
    speed: 0.055,
    rotate: -22,
    blur: 5,
    smHide: false,
  },
  {
    id: 6,
    x: 90,
    y: 55,
    size: 65,
    opacity: 0.12,
    speed: 0.065,
    rotate: 30,
    blur: 7,
    smHide: true,
  },
  {
    id: 7,
    x: 12,
    y: 35,
    size: 110,
    opacity: 0.18,
    speed: 0.15,
    rotate: -5,
    blur: 3,
    smHide: false,
  },
  {
    id: 8,
    x: 42,
    y: 25,
    size: 120,
    opacity: 0.2,
    speed: 0.18,
    rotate: 10,
    blur: 2,
    smHide: true,
  },
  {
    id: 9,
    x: 78,
    y: 40,
    size: 100,
    opacity: 0.16,
    speed: 0.135,
    rotate: -18,
    blur: 3,
    smHide: true,
  },
  {
    id: 10,
    x: 55,
    y: 80,
    size: 115,
    opacity: 0.18,
    speed: 0.165,
    rotate: 15,
    blur: 2,
    smHide: false,
  },
  {
    id: 11,
    x: 30,
    y: 55,
    size: 95,
    opacity: 0.15,
    speed: 0.12,
    rotate: -12,
    blur: 3,
    smHide: false,
  },
  {
    id: 12,
    x: 92,
    y: 75,
    size: 105,
    opacity: 0.16,
    speed: 0.15,
    rotate: 8,
    blur: 2.5,
    smHide: true,
  },
  {
    id: 13,
    x: 62,
    y: 45,
    size: 100,
    opacity: 0.15,
    speed: 0.135,
    rotate: -8,
    blur: 3,
    smHide: true,
  },
  {
    id: 14,
    x: 8,
    y: 50,
    size: 160,
    opacity: 0.22,
    speed: 0.3,
    rotate: -3,
    blur: 0,
    smHide: false,
  },
  {
    id: 15,
    x: 65,
    y: 18,
    size: 180,
    opacity: 0.25,
    speed: 0.36,
    rotate: 7,
    blur: 0,
    smHide: false,
  },
  {
    id: 16,
    x: 35,
    y: 85,
    size: 150,
    opacity: 0.2,
    speed: 0.27,
    rotate: -10,
    blur: 0,
    smHide: false,
  },
  {
    id: 17,
    x: 82,
    y: 70,
    size: 170,
    opacity: 0.22,
    speed: 0.33,
    rotate: 14,
    blur: 0,
    smHide: false,
  },
] as const;

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
        PARALLAX_SLOTS.forEach((w, i) => {
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
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 2 }}
    >
      {PARALLAX_SLOTS.map((w) => (
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
          <img
            src={`/warplets/${STATIC_WARPLETS[w.id % STATIC_WARPLETS.length]}`}
            alt=""
            draggable={false}
            loading="lazy"
            decoding="async"
            style={{
              width: "100%",
              height: "100%",
              borderRadius: 8,
              objectFit: "cover",
              filter: `brightness(1.3) saturate(1.2)${w.blur ? ` blur(${w.blur}px)` : ""}`,
            }}
          />
        </div>
      ))}
    </div>
  );
}
