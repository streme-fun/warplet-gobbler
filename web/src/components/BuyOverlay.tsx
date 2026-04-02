"use client";

import { useEffect, useRef } from "react";
import { warpletImageSrc } from "@/lib/warplet-image-src";

/* eslint-disable @next/next/no-img-element */

/**
 * Full-screen canvas overlay for buying a gobbled warplet.
 * Plays the Silksong Void combat sequence:
 *   fly-in → materialize → hit1 → recover → hit2 → recover → finisher → resolve → gleam → fade
 */
export default function BuyOverlay({
  fid,
  startRect,
  onDone,
}: {
  fid: number;
  startRect: { x: number; y: number; w: number; h: number };
  onDone: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const maybeCtx = cv.getContext("2d");
    if (!maybeCtx) return;
    const ctx = maybeCtx;

    let W = window.innerWidth;
    let H = window.innerHeight;
    cv.width = W;
    cv.height = H;

    let cancelled = false;
    let time = 0;
    let lastFrameTime = performance.now();

    const onResize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      cv.width = W;
      cv.height = H;
      IMG_SIZE = Math.min(W * 0.21, 160);
      IMG_HALF = IMG_SIZE / 2;
    };
    window.addEventListener("resize", onResize);

    // Load images
    const eggImg = new Image();
    eggImg.src = "/egg-closed.png";
    let eggLoaded = false;
    eggImg.onload = () => { eggLoaded = true; };

    const warpletImg = new Image();
    warpletImg.src = warpletImageSrc(fid);
    let warpletLoaded = false;
    warpletImg.onload = () => { warpletLoaded = true; };

    // ========== CONSTANTS ==========
    const HIT_DURATION = 0.6;
    const RECOVER_DURATION = 1.6;
    const FINISHER_RESOLVE = 3.5;
    const FLY_DURATION = 0.8;
    const MATERIALIZE_DURATION = 1.2;
    const GLEAM_DELAY = 1.5; // after resolve starts
    const GLEAM_DURATION = 0.6;
    const FADE_DELAY = 2.5; // after resolve starts
    const FADE_DURATION = 0.8;

    let IMG_SIZE = Math.min(W * 0.21, 160);
    let IMG_HALF = IMG_SIZE / 2;

    // ========== PHASE STATE ==========
    // 'flyin' → 'materialize' → 'idle' → 'hit1' → 'recover1' → 'hit2' → 'recover2' → 'finisher' → 'resolved' → 'fadeout'
    let phase: string = "flyin";
    let phaseTime = 0;
    let weakenLevel = 0;
    let shakeX = 0;
    let shakeY = 0;
    let shakeIntensity = 0;
    let hitStopRemaining = 0;
    let overlayAlpha = 1;

    // Fly-in interpolation — match the visible image size (38% of card), not the button
    const flyFrom = {
      x: startRect.x + startRect.w / 2,
      y: startRect.y + startRect.h / 2,
      size: startRect.w * 0.38,
    };
    const flyTo = { x: W / 2, y: H / 2, size: IMG_SIZE };

    function easeOutExpo(t: number) {
      return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    }

    // ========== PARTICLES ==========
    type Spark = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
      life: number;
      decay: number;
      bright?: boolean;
    };

    let hitSparks: Spark[] = [];
    let lightParticles: Spark[] = [];

    function spawnHitSparks(count: number, speed: number) {
      const cx = W / 2;
      const cy = H / 2;
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = speed * (0.3 + Math.random());
        hitSparks.push({
          x: cx + (Math.random() - 0.5) * 30,
          y: cy + (Math.random() - 0.5) * 30,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          r: 0.5 + Math.random() * 2.5,
          life: 1,
          decay: 0.015 + Math.random() * 0.025,
        });
      }
    }

    function spawnLightBurst() {
      const cx = W / 2;
      const cy = H / 2;
      for (let i = 0; i < 200; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 30 + Math.random() * 500;
        lightParticles.push({
          x: cx + (Math.random() - 0.5) * 20,
          y: cy + (Math.random() - 0.5) * 20,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          r: 1 + Math.random() * 5,
          life: 1,
          decay: 0.005 + Math.random() * 0.012,
          bright: Math.random() > 0.7,
        });
      }
      for (let i = 0; i < 40; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 300 + Math.random() * 600;
        lightParticles.push({
          x: cx,
          y: cy,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          r: 0.5 + Math.random() * 1.5,
          life: 1,
          decay: 0.02 + Math.random() * 0.03,
          bright: true,
        });
      }
    }

    type Shockwave = {
      delay: number;
      radius: number;
      maxRadius: number;
      speed: number;
      lineWidth: number;
    };
    let shockwaves: Shockwave[] = [];

    function spawnShockwaves() {
      shockwaves = [];
      for (let i = 0; i < 4; i++) {
        shockwaves.push({
          delay: i * 0.12,
          radius: 0,
          maxRadius: 250 + i * 100,
          speed: 400 + i * 80,
          lineWidth: 3 - i * 0.5,
        });
      }
    }

    // ========== AMBIENT PARTICLES ==========
    type AmbientParticle = {
      x: number;
      y: number;
      r: number;
      vx: number;
      vy: number;
      life: number;
      decay: number;
      pPhase: number;
      isLight: boolean;
    };

    const ambientParticles: AmbientParticle[] = [];
    function resetAmbient(p: AmbientParticle) {
      p.x = Math.random() * W;
      p.y = Math.random() * H;
      p.r = 0.3 + Math.random() * 1.3;
      p.vx = (Math.random() - 0.5) * 0.15;
      p.vy = (Math.random() - 0.5) * 0.15;
      p.life = 1;
      p.decay = 0.0008 + Math.random() * 0.002;
      p.pPhase = Math.random() * Math.PI * 2;
      p.isLight = Math.random() < 0.25;
    }
    for (let i = 0; i < 35; i++) {
      const p = {} as AmbientParticle;
      resetAmbient(p);
      ambientParticles.push(p);
    }

    // ========== TRIGGER HIT ==========
    function triggerHit(hitNum: number) {
      phaseTime = 0;
      if (hitNum === 1) {
        phase = "hit1";
        shakeIntensity = 10;
        hitStopRemaining = 0.06;
        spawnHitSparks(40, 150);
      } else if (hitNum === 2) {
        phase = "hit2";
        shakeIntensity = 18;
        hitStopRemaining = 0.08;
        spawnHitSparks(70, 250);
      } else {
        phase = "finisher";
        shakeIntensity = 28;
        hitStopRemaining = 0.14;
        spawnLightBurst();
        spawnShockwaves();
      }
    }

    // ========== PHASE MANAGEMENT ==========
    function updatePhase(dt: number) {
      phaseTime += dt;

      if (phase === "flyin" && phaseTime > FLY_DURATION) {
        phase = "materialize";
        phaseTime = 0;
      }
      if (phase === "materialize" && phaseTime > MATERIALIZE_DURATION) {
        phase = "idle";
        phaseTime = 0;
        // Auto start combat after brief idle
        setTimeout(() => {
          if (!cancelled) triggerHit(1);
        }, 300);
      }
      if (phase === "hit1" && phaseTime > HIT_DURATION) {
        phase = "recover1";
        phaseTime = 0;
        weakenLevel = 1;
      }
      if (phase === "recover1" && phaseTime > RECOVER_DURATION) {
        triggerHit(2);
      }
      if (phase === "hit2" && phaseTime > HIT_DURATION) {
        phase = "recover2";
        phaseTime = 0;
        weakenLevel = 2;
      }
      if (phase === "recover2" && phaseTime > RECOVER_DURATION) {
        triggerHit(3);
      }
      if (phase === "finisher" && phaseTime > FINISHER_RESOLVE) {
        phase = "resolved";
        phaseTime = 0;
      }
      if (phase === "resolved" && phaseTime > FADE_DELAY + FADE_DURATION) {
        cancelled = true;
        onDone();
      }
    }

    // ========== DRAW FUNCTIONS ==========

    function drawHitSlash(hitNum: string, dt: number, cx: number, cy: number) {
      const slashConfigs: Record<
        string,
        { delay: number; angle: number; len: number; width: number }[]
      > = {
        hit1: [{ delay: 0, angle: -0.25 * Math.PI, len: 0.6, width: 3 }],
        hit2: [
          { delay: 0, angle: 0.2 * Math.PI, len: 0.75, width: 3.5 },
          { delay: 0.05, angle: -0.4 * Math.PI, len: 0.6, width: 2.5 },
        ],
        finisher: [
          { delay: 0, angle: -0.2 * Math.PI, len: 1.0, width: 5 },
          { delay: 0.06, angle: 0.15 * Math.PI, len: 0.85, width: 4 },
          { delay: 0.12, angle: -0.55 * Math.PI, len: 0.7, width: 3 },
        ],
      };

      const slashes = slashConfigs[hitNum] || [];
      for (const s of slashes) {
        const st = dt - s.delay;
        if (st < 0 || st > 0.8) continue;
        const alpha =
          st < 0.03 ? st / 0.03 : Math.max(0, 1 - (st - 0.03) / 0.7);
        const len = (160 + st * 100) * s.len;
        const extend = Math.min(1, st / 0.03);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(s.angle);
        ctx.shadowColor = "#fff";
        ctx.shadowBlur = (hitNum === "finisher" ? 60 : 30) * alpha;
        ctx.beginPath();
        ctx.moveTo(-len * extend, 0);
        ctx.lineTo(len, 0);
        ctx.lineWidth = s.width * (1 - st * 0.3);
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.lineCap = "round";
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-len * extend, 0);
        ctx.lineTo(len, 0);
        ctx.lineWidth = s.width * 0.35;
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();
      }
    }

    function drawHitFlash(hitNum: string, dt: number, cx: number, cy: number) {
      const intensity =
        hitNum === "hit1" ? 0.3 : hitNum === "hit2" ? 0.5 : 0.85;
      if (dt < 0.06) {
        const alpha =
          (dt < 0.02 ? dt / 0.02 : 1 - (dt - 0.02) / 0.04) * intensity;
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fillRect(-20, -20, W + 40, H + 40);
        return;
      }
      const fadeDur = hitNum === "finisher" ? 1.8 : 0.6;
      if (dt > fadeDur + 0.06) return;
      const alpha =
        Math.max(0, 1 - (dt - 0.06) / fadeDur) * intensity * 0.6;
      const radius =
        60 + (dt - 0.06) * (hitNum === "finisher" ? 350 : 150);
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      grad.addColorStop(0, `rgba(255,255,255,${alpha})`);
      grad.addColorStop(0.3, `rgba(230,235,245,${alpha * 0.5})`);
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    function drawAllSparks(dt: number) {
      hitSparks = hitSparks.filter((p) => {
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

      lightParticles = lightParticles.filter((p) => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.98;
        p.vy *= 0.98;
        p.life -= p.decay;
        if (p.life <= 0) return false;
        const alpha = p.bright ? p.life : p.life * 0.7;
        const r = p.r * (p.bright ? p.life * 0.5 + 0.5 : p.life);
        if (p.bright && p.life > 0.3) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, r * 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${alpha * 0.15})`;
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${alpha * 0.9})`;
        ctx.fill();
        return true;
      });
    }

    function drawShockwavesEffect(dt: number, cx: number, cy: number) {
      for (const sw of shockwaves) {
        const st = dt - sw.delay;
        if (st < 0) continue;
        sw.radius = st * sw.speed;
        if (sw.radius > sw.maxRadius) continue;
        const progress = sw.radius / sw.maxRadius;
        const alpha = (1 - progress) * (1 - progress);
        ctx.beginPath();
        ctx.arc(cx, cy, sw.radius, 0, Math.PI * 2);
        ctx.lineWidth = sw.lineWidth * (1 - progress * 0.5);
        ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.6})`;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, sw.radius, 0, Math.PI * 2);
        ctx.lineWidth = sw.lineWidth * 4 * (1 - progress);
        ctx.strokeStyle = `rgba(200,210,225,${alpha * 0.12})`;
        ctx.stroke();
      }
    }

    function drawPrizeGlow(cx: number, cy: number) {
      const revealTime = phaseTime - 2.0;
      if (phase !== "resolved" && (phase !== "finisher" || revealTime < 0))
        return;
      const rt =
        phase === "resolved"
          ? phaseTime + FINISHER_RESOLVE - 2.0
          : revealTime;
      const glowAlpha = Math.min(1, rt / 1.5);
      const breathe = 1 + Math.sin(time * 1.5) * 0.03;
      const grad = ctx.createRadialGradient(
        cx,
        cy,
        IMG_HALF * 0.5,
        cx,
        cy,
        IMG_HALF * 3 * breathe,
      );
      grad.addColorStop(0, `rgba(220,225,235,${0.12 * glowAlpha})`);
      grad.addColorStop(0.4, `rgba(180,190,210,${0.06 * glowAlpha})`);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    // ========== GLEAM ==========
    function drawGleam(cx: number, cy: number) {
      if (phase !== "resolved") return;
      const gleamStart = GLEAM_DELAY;
      const gleamEnd = gleamStart + GLEAM_DURATION;
      if (phaseTime < gleamStart || phaseTime > gleamEnd) return;

      const progress = (phaseTime - gleamStart) / GLEAM_DURATION;
      // Ease in-out
      const eased =
        progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      const half = IMG_HALF;
      const sweepRange = half * 3; // total sweep distance
      const x = cx - half - 40 + eased * sweepRange;

      ctx.save();
      ctx.beginPath();
      ctx.rect(cx - IMG_HALF, cy - IMG_HALF, IMG_SIZE, IMG_SIZE);
      ctx.clip();

      ctx.translate(x, cy);
      ctx.rotate(-30 * (Math.PI / 180));

      const grad = ctx.createLinearGradient(-20, 0, 20, 0);
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(0.3, "rgba(255,255,255,0.15)");
      grad.addColorStop(0.5, "rgba(255,255,255,0.4)");
      grad.addColorStop(0.7, "rgba(255,255,255,0.15)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(-20, -H, 40, H * 2);

      ctx.restore();
    }

    // ========== MAIN FRAME ==========
    function frame() {
      if (cancelled) return;
      const now = performance.now();
      const dt = Math.min((now - lastFrameTime) / 1000, 0.05);
      lastFrameTime = now;
      time += dt;

      // Hit-stop
      if (hitStopRemaining > 0) {
        hitStopRemaining -= dt;
      } else {
        updatePhase(dt);
      }

      // Fade out
      if (phase === "resolved" && phaseTime > FADE_DELAY) {
        overlayAlpha = Math.max(
          0,
          1 - (phaseTime - FADE_DELAY) / FADE_DURATION,
        );
      }

      // Screen shake
      if (
        phase === "finisher" &&
        phaseTime > 0.3 &&
        phaseTime < 0.35 &&
        shakeIntensity < 12
      ) {
        shakeIntensity = 12;
      }
      if (shakeIntensity > 0.1) {
        shakeX = (Math.random() - 0.5) * 2 * shakeIntensity;
        shakeY = (Math.random() - 0.5) * 2 * shakeIntensity;
        shakeIntensity *= 0.92;
      } else {
        shakeX = 0;
        shakeY = 0;
        shakeIntensity = 0;
      }

      ctx.save();
      ctx.globalAlpha = overlayAlpha;
      ctx.translate(shakeX, shakeY);

      const cx = W / 2;
      const cy = H / 2;

      // Background
      let bgBright = 0;
      if (phase === "finisher" && phaseTime > 2.0) {
        bgBright = Math.min(1, (phaseTime - 2.0) / 2.0);
      } else if (phase === "resolved") {
        bgBright = 1;
      }
      const bgR = Math.round(19 + bgBright * 30);
      const bgG = Math.round(17 + bgBright * 33);
      const bgB = Math.round(28 + bgBright * 35);
      ctx.fillStyle = `rgb(${bgR},${bgG},${bgB})`;
      ctx.fillRect(-20, -20, W + 40, H + 40);

      // Fly-in: draw egg animating from startRect to center
      if (phase === "flyin") {
        const p = easeOutExpo(Math.min(1, phaseTime / FLY_DURATION));
        const curX = flyFrom.x + (flyTo.x - flyFrom.x) * p;
        const curY = flyFrom.y + (flyTo.y - flyFrom.y) * p;
        const curSize = flyFrom.size + (flyTo.size - flyFrom.size) * p;
        if (eggLoaded) {
          const eggW = curSize;
          const eggH = curSize * (360 / 693);
          ctx.save();
          ctx.drawImage(eggImg, curX - eggW / 2, curY - eggH / 2, eggW, eggH);
          ctx.restore();
        }
        ctx.restore();
        requestAnimationFrame(frame);
        return;
      }

      // Fog
      if (phase !== "resolved") {
        let fogAlpha = 1;
        if (phase === "finisher")
          fogAlpha = Math.max(0, 1 - phaseTime / 2.5);
        else if (weakenLevel > 0) fogAlpha = Math.min(1.3, 1 + weakenLevel * 0.15);
        if (fogAlpha > 0) {
          const gx = cx + Math.sin(time * 0.18) * 6;
          const gy = cy + Math.cos(time * 0.14) * 5;
          const fog = ctx.createRadialGradient(
            gx,
            gy,
            0,
            gx,
            gy,
            Math.min(W, H) * 0.32,
          );
          fog.addColorStop(0, `rgba(140,150,165,${0.07 * fogAlpha})`);
          fog.addColorStop(0.5, `rgba(80,90,105,${0.03 * fogAlpha})`);
          fog.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = fog;
          ctx.fillRect(0, 0, W, H);
        }
      }

      // Ambient particles
      if (phase !== "resolved") {
        for (const p of ambientParticles) {
          p.x += p.vx + Math.sin(time * 0.5 + p.pPhase) * 0.08;
          p.y += p.vy + Math.cos(time * 0.4 + p.pPhase) * 0.06;
          p.life -= p.decay;
          if (
            p.life <= 0 ||
            p.x < -10 ||
            p.x > W + 10 ||
            p.y < -10 ||
            p.y > H + 10
          ) {
            resetAmbient(p);
          }
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = p.isLight
            ? `rgba(255,255,255,${p.life * 0.08})`
            : `rgba(0,0,0,${p.life * 0.18})`;
          ctx.fill();
        }
      }

      // Prize glow
      drawPrizeGlow(cx, cy);

      // Image at center: egg during combat, crossfade to warplet after finisher
      const showWarplet = (phase === "finisher" && phaseTime > 2.0) || phase === "resolved";
      const crossfade = phase === "finisher" ? Math.min(1, Math.max(0, (phaseTime - 2.0) / 1.0)) : phase === "resolved" ? 1 : 0;
      const imgAlpha =
        phase === "materialize"
          ? Math.min(1, phaseTime / (MATERIALIZE_DURATION * 0.5))
          : 1;

      // Draw egg (fades out during crossfade) — native 693:360 aspect ratio
      if (eggLoaded && crossfade < 1) {
        const eggW = IMG_SIZE;
        const eggH = IMG_SIZE * (360 / 693);
        ctx.save();
        ctx.globalAlpha = imgAlpha * (1 - crossfade) * overlayAlpha;
        ctx.drawImage(eggImg, cx - eggW / 2, cy - eggH / 2, eggW, eggH);
        ctx.restore();
      }

      // Draw warplet (fades in during crossfade)
      if (warpletLoaded && showWarplet) {
        ctx.save();
        ctx.globalAlpha = imgAlpha * crossfade * overlayAlpha;
        ctx.beginPath();
        ctx.roundRect(cx - IMG_HALF, cy - IMG_HALF, IMG_SIZE, IMG_SIZE, IMG_SIZE * 0.12);
        ctx.clip();
        ctx.drawImage(warpletImg, cx - IMG_HALF, cy - IMG_HALF, IMG_SIZE, IMG_SIZE);
        ctx.restore();
      }

      // Hit effects
      if (phase === "hit1") {
        drawHitSlash("hit1", phaseTime, cx, cy);
        drawHitFlash("hit1", phaseTime, cx, cy);
      } else if (phase === "hit2") {
        drawHitSlash("hit2", phaseTime, cx, cy);
        drawHitFlash("hit2", phaseTime, cx, cy);
      } else if (phase === "finisher") {
        drawShockwavesEffect(phaseTime, cx, cy);
        drawHitSlash("finisher", phaseTime, cx, cy);
        drawHitFlash("finisher", phaseTime, cx, cy);
      }

      // Sparks
      drawAllSparks(dt);

      // Gleam
      drawGleam(cx, cy);

      // Vignette
      let vigAlpha = 0.45;
      if (phase === "finisher")
        vigAlpha = Math.max(0.1, 0.45 * (1 - Math.min(1, phaseTime / 3.5)));
      else if (phase === "resolved") vigAlpha = 0.1;
      const vig = ctx.createRadialGradient(
        cx,
        cy,
        Math.min(W, H) * 0.2,
        cx,
        cy,
        Math.max(W, H) * 0.72,
      );
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, `rgba(0,0,0,${vigAlpha})`);
      ctx.fillStyle = vig;
      ctx.fillRect(-20, -20, W + 40, H + 40);

      ctx.restore();
      requestAnimationFrame(frame);
    }

    frame();
    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
    };
  }, [fid, startRect, onDone]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-50"
      style={{ width: "100vw", height: "100vh" }}
    />
  );
}
