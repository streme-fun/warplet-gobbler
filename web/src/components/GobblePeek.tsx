"use client";

import { useEffect, useRef } from "react";

/** Always-visible gobbler — jaws + eyes frame the screen, mouth open until gobble. */
export default function GobblePeek({ hidden = false }: { hidden?: boolean }) {
  const gooRef = useRef<HTMLCanvasElement>(null);
  const eyeRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const gooCv = gooRef.current;
    const eyeCv = eyeRef.current;
    if (!gooCv || !eyeCv) return;
    const gx = gooCv.getContext("2d");
    const ex = eyeCv.getContext("2d");
    if (!gx || !ex) return;

    let W = window.innerWidth;
    let H = window.innerHeight;
    gooCv.width = W;
    gooCv.height = H;
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
    // Reduced ~10% from the prior 120/190 (top) and 50/70 (bottom) to free up
    // more vertical UI space.
    const mobile = () => W < 640;
    const restTop = () => (mobile() ? 108 : 171);
    const restBot = () => (mobile() ? 45 : 63);

    // Desktop only: jaws bow inward as an additive pixel offset, so the
    // hill-to-valley delta is identical on top and bottom (~85px). Smooth
    // quadratic falloff: 0 in the middle, peaks at the edges.
    const EDGE_AMP_PX = 85;
    const edgeOffset = (x: number) => {
      if (mobile()) return 0;
      const u = (x / W - 0.5) * 2; // -1 at left edge, 0 in middle, 1 at right edge
      return EDGE_AMP_PX * u * u;
    };

    let topY = restTop();
    let botY = H - restBot();

    function sr(s: number) {
      const v = Math.sin(s * 127.1 + 311.7) * 43758.5453;
      return v - Math.floor(v);
    }

    const VC = "#040404";

    // Jaw edge blobs.
    // Count scales with viewport width so that at narrow widths the blobs
    // don't pack tightly enough for the goo filter (stdDev=6, alpha threshold)
    // to merge them into a flat band — which made the bottom teeth visually
    // disappear on small windows. Target spacing ~16px.
    let bumps: {
      jaw: number;
      xf: number;
      r: number;
      yo: number;
      ph: number;
    }[] = [];
    let lastBumpsCount = 0;
    const computeBumpsCount = () =>
      Math.max(28, Math.min(120, Math.round(W / 16)));
    const regenerateBumps = () => {
      const count = computeBumpsCount();
      if (count === lastBumpsCount) return;
      lastBumpsCount = count;
      bumps = [];
      for (let jaw = 0; jaw < 2; jaw++) {
        for (let i = 0; i < count; i++) {
          const s = jaw * 1000 + i * 31;
          bumps.push({
            jaw,
            xf: (i + 0.3 + sr(s) * 0.4) / count,
            r: 6 + sr(s + 11) * 13,
            yo: sr(s + 23) * 4 - 2,
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
          topJawY + edgeOffset(eyeX) - eyeOffset + Math.sin(t * 0.6) * 2;
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
      botY = H - restBot() - breath;

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
        // Apply edge curvature: same additive pixel offset for both jaws so
        // hill-to-valley delta matches top vs bottom.
        const off = edgeOffset(x);
        const topEdgeY = topY + off;
        const botEdgeY = botY - off;
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

      // Jaw bodies — sampled curved paths so the edges bow inward on desktop.
      // Extends by max wave displacement so blobs sit on a continuous fill.
      const SAMPLE = 12;
      // Top jaw: trace the bottom edge from right to left as a curve.
      gx!.beginPath();
      gx!.moveTo(-30, -500);
      gx!.lineTo(W + 30, -500);
      for (let x = W + 30; x >= -30; x -= SAMPLE) {
        gx!.lineTo(x, topY + edgeOffset(x) + 4 + topWaveMax);
      }
      gx!.closePath();
      gx!.fill();
      // Bottom jaw: trace the top edge from left to right as a curve.
      gx!.beginPath();
      gx!.moveTo(-30, H + 500);
      gx!.lineTo(W + 30, H + 500);
      for (let x = W + 30; x >= -30; x -= SAMPLE) {
        gx!.lineTo(x, botY - edgeOffset(x) - 4 - botWaveMax);
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
      if (!gooCv || !eyeCv) return;
      W = window.innerWidth;
      H = window.innerHeight;
      gooCv.width = W;
      gooCv.height = H;
      eyeCv.width = W;
      eyeCv.height = H;
      topY = restTop();
      botY = H - restBot();
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
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <filter id="peekGooFilter" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="b" />
            <feColorMatrix
              in="b"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9"
            />
          </filter>
        </defs>
      </svg>
      {/* Goo-filtered jaw canvas */}
      <canvas
        ref={gooRef}
        className="fixed inset-0 pointer-events-none transition-opacity duration-500"
        style={{
          width: "100vw",
          height: "100vh",
          zIndex: 40,
          filter: "url(#peekGooFilter)",
          opacity: hidden ? 0 : 1,
        }}
      />
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
