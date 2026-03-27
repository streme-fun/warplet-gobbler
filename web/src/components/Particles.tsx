"use client";

import { useEffect, useState } from "react";

// Deterministic particle positions to avoid hydration mismatch
const PARTICLES = [
  { id: 0, left: "20%", delay: "0s", size: 3, drift: "-10px", duration: "2.5s", color: "#00F5FF" },
  { id: 1, left: "35%", delay: "0.5s", size: 4, drift: "15px", duration: "3s", color: "#7B61FF" },
  { id: 2, left: "50%", delay: "1s", size: 2, drift: "-20px", duration: "2.8s", color: "#FF007A" },
  { id: 3, left: "65%", delay: "1.5s", size: 5, drift: "25px", duration: "3.2s", color: "#00F5FF" },
  { id: 4, left: "80%", delay: "2s", size: 3, drift: "-15px", duration: "2.6s", color: "#7B61FF" },
  { id: 5, left: "25%", delay: "0.8s", size: 4, drift: "10px", duration: "3.5s", color: "#FF007A" },
  { id: 6, left: "45%", delay: "2.2s", size: 2, drift: "-25px", duration: "2.4s", color: "#00F5FF" },
  { id: 7, left: "70%", delay: "0.3s", size: 3, drift: "20px", duration: "3.1s", color: "#7B61FF" },
  { id: 8, left: "30%", delay: "1.8s", size: 5, drift: "-5px", duration: "2.9s", color: "#FF007A" },
  { id: 9, left: "55%", delay: "2.5s", size: 2, drift: "30px", duration: "3.4s", color: "#00F5FF" },
  { id: 10, left: "75%", delay: "1.2s", size: 4, drift: "-18px", duration: "2.7s", color: "#7B61FF" },
  { id: 11, left: "40%", delay: "0.6s", size: 3, drift: "12px", duration: "3.3s", color: "#FF007A" },
];

export default function Particles() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <>
      {PARTICLES.map((p) => (
        <span
          key={p.id}
          className="particle"
          style={{
            left: p.left,
            bottom: "10%",
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            animationDelay: p.delay,
            animationDuration: p.duration,
            // @ts-expect-error CSS custom property
            "--drift": p.drift,
          }}
        />
      ))}
    </>
  );
}
