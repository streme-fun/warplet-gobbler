"use client";

import { useEffect, useRef } from "react";

/** Always-visible gobbler — jaws + eyes frame the screen, mouth open until gobble. */
export default function GobblePeek({ hidden = false }: { hidden?: boolean }) {
  const gooRef = useRef<HTMLCanvasElement>(null);
  const jawBackdropRef = useRef<HTMLCanvasElement>(null);
  const eyeRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const gooCv = gooRef.current;
    const backdropCv = jawBackdropRef.current;
    const eyeCv = eyeRef.current;
    if (!gooCv || !backdropCv || !eyeCv) return;
    const gx = gooCv.getContext("2d");
    const bx = backdropCv.getContext("2d");
    const ex = eyeCv.getContext("2d");
    if (!gx || !bx || !ex) return;

    let W = window.innerWidth;
    let H = window.innerHeight;
    gooCv.width = W;
    gooCv.height = H;
    backdropCv.width = W;
    backdropCv.height = H;
    eyeCv.width = W;
    eyeCv.height = H;

    let cancelled = false;
    let time = 0;
    // Eye reaction state: 0 = idle, ramps up on bid, decays back
    let eyeReact = 0;
    let eyeReactTarget = 0;

    // Lip wave state: when > 0, bumps ripple outward from center
    let lipWaveTime = -1; // -1 = inactive
    const LIP_WAVE_DURATION = 150; // frames (~2.5s at 60fps)

    const onBidPlaced = () => {
      eyeReactTarget = 1;
      setTimeout(() => {
        eyeReactTarget = 0;
      }, 1200);
    };
    const onLipWave = () => {
      lipWaveTime = 0;
    };
    window.addEventListener("gobbler:bid-placed", onBidPlaced);
    window.addEventListener("gobbler:lip-wave", onLipWave);

    // Responsive: smaller jaws + eyes on mobile.
    // Trimmed twice from the original 120/190 (top) and 50/70 (bottom):
    // first by 10% to free up vertical UI space, then another 10% on the
    // valley (middle) since the desktop edge bow already adds back ~85px at
    // the corners and the valley felt too thick. Bottom trimmed again to
    // reclaim vertical space for page content (valley only; footer lift unchanged).
    const mobile = () => W < 640;
    const restTop = () => (mobile() ? 97 : 154);
    const restBot = () => (mobile() ? 30 : 0);
    // CaFooter (fixed bottom-0, bg-black/90) uses py-3 sm:py-4 and z-50, so it
    // stacks above the gobbler canvas (z-40 / z-46). If footerOverlay is too
    // small, the bottom lip and its curve are drawn behind the footer and look
    // flat. Lift the bot jaw by enough padding to keep the lip visible.
    const footerOverlay = () => (mobile() ? 52 : 84);

    // Desktop only: both jaws share the same parabolic bow (u²) so top and
    // bottom lip curvature matches.
    const EDGE_AMP_PX = 85;
    const edgeOffsetTop = (x: number) => {
      if (mobile()) return 0;
      const u = (x / W - 0.5) * 2;
      return EDGE_AMP_PX * u * u;
    };
    const edgeOffsetBot = (x: number) => {
      if (mobile()) return 0;
      const u = (x / W - 0.5) * 2;
      return EDGE_AMP_PX * u * u;
    };

    // Goo filter: a huge filled area *below* the bottom lip blurs upward and
    // the alpha threshold reads as a flat line. Keep only a finite band in
    // the filtered canvas; unfiltered fill continues on `jawBackdrop`.
    const BOTTOM_JAW_GOOPY_DEPTH = 300;
    const JAW_BACKDROP_OVERLAP = 4;

    let topY = restTop();
    let botY = H - footerOverlay() - restBot();

    function sr(s: number) {
      const v = Math.sin(s * 127.1 + 311.7) * 43758.5453;
      return v - Math.floor(v);
    }

    const VC = "#040404";

    // Jaw edge blobs.
    // Count is computed from viewport width with a target spacing of ~22px.
    // The previous version had a min-count of 28 which actually *forced*
    // tighter spacing on narrow viewports (e.g. W=300 → 28/300 = 10.7px),
    // making the goo filter (stdDev=6, alpha threshold ~0.41) merge them
    // into a flat band so the bottom teeth disappeared. Now the count drops
    // freely on narrow widths so spacing stays roughly constant.
    //
    // Also: yo variance is widened to a full 12px range (was ±2) so peaks
    // and valleys read distinctly through the 6px blur. Critically, yo is
    // *signed per jaw* so every blob pokes OUT of the body — top jaw blobs
    // get positive yo (drop down into the viewport) and bottom jaw blobs
    // get negative yo (rise up into the viewport). The original ±2 range
    // half-buried blobs in the body but got away with it because blob radii
    // (6–19) dwarfed the offset; widening to ±6 exposed the bug because
    // small (r=6) blobs with the wrong-signed yo became fully buried.
    let bumps: {
      jaw: number;
      xf: number;
      r: number;
      yo: number;
      ph: number;
    }[] = [];
    let lastBumpsCount = 0;
    const TARGET_SPACING_PX = 22;
    const computeBumpsCount = () =>
      Math.max(8, Math.min(160, Math.round(W / TARGET_SPACING_PX)));
    const regenerateBumps = () => {
      const count = computeBumpsCount();
      if (count === lastBumpsCount) return;
      lastBumpsCount = count;
      bumps = [];
      for (let jaw = 0; jaw < 2; jaw++) {
        // Top jaw teeth point down (+y), bottom jaw teeth point up (-y).
        const yoSign = jaw === 0 ? 1 : -1;
        for (let i = 0; i < count; i++) {
          const s = jaw * 1000 + i * 31;
          bumps.push({
            jaw,
            xf: (i + 0.3 + sr(s) * 0.4) / count,
            r: 6 + sr(s + 11) * 13,
            // 0..12 px outward jitter so every blob pokes out as a tooth.
            yo: yoSign * (1 + sr(s + 23) * 11),
            ph: sr(s + 37) * 6.28,
          });
        }
      }
    };
    regenerateBumps();

    function drawEyes(topJawY: number) {
      ex!.clearRect(0, 0, W, H);

      // Lerp eye reaction toward target
      eyeReact += (eyeReactTarget - eyeReact) * 0.08;

      const m = mobile();
      const baseGlowR = m ? 60 : 120;
      const baseOrbR = m ? 16 : 30;
      const eyeOffset = m ? 35 : 65;

      // React: eyes widen + glow intensifies
      const r = eyeReact;
      const glowR = baseGlowR + r * (m ? 30 : 60);
      const orbR = baseOrbR + r * (m ? 6 : 12);
      const glowIntensity = 0.1 + r * 0.35;
      const glowMid = 0.04 + r * 0.15;
      // Shift color toward secondary purple (#7B61FF) when reacting
      const glowColor =
        r > 0.01
          ? `rgba(${Math.round(220 - r * 97)},${Math.round(200 - r * 103)},255,${glowIntensity})`
          : `rgba(220,200,255,${glowIntensity})`;
      const glowMidColor =
        r > 0.01
          ? `rgba(${Math.round(160 - r * 37)},${Math.round(120 - r * 23)},${Math.round(220 + r * 35)},${glowMid})`
          : `rgba(160,120,220,${glowMid})`;

      const t = time * 0.01;
      // Eye y follows the curved jaw edge at each eye's x position so the
      // eyes sit just above the jaw on both flat (mobile) and bowed (desktop).
      const eyeXs = [W * 0.34, W * 0.66];
      for (const eyeX of eyeXs) {
        const ey =
          topJawY + edgeOffsetTop(eyeX) - eyeOffset + Math.sin(t * 0.6) * 2;
        ex!.save();
        // Ambient glow
        const g1 = ex!.createRadialGradient(eyeX, ey, 0, eyeX, ey, glowR);
        g1.addColorStop(0, glowColor);
        g1.addColorStop(0.3, glowMidColor);
        g1.addColorStop(1, "rgba(0,0,0,0)");
        ex!.fillStyle = g1;
        ex!.beginPath();
        ex!.arc(eyeX, ey, glowR, 0, Math.PI * 2);
        ex!.fill();
        // Eye orb
        ex!.beginPath();
        ex!.arc(eyeX, ey, orbR, 0, Math.PI * 2);
        ex!.fillStyle =
          r > 0.01
            ? `rgba(${Math.round(255 - r * 132)},${Math.round(245 - r * 148)},255,1)`
            : "rgba(255,245,255,1)";
        ex!.fill();
        ex!.restore();
      }
    }

    function frame() {
      if (cancelled) return;
      time++;

      // Advance lip wave
      if (lipWaveTime >= 0) {
        lipWaveTime++;
        if (lipWaveTime > LIP_WAVE_DURATION) lipWaveTime = -1;
      }

      // Subtle breathing: jaws shift ±4px slowly
      const breath = Math.sin(time * 0.008) * 4;
      topY = restTop() + breath;
      botY = H - footerOverlay() - restBot() - breath;

      gx!.clearRect(0, 0, W, H);

      const t = time * 0.007;
      gx!.fillStyle = VC;

      // Compute lip wave max displacement per jaw before drawing rects
      let topWaveMax = 0;
      let botWaveMax = 0;
      const blobData: { x: number; y: number; r: number }[] = [];

      // Edge blobs — with optional lip wave (outward from jaw body)
      for (const b of bumps) {
        const x = b.xf * W;
        const br = Math.sin(t * 0.5 + b.ph) * 2;
        let r = b.r + br;
        const offTop = edgeOffsetTop(x);
        const offBot = edgeOffsetBot(x);
        const topEdgeY = topY + offTop;
        const botEdgeY = botY - offBot;
        let baseY = b.jaw === 0 ? topEdgeY + b.yo + 4 : botEdgeY + b.yo - 4;

        // Lip wave: travelling ripple from center outward
        if (lipWaveTime >= 0) {
          const progress = lipWaveTime / LIP_WAVE_DURATION;
          const distFromCenter = Math.abs(b.xf - 0.5);
          const waveFront = progress * 0.35;
          const dist = Math.abs(distFromCenter - waveFront);
          const envelope =
            Math.max(0, 1 - dist * 6) * Math.min(1, (1 - progress) * 2);
          const waveDisp =
            envelope *
            (Math.sin(distFromCenter * 25 - lipWaveTime * 0.25) * 0.5 + 0.5) *
            40;
          // Top jaw: push down (outward), bottom jaw: push up (outward)
          baseY += b.jaw === 0 ? waveDisp : -waveDisp;
          r += envelope * 8;
          if (b.jaw === 0 && waveDisp > topWaveMax) topWaveMax = waveDisp;
          if (b.jaw === 1 && waveDisp > botWaveMax) botWaveMax = waveDisp;
        }

        blobData.push({ x, y: baseY, r: Math.max(1, r) });
      }

      const bottomLipY = (x: number) =>
        botY - edgeOffsetBot(x) - 4 - botWaveMax;

      // Solid black below the goo band (no blur) — avoids losing the lip curve.
      bx!.clearRect(0, 0, W, H);
      bx!.fillStyle = VC;
      const bandBottomY = bottomLipY(W * 0.5) + BOTTOM_JAW_GOOPY_DEPTH;
      if (bandBottomY < H) {
        bx!.fillRect(
          0,
          bandBottomY - JAW_BACKDROP_OVERLAP,
          W,
          H - bandBottomY + JAW_BACKDROP_OVERLAP
        );
      }

      // Jaw bodies — sampled curved paths so the edges bow inward on desktop.
      // Extends by max wave displacement so blobs sit on a continuous fill.
      const SAMPLE = 12;
      // Top jaw: trace the bottom edge from right to left as a curve.
      gx!.beginPath();
      gx!.moveTo(-30, -500);
      gx!.lineTo(W + 30, -500);
      for (let x = W + 30; x >= -30; x -= SAMPLE) {
        gx!.lineTo(x, topY + edgeOffsetTop(x) + 4 + topWaveMax);
      }
      gx!.closePath();
      gx!.fill();
      // Bottom jaw: curved lip + parallel lower edge (finite depth — not to H).
      gx!.beginPath();
      gx!.moveTo(-30, bottomLipY(-30) + BOTTOM_JAW_GOOPY_DEPTH);
      gx!.lineTo(W + 30, bottomLipY(W + 30) + BOTTOM_JAW_GOOPY_DEPTH);
      for (let x = W + 30; x >= -30; x -= SAMPLE) {
        gx!.lineTo(x, bottomLipY(x));
      }
      gx!.closePath();
      gx!.fill();

      // Draw blobs
      for (const bd of blobData) {
        gx!.beginPath();
        gx!.arc(bd.x, bd.y, bd.r, 0, 6.28);
        gx!.fill();
      }

      // Eyes on separate unfiltered canvas
      drawEyes(topY);

      requestAnimationFrame(frame);
    }

    frame();

    const onResize = () => {
      if (!gooCv || !backdropCv || !eyeCv) return;
      W = window.innerWidth;
      H = window.innerHeight;
      gooCv.width = W;
      gooCv.height = H;
      backdropCv.width = W;
      backdropCv.height = H;
      eyeCv.width = W;
      eyeCv.height = H;
      topY = restTop();
      botY = H - footerOverlay() - restBot();
      regenerateBumps();
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
      window.removeEventListener("gobbler:bid-placed", onBidPlaced);
      window.removeEventListener("gobbler:lip-wave", onLipWave);
    };
  }, []);

  return (
    <>
      {/* Unfiltered fill below the bottom goo band (see BOTTOM_JAW_GOOPY_DEPTH) */}
      <canvas
        ref={jawBackdropRef}
        className="fixed inset-0 pointer-events-none transition-opacity duration-500"
        style={{
          width: "100vw",
          height: "100vh",
          zIndex: 38,
          opacity: hidden ? 0 : 1,
        }}
      />
      {/* Goo-filtered jaw wrapper: GPU-accelerated metaball equivalent of the
          old SVG feGaussianBlur + colorMatrix filter.
            - White bg + blur(6px) contrast(20) = hard-edged threshold on blur
            - mix-blend-mode: multiply drops the wrapper's white areas against
              the page, leaving only the hard dark silhouette.
          filter: url() was CPU-rasterized full-viewport every frame in WebKit,
          which tanked ambient framerate. This stack is GPU-composited. */}
      <div
        className="fixed inset-0 pointer-events-none transition-opacity duration-500"
        style={{
          width: "100vw",
          height: "100vh",
          zIndex: 40,
          background: "#fff",
          filter: "blur(6px) contrast(20)",
          mixBlendMode: "multiply",
          opacity: hidden ? 0 : 1,
        }}
      >
        <canvas
          ref={gooRef}
          className="absolute inset-0"
          style={{ width: "100%", height: "100%" }}
        />
      </div>
      {/* Crisp eye canvas (no goo filter) */}
      <canvas
        ref={eyeRef}
        className="fixed inset-0 pointer-events-none transition-opacity duration-500"
        style={{
          width: "100vw",
          height: "100vh",
          zIndex: 46,
          opacity: hidden ? 0 : 1,
        }}
      />
    </>
  );
}
