"use client";

import { useEffect, useRef } from "react";
import { warpletImageSrc } from "@/lib/warplet-image-src";

/* eslint-disable @next/next/no-img-element */

/** Flies the selected warplet from its card position to viewport center. */
export default function FlyingWarplet({
  fid,
  startRect,
  onArrived,
}: {
  fid: number;
  startRect: { x: number; y: number; w: number; h: number };
  onArrived: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Start at card position
    el.style.transform = `translate(${startRect.x}px, ${startRect.y}px)`;
    el.style.width = `${startRect.w}px`;
    el.style.height = `${startRect.h}px`;
    el.style.opacity = "1";

    // Next frame: animate to center
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const targetSize = Math.min(window.innerWidth * 0.7, 350);
        const cx = (window.innerWidth - targetSize) / 2;
        const cy = (window.innerHeight - targetSize) / 2;
        el.style.transition =
          "transform 0.8s cubic-bezier(0.22, 1, 0.36, 1), width 0.8s cubic-bezier(0.22, 1, 0.36, 1), height 0.8s cubic-bezier(0.22, 1, 0.36, 1)";
        el.style.transform = `translate(${cx}px, ${cy}px)`;
        el.style.width = `${targetSize}px`;
        el.style.height = `${targetSize}px`;
      });
    });

    const timer = setTimeout(onArrived, 900);
    return () => clearTimeout(timer);
  }, [startRect, onArrived]);

  return (
    <div
      ref={ref}
      className="fixed top-0 left-0 z-40 pointer-events-none"
      style={{ opacity: 0 }}
    >
      <img
        src={warpletImageSrc(fid)}
        alt=""
        className="w-full h-full rounded-2xl"
        draggable={false}
      />
    </div>
  );
}
