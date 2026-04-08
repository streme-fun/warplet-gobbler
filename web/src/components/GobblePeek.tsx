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

    // Responsive: smaller jaws + eyes on mobile
    const mobile = () => W < 640;
    const restTop = () => (mobile() ? 120 : 190);
    const restBot = () => (mobile() ? 110 : 180);
    let topY = restTop();
    let botY = H - restBot();

    function sr(s: number) {
      const v = Math.sin(s * 127.1 + 311.7) * 43758.5453;
      return v - Math.floor(v);
    }

    const VC = "#040404";

    // Jaw edge blobs
    const bumps: {
      jaw: number;
      xf: number;
      r: number;
      yo: number;
      ph: number;
    }[] = [];
    for (let jaw = 0; jaw < 2; jaw++) {
      for (let i = 0; i < 60; i++) {
        const s = jaw * 1000 + i * 31;
        bumps.push({
          jaw,
          xf: (i + 0.3 + sr(s) * 0.4) / 60,
          r: 6 + sr(s + 11) * 13,
          yo: sr(s + 23) * 4 - 2,
          ph: sr(s + 37) * 6.28,
        });
      }
    }

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
      const ey = topJawY - eyeOffset + Math.sin(t * 0.6) * 2;
      for (const eyeX of [W * 0.34, W * 0.66]) {
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

      // Jaw bodies
      gx!.fillRect(-30, -500, W + 60, 500 + topY + 4);
      gx!.fillRect(-30, botY - 4, W + 60, 500 + H);

      // Edge blobs — with optional lip wave
      for (const b of bumps) {
        const x = b.xf * W;
        const br = Math.sin(t * 0.5 + b.ph) * 2;
        let r = b.r + br;
        let baseY = b.jaw === 0 ? topY + b.yo + 4 : botY + b.yo - 4;

        // Lip wave: travelling ripple from center outward
        // Bumps push AWAY from the jaw body (downward for top jaw, upward for bottom)
        // so they protrude visibly past the solid rect edge
        if (lipWaveTime >= 0) {
          const progress = lipWaveTime / LIP_WAVE_DURATION;
          const distFromCenter = Math.abs(b.xf - 0.5);
          const waveFront = progress * 0.65;
          const dist = Math.abs(distFromCenter - waveFront);
          const envelope =
            Math.max(0, 1 - dist * 6) * Math.min(1, (1 - progress) * 2);
          const waveDisp =
            envelope *
            (Math.sin(distFromCenter * 25 - lipWaveTime * 0.35) * 0.5 + 0.5) *
            40;
          // Top jaw: push down (positive Y), bottom jaw: push up (negative Y)
          baseY += b.jaw === 0 ? waveDisp : -waveDisp;
          r += envelope * 8;
        }

        gx!.beginPath();
        gx!.arc(x, baseY, Math.max(1, r), 0, 6.28);
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
      botY = H - restBot();
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
