"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

/* eslint-disable @next/next/no-img-element */

export type AuctionCanvasHandle = { triggerStrike: () => void };

/**
 * Auction warplet with canvas blob + tendrils.
 * Hover expands tendrils; clicking Buy triggers a strike animation.
 */
const AuctionWarpletCanvas = forwardRef<
  AuctionCanvasHandle,
  { fid: number; onStrikeDone?: () => void }
>(function AuctionWarpletCanvas({ fid, onStrikeDone }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    hovered: false,
    striking: false,
    strikeTime: 0,
    time: 0,
    cancelled: false,
  });

  useImperativeHandle(ref, () => ({
    triggerStrike() {
      stateRef.current.striking = true;
      stateRef.current.strikeTime = 0;
    },
  }));

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    if (!ctx) return;

    const SIZE = 200;
    cv.width = SIZE;
    cv.height = SIZE;
    const CX = SIZE / 2;
    const CY = SIZE / 2;
    const st = stateRef.current;

    // Tendril data — generated once
    const TENDRIL_COUNT = 24;
    const IMG_HALF = 60; // half of warplet image size on canvas
    const tendrils: {
      ox: number;
      oy: number;
      angle: number;
      maxLen: number;
      width: number;
      phase: number;
      segments: number;
      curlFreq: number;
      curlAmp: number;
      hasEdge: boolean;
      edgeSide: number;
      edgeAlpha: number;
    }[] = [];

    for (let i = 0; i < TENDRIL_COUNT; i++) {
      const t = i / TENDRIL_COUNT;
      const angle = t * Math.PI * 2;
      const ox = Math.cos(angle) * (IMG_HALF + 2);
      const oy = Math.sin(angle) * (IMG_HALF + 2);
      tendrils.push({
        ox,
        oy,
        angle: angle + (Math.random() - 0.5) * 0.4,
        maxLen: 25 + Math.random() * 45,
        width: 2 + Math.random() * 5,
        phase: Math.random() * Math.PI * 2,
        segments: 6 + Math.floor(Math.random() * 4),
        curlFreq: 0.5 + Math.random() * 0.8,
        curlAmp: 0.1 + Math.random() * 0.25,
        hasEdge: Math.random() < 0.3,
        edgeSide: Math.random() > 0.5 ? 1 : -1,
        edgeAlpha: 0.1 + Math.random() * 0.2,
      });
    }

    // Blob bulges
    const bulges = Array.from({ length: 5 }, () => ({
      angle: Math.random() * Math.PI * 2,
      speed: 0.15 + Math.random() * 0.25,
      width: 0.4 + Math.random() * 0.5,
      strength: 0.15 + Math.random() * 0.2,
    }));

    // Heartbeat
    function getBreath(t: number) {
      const cycle = 4;
      const p = (t % cycle) / cycle;
      if (p < 0.4) return 0;
      if (p < 0.45) return ((p - 0.4) / 0.05) * 0.5;
      if (p < 0.5) return 0.5;
      if (p < 0.55) return 0.5 + ((p - 0.5) / 0.05) * 0.5;
      if (p < 0.65) return 1.0;
      if (p < 0.85) {
        const x = (p - 0.65) / 0.2;
        return 1.0 - x * x * 0.7;
      }
      return 0.3;
    }

    // Draw tendril shape
    function drawTendrilShape(
      spine: { x: number; y: number }[],
      widthFn: (p: number) => number,
      color: string,
    ) {
      if (spine.length < 2) return;
      const left: { x: number; y: number }[] = [];
      const right: { x: number; y: number }[] = [];
      for (let i = 0; i < spine.length; i++) {
        const progress = i / (spine.length - 1);
        const w = widthFn(progress) * 0.5;
        let dx: number, dy: number;
        if (i === 0) {
          dx = spine[1].x - spine[0].x;
          dy = spine[1].y - spine[0].y;
        } else if (i === spine.length - 1) {
          dx = spine[i].x - spine[i - 1].x;
          dy = spine[i].y - spine[i - 1].y;
        } else {
          dx = spine[i + 1].x - spine[i - 1].x;
          dy = spine[i + 1].y - spine[i - 1].y;
        }
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        left.push({ x: spine[i].x + nx * w, y: spine[i].y + ny * w });
        right.push({ x: spine[i].x - nx * w, y: spine[i].y - ny * w });
      }
      ctx.beginPath();
      ctx.moveTo(left[0].x, left[0].y);
      for (let i = 1; i < left.length; i++) {
        if (i < left.length - 1)
          ctx.quadraticCurveTo(
            left[i].x,
            left[i].y,
            (left[i].x + left[i + 1].x) / 2,
            (left[i].y + left[i + 1].y) / 2,
          );
        else ctx.lineTo(left[i].x, left[i].y);
      }
      ctx.lineTo(spine[spine.length - 1].x, spine[spine.length - 1].y);
      for (let i = right.length - 1; i >= 0; i--) {
        if (i > 0)
          ctx.quadraticCurveTo(
            right[i].x,
            right[i].y,
            (right[i].x + right[i - 1].x) / 2,
            (right[i].y + right[i - 1].y) / 2,
          );
        else ctx.lineTo(right[i].x, right[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    }

    // Draw white edge highlight
    function drawEdge(
      spine: { x: number; y: number }[],
      widthFn: (p: number) => number,
      side: number,
      intensity: number,
    ) {
      if (spine.length < 3) return;
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i < spine.length; i++) {
        const progress = i / (spine.length - 1);
        const w = widthFn(progress) * 0.5;
        let dx: number, dy: number;
        if (i === 0) {
          dx = spine[1].x - spine[0].x;
          dy = spine[1].y - spine[0].y;
        } else if (i === spine.length - 1) {
          dx = spine[i].x - spine[i - 1].x;
          dy = spine[i].y - spine[i - 1].y;
        } else {
          dx = spine[i + 1].x - spine[i - 1].x;
          dy = spine[i + 1].y - spine[i - 1].y;
        }
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        pts.push({
          x: spine[i].x + (-dy / len) * side * w,
          y: spine[i].y + (dx / len) * side * w,
        });
      }
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        if (i < pts.length - 1)
          ctx.quadraticCurveTo(
            pts[i].x,
            pts[i].y,
            (pts[i].x + pts[i + 1].x) / 2,
            (pts[i].y + pts[i + 1].y) / 2,
          );
        else ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(255,255,255,${intensity})`;
      ctx.lineCap = "round";
      ctx.stroke();
    }

    // Sparks
    let sparks: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
      life: number;
      decay: number;
    }[] = [];

    function spawnSparks() {
      for (let i = 0; i < 50; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 80 + Math.random() * 200;
        sparks.push({
          x: CX + (Math.random() - 0.5) * 20,
          y: CY + (Math.random() - 0.5) * 20,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          r: 0.4 + Math.random() * 2,
          life: 1,
          decay: 0.015 + Math.random() * 0.025,
        });
      }
    }

    // Smoothed hover extension
    let hoverExt = 0;
    // Smoothed strike tendril collapse
    let strikeCollapse = 0;

    function frame() {
      if (st.cancelled) return;
      const dt = 0.016;
      st.time += dt;
      const t = st.time;

      // Smooth hover transition
      const hoverTarget = st.hovered && !st.striking ? 1 : 0;
      hoverExt += (hoverTarget - hoverExt) * 0.06;

      // Strike
      if (st.striking) {
        st.strikeTime += dt;
        strikeCollapse = Math.min(1, st.strikeTime / 0.6);
        if (st.strikeTime > 2.0) {
          st.striking = false;
          st.strikeTime = 0;
          strikeCollapse = 0;
          onStrikeDone?.();
        }
      } else {
        strikeCollapse *= 0.95;
      }

      ctx.clearRect(0, 0, SIZE, SIZE);

      const breath = getBreath(t);
      const ext =
        (0.3 + breath * 0.7) * (1 + hoverExt * 0.8) * (1 - strikeCollapse);

      // Draw blob
      if (ext > 0.01) {
        const blobRadius =
          (IMG_HALF + 4) * (1 + breath * 0.08) * (1 - strikeCollapse * 0.3);
        const angleStep = (Math.PI * 2) / 48;
        ctx.beginPath();
        for (let i = 0; i <= 48; i++) {
          const a = angleStep * i;
          let rMod =
            1 +
            Math.sin(a * 3 + t * 0.8) * 0.015 +
            Math.sin(a * 5 - t * 0.6) * 0.01;
          for (const b of bulges) {
            let diff = a - (b.angle + t * b.speed);
            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
            const influence = Math.max(0, 1 - Math.abs(diff) / b.width);
            rMod +=
              influence * influence * (3 - 2 * influence) * breath * b.strength;
          }
          const r = blobRadius * rMod;
          ctx.lineTo(CX + Math.cos(a) * r, CY + Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fillStyle = "rgba(0,0,0,0.85)";
        ctx.fill();
      }

      // Draw tendrils
      for (const td of tendrils) {
        const reach = td.maxLen * ext;
        const segLen = reach / td.segments;
        if (segLen < 0.3) continue;

        let x = CX + td.ox;
        let y = CY + td.oy;
        const spine = [{ x, y }];
        for (let i = 0; i < td.segments; i++) {
          const progress = i / td.segments;
          const curl =
            Math.sin(t * td.curlFreq + i * 0.85 + td.phase) *
            td.curlAmp *
            (0.15 + progress * 0.85);
          x += Math.cos(td.angle + curl) * segLen;
          y += Math.sin(td.angle + curl) * segLen;
          spine.push({ x, y });
        }

        const baseWidth = td.width * Math.min(1, ext * 4);
        const widthFn = (p: number) => baseWidth * (1 - p * 0.94);
        drawTendrilShape(spine, widthFn, "rgba(0,0,0,0.9)");

        if (td.hasEdge && ext > 0.15) {
          const flicker = 0.6 + Math.sin(t * 1.3 + td.phase * 3) * 0.4;
          drawEdge(
            spine,
            widthFn,
            td.edgeSide,
            td.edgeAlpha * flicker * Math.min(1, ext * 2.5),
          );
        }
      }

      // Strike effects
      if (st.striking) {
        const sT = st.strikeTime;

        // Spawn sparks on first frame
        if (sT < dt * 2) spawnSparks();

        // Slash lines
        const slashes = [
          { delay: 0, angle: -0.25 * Math.PI, len: 0.8 },
          { delay: 0.05, angle: 0.2 * Math.PI, len: 0.65 },
          { delay: 0.1, angle: -0.5 * Math.PI, len: 0.5 },
        ];
        for (const s of slashes) {
          const elapsed = sT - s.delay;
          if (elapsed < 0 || elapsed > 0.7) continue;
          const alpha =
            elapsed < 0.03
              ? elapsed / 0.03
              : Math.max(0, 1 - (elapsed - 0.03) / 0.6);
          const len = (60 + elapsed * 60) * s.len;
          const extend = Math.min(1, elapsed / 0.03);
          ctx.save();
          ctx.translate(CX, CY);
          ctx.rotate(s.angle);
          ctx.shadowColor = "#fff";
          ctx.shadowBlur = 20 * alpha;
          ctx.beginPath();
          ctx.moveTo(-len * extend, 0);
          ctx.lineTo(len, 0);
          ctx.lineWidth = 2.5 * (1 - elapsed * 0.3);
          ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
          ctx.lineCap = "round";
          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.restore();
        }

        // Flash
        if (sT < 0.05) {
          const alpha = (sT < 0.02 ? sT / 0.02 : 1 - (sT - 0.02) / 0.03) * 0.6;
          ctx.fillStyle = `rgba(255,255,255,${alpha})`;
          ctx.fillRect(0, 0, SIZE, SIZE);
        }
      }

      // Draw sparks
      sparks = sparks.filter((p) => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.life -= p.decay;
        if (p.life <= 0) return false;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${p.life * 0.8})`;
        ctx.fill();
        return true;
      });

      requestAnimationFrame(frame);
    }

    frame();
    return () => {
      st.cancelled = true;
    };
  }, [onStrikeDone]);

  return (
    <div
      className="relative w-full aspect-square"
      onMouseEnter={() => (stateRef.current.hovered = true)}
      onMouseLeave={() => (stateRef.current.hovered = false)}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      <img
        src={`/warplets/warplet-${fid}.png`}
        alt={`Warplet #${fid}`}
        className="absolute rounded-xl w-[60%] h-[60%] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        draggable={false}
      />
    </div>
  );
});

export default AuctionWarpletCanvas;
