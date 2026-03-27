"use client";

import { useEffect, useRef } from "react";

/** Ambient gobbler peek — jaws creep in from edges every ~45s, then retreat. */
export default function GobblePeek() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const cx = cv.getContext("2d");
    if (!cx) return;

    let W = window.innerWidth;
    let H = window.innerHeight;
    cv.width = W;
    cv.height = H;

    let cancelled = false;
    let time = 0;
    // Teeth extend 3-17px past topY/botY, so hide position must clear that
    let topY = -40;
    let botY = H + 40;
    let topTarget = -40;
    let botTarget = H + 40;
    const CYCLE = 45 * 60; // ~45s at 60fps
    const PEEK_IN = 180; // frames to hold peek
    let timer = CYCLE - 600; // first peek after ~10s

    function lerp(a: number, b: number, t: number) {
      return a + (b - a) * t;
    }
    function sr(s: number) {
      const v = Math.sin(s * 127.1 + 311.7) * 43758.5453;
      return v - Math.floor(v);
    }

    function jagEdge(y: number, dir: number, seed: number) {
      const t = time * 0.006;
      const pts: { x: number; y: number }[] = [];
      for (let x = -10; x <= W + 15; x += 10) {
        const j = sr(Math.floor(x / 10) + seed * 100);
        const h = (j * 14 + 3) * dir;
        const sway = Math.sin(t * 0.5 + x * 0.012 + seed) * 2 * dir;
        pts.push({ x, y: y + h + sway });
        const mx = x + 5;
        const mj = sr(Math.floor(mx / 10) + seed * 200 + 50);
        const mh = (mj * 8 + 6) * dir;
        pts.push({ x: mx, y: y + mh + sway });
      }
      return pts;
    }

    function frame() {
      if (cancelled) return;
      time++;
      timer++;

      // Peek: jaw edge at y=20 means teeth reach y=37, clearly visible
      if (timer > CYCLE && timer <= CYCLE + 10) {
        topTarget = 20;
        botTarget = H - 20;
      } else if (timer > CYCLE + PEEK_IN) {
        topTarget = -40;
        botTarget = H + 40;
        if (topY < -35) timer = 0;
      }

      topY = lerp(topY, topTarget, 0.005);
      botY = lerp(botY, botTarget, 0.005);

      cx!.clearRect(0, 0, W, H);

      if (topY > -38 || botY < H + 38) {
        // Draw jaw fill
        const topEdge = jagEdge(topY, 1, 1);
        cx!.fillStyle = "#040404";
        cx!.beginPath();
        cx!.moveTo(-10, -10);
        cx!.lineTo(W + 10, -10);
        cx!.lineTo(W + 10, topY);
        for (let i = topEdge.length - 1; i >= 0; i--)
          cx!.lineTo(topEdge[i].x, topEdge[i].y);
        cx!.closePath();
        cx!.fill();

        // Subtle cyan edge glow on top teeth
        cx!.strokeStyle = "rgba(0, 245, 255, 0.15)";
        cx!.lineWidth = 1.5;
        cx!.beginPath();
        for (let i = 0; i < topEdge.length; i++) {
          if (i === 0) cx!.moveTo(topEdge[i].x, topEdge[i].y);
          else cx!.lineTo(topEdge[i].x, topEdge[i].y);
        }
        cx!.stroke();

        const botEdge = jagEdge(botY, -1, 5);
        cx!.fillStyle = "#040404";
        cx!.beginPath();
        for (let i = 0; i < botEdge.length; i++) {
          if (i === 0) cx!.moveTo(botEdge[i].x, botEdge[i].y);
          else cx!.lineTo(botEdge[i].x, botEdge[i].y);
        }
        cx!.lineTo(W + 10, H + 10);
        cx!.lineTo(-10, H + 10);
        cx!.closePath();
        cx!.fill();

        // Subtle cyan edge glow on bottom teeth
        cx!.beginPath();
        for (let i = 0; i < botEdge.length; i++) {
          if (i === 0) cx!.moveTo(botEdge[i].x, botEdge[i].y);
          else cx!.lineTo(botEdge[i].x, botEdge[i].y);
        }
        cx!.stroke();
      }

      requestAnimationFrame(frame);
    }

    frame();

    const onResize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      cv.width = W;
      cv.height = H;
      botY = H + 60;
      botTarget = H + 60;
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ width: "100vw", height: "100vh", zIndex: 1 }}
    />
  );
}
