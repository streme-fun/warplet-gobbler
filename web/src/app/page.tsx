"use client";

import { useAccount, useConnect, useDisconnect, usePublicClient } from "wagmi";
import { ConnectKitButton } from "connectkit";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatUnits, type Address } from "viem";
import { useMiniApp } from "@/hooks/useMiniApp";
import { useOwnedWarplets } from "@/hooks/useOwnedWarplets";
import { CONTRACTS, ZERO_ADDRESS } from "@/lib/contracts";
import {
  useDutchAuctionActions,
  useDutchAuctionPayoutStream,
  useDutchAuctionPayoutToken,
  useDutchAuctionPrice,
  useWarpgobbUsdPrice,
} from "@/hooks/useDutchAuction";
import { useAuctionSellAuction } from "@/hooks/useAuctionSell";
import { useAuctionSell777Bid } from "@/hooks/useAuctionSell777Bid";
import AbyssBackground from "@/components/AbyssBackground";
import ParallaxBackground from "@/components/ParallaxBackground";
import Particles from "@/components/Particles";
import GobbleOverlay from "@/components/GobbleOverlay";
import GobblePeek from "@/components/GobblePeek";
import BuyOverlay from "@/components/BuyOverlay";
import GobblerAuctionSection from "@/components/GobblerAuctionSection";
import FlyingWarplet from "@/components/FlyingWarplet";
import SellSection from "@/components/SellSection";
import { warpletImageSrc } from "@/lib/warplet-image-src";
import {
  GOBBLE_TRANSACTION_REVERTED_FRIENDLY,
  formatGobbleSellTxError,
  formatUserFacingTxError,
} from "@/lib/format-tx-error";

/* eslint-disable @next/next/no-img-element */

/** Lerp between two SVG path strings that share the same command structure. */
function lerpPath(a: string, b: string, t: number): string {
  const numsA = a.match(/-?\d+\.?\d*/g) ?? [];
  const numsB = b.match(/-?\d+\.?\d*/g) ?? [];
  let i = 0;
  return a.replace(/-?\d+\.?\d*/g, () => {
    const va = parseFloat(numsA[i] ?? "0");
    const vb = parseFloat(numsB[i] ?? "0");
    i++;
    return (va + (vb - va) * t).toFixed(1);
  });
}

const MORPH_SHAPES = [
  {
    // Left tendril — tall & narrow (buy) → wide & curving (sell)
    buy: "M-50,900 C50,700 120,500 80,350 C40,200 -20,150 30,50 C60,-20 150,0 200,80 C250,160 180,300 200,450 C220,600 350,750 300,900 Z",
    sell: "M-50,900 C20,750 180,600 150,400 C120,200 50,100 100,0 C180,-30 280,60 320,180 C360,300 280,450 320,580 C360,720 450,820 380,900 Z",
    opacity: 0.25,
  },
  {
    // Right blob — compact (buy) → spreading tentacles (sell)
    buy: "M1440,200 C1350,180 1280,250 1250,350 C1220,450 1280,550 1200,620 C1120,690 1050,650 1000,720 C950,790 980,900 1060,900 L1440,900 Z",
    sell: "M1440,150 C1320,130 1220,200 1180,320 C1140,440 1200,500 1100,580 C1000,660 920,600 860,700 C800,800 850,900 950,900 L1440,900 Z",
    opacity: 0.2,
  },
  {
    // Central drip — thin flame (buy) → wider organic (sell)
    buy: "M700,0 C720,80 680,160 710,250 C740,340 800,380 780,480 C760,580 690,550 680,650 C670,750 720,800 700,900 C690,900 660,800 650,700 C640,600 610,580 630,480 C650,380 590,340 620,250 C650,160 610,80 630,0 Z",
    sell: "M680,0 C740,100 650,200 700,300 C750,400 840,420 800,530 C760,640 660,620 640,720 C620,820 690,860 660,900 C640,900 600,850 610,740 C620,630 550,610 590,510 C630,410 540,380 580,280 C620,180 570,90 620,0 Z",
    opacity: 0.18,
  },
  {
    // Mid-left drip
    buy: "M400,0 C420,60 380,120 410,200 C440,280 400,350 420,450 C430,500 410,520 400,550 C390,520 370,500 380,450 C400,350 360,280 390,200 C420,120 380,60 400,0 Z",
    sell: "M380,0 C440,80 350,160 400,260 C450,360 380,420 410,520 C420,570 390,600 370,630 C350,600 330,570 350,510 C370,420 300,350 360,250 C420,150 340,70 380,0 Z",
    opacity: 0.15,
  },
  {
    // Bottom wave
    buy: "M0,900 C100,800 300,820 500,780 C700,740 800,800 1000,760 C1200,720 1350,800 1440,750 L1440,900 Z",
    sell: "M0,900 C120,830 250,860 450,810 C650,760 750,830 950,790 C1150,750 1300,830 1440,780 L1440,900 Z",
    opacity: 0.2,
  },
];

const FIRST_SELL_VISIT_KEY = "warpletgobbler:first-sell-visit-complete";

function MorphingSilhouettes({ scrollBlend }: { scrollBlend: number }) {
  return (
    <svg
      className="fixed inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {MORPH_SHAPES.map((shape, i) => (
        <path
          key={i}
          d={lerpPath(shape.buy, shape.sell, scrollBlend)}
          fill={`rgba(0,0,0,${shape.opacity})`}
        />
      ))}
    </svg>
  );
}

function MiniAppWalletButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  // Auto-connect: inside a Farcaster mini app the wallet is already
  // available via the host client — connect eagerly so the user never
  // sees a "Connect Wallet" button.
  useEffect(() => {
    if (isConnected) return;
    const fc =
      connectors.find((c) => c.id === "farcasterMiniApp") ?? connectors[0];
    if (fc) connect({ connector: fc });
  }, [isConnected, connectors, connect]);

  if (isConnected) {
    return (
      <button
        onClick={() => disconnect()}
        className="text-xs px-2 py-0.5 text-base-content/60 hover:text-base-content transition-colors"
      >
        {address?.slice(0, 4)}…{address?.slice(-3)}
      </button>
    );
  }

  // Fallback: if auto-connect hasn't resolved yet, show nothing
  // (avoids a flash of "Connect Wallet" in the mini app)
  return null;
}

function GobblerBootOverlay({
  opening,
  onDone,
}: {
  opening: boolean;
  onDone: () => void;
}) {
  const bgRef = useRef<HTMLCanvasElement>(null);
  const gooRef = useRef<HTMLCanvasElement>(null);
  const topRef = useRef<HTMLCanvasElement>(null);
  const openingRef = useRef(opening);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    openingRef.current = opening;
  }, [opening]);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const bgCv = bgRef.current;
    const gooCv = gooRef.current;
    const topCv = topRef.current;
    if (!bgCv || !gooCv || !topCv) return;
    const bgCx = bgCv.getContext("2d");
    const gx = gooCv.getContext("2d");
    const tx = topCv.getContext("2d");
    if (!bgCx || !gx || !tx) return;

    let W = window.innerWidth;
    let H = window.innerHeight;
    let MID = H / 2;

    for (const cv of [bgCv, gooCv, topCv]) {
      if (!cv) continue;
      cv.width = W;
      cv.height = H;
    }

    let time = 0;
    let phase = 1;
    let pt = 0;
    let topY = MID - 3,
      botY = MID + 3,
      topT = MID - 3,
      botT = MID + 3;
    let pTopY = MID - 3,
      pBotY = MID + 3;
    let dark = 1,
      darkT = 1,
      eyeA = 0,
      eyeAT = 0;
    let cancelled = false;

    function lerp(a: number, b: number, t: number) {
      return a + (b - a) * t;
    }
    function sr(s: number) {
      const v = Math.sin(s * 127.1 + 311.7) * 43758.5453;
      return v - Math.floor(v);
    }
    function clamp(v: number, a: number, b: number) {
      return v < a ? a : v > b ? b : v;
    }

    const VC = "#040404";
    const mobile = () => W < 640;

    const TARGET_SPACING_PX = 22;
    const bumps: {
      jaw: number;
      xf: number;
      r: number;
      yo: number;
      ph: number;
    }[] = [];
    function regenerateBumps() {
      bumps.length = 0;
      const count = Math.max(
        8,
        Math.min(160, Math.round(W / TARGET_SPACING_PX)),
      );
      for (let jaw = 0; jaw < 2; jaw++) {
        const yoSign = jaw === 0 ? 1 : -1;
        for (let i = 0; i < count; i++) {
          const s = jaw * 1000 + i * 31;
          bumps.push({
            jaw,
            xf: (i + 0.3 + sr(s) * 0.4) / count,
            r: 6 + sr(s + 11) * 13,
            yo: yoSign * (1 + sr(s + 23) * 11),
            ph: sr(s + 37) * 6.28,
          });
        }
      }
    }
    regenerateBumps();

    function resize() {
      W = window.innerWidth;
      H = window.innerHeight;
      MID = H / 2;
      for (const cv of [bgCv, gooCv, topCv]) {
        if (!cv) continue;
        cv.width = W;
        cv.height = H;
      }
      regenerateBumps();
    }
    window.addEventListener("resize", resize);

    const SN = 16;
    const CPS = 30;
    const strands: {
      xf: number;
      br: number;
      wf: number;
      wa: number;
      ph: number;
      bd: number;
      was: boolean;
    }[] = [];
    for (let i = 0; i < SN; i++) {
      const s = i * 137 + 42;
      strands.push({
        xf: 0.05 + sr(s) * 0.9,
        br: 6 + sr(s + 11) * 9,
        wf: 0.25 + sr(s + 33) * 0.7,
        wa: 5 + sr(s + 55) * 16,
        ph: sr(s + 77) * 6.28,
        bd: 300 + sr(s + 99) * 350,
        was: false,
      });
    }

    const drops: {
      on: boolean;
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
      a: number;
    }[] = [];
    for (let i = 0; i < 40; i++)
      drops.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, r: 0, a: 1 });

    function spawnDrop(x: number, y: number, r: number) {
      for (const d of drops) {
        if (!d.on) {
          d.on = true;
          d.x = x + (Math.random() - 0.5) * 8;
          d.y = y;
          d.vx = (Math.random() - 0.5) * 1.5;
          d.vy = 0.3 + Math.random() * 2;
          d.r = Math.max(1.5, r * 0.3 + Math.random() * r * 0.5);
          d.a = 1;
          return;
        }
      }
    }

    function drawBg() {
      bgCx!.fillStyle = "rgba(0,0,0,0)";
      bgCx!.clearRect(0, 0, W, H);
      if (dark > 0.001) {
        bgCx!.fillStyle = `rgba(4,4,4,${dark})`;
        bgCx!.fillRect(0, 0, W, H);
      }
    }

    function drawGoo() {
      const t = time * 0.007;
      gx!.clearRect(0, 0, W, H);
      gx!.fillStyle = VC;

      gx!.fillRect(-30, -500, W + 60, 500 + topY + 4);
      gx!.fillRect(-30, botY - 4, W + 60, 500 + H);

      for (const b of bumps) {
        const x = b.xf * W;
        const br = Math.sin(t * 0.5 + b.ph) * 2;
        const r = b.r + br;
        const y = b.jaw === 0 ? topY + b.yo + 4 : botY + b.yo - 4;
        gx!.beginPath();
        gx!.arc(x, y, Math.max(1, r), 0, 6.28);
        gx!.fill();
      }

      const gap = botY - topY;
      const te = topY + 12;
      const be = botY - 12;
      const jv = Math.abs(topY - pTopY) + Math.abs(botY - pBotY);

      if (gap < 900 && gap > -30) {
        for (const s of strands) {
          const conn = gap < s.bd;
          const sx = s.xf * W;
          if (s.was && !conn) {
            const my = (te + be) / 2;
            for (let k = 0; k < 5; k++)
              spawnDrop(
                sx + (Math.random() - 0.5) * 10,
                my + (k - 2) * 10,
                s.br * 0.5,
              );
          }
          s.was = conn;
          if (!conn) continue;

          const dist = Math.max(0, be - te);
          const stretch = clamp(gap / s.bd, 0, 1);
          const wobble = Math.sin(t * s.wf + s.ph) * s.wa;
          const jolt = Math.sin(t * 3.5 + s.ph) * clamp(jv * 1.2, 0, 14);

          for (let j = 0; j < CPS; j++) {
            const f = j / (CPS - 1);
            const mid = 1 - Math.abs(f - 0.5) * 2;
            const mid2 = mid * mid;
            const sag =
              mid2 * gap * 0.22 + Math.sin(t * 0.6 + s.ph + j * 0.4) * 3 * mid;
            const cy = te + dist * f + sag;
            const cx_ = sx + (wobble + jolt) * mid * 0.6;
            const endBoost = j === 0 || j === CPS - 1 ? 1.5 : 1;
            const rMul = (1 - mid * (0.35 + stretch * 0.45)) * endBoost;
            const r = s.br * rMul * (1 - stretch * 0.25);
            if (r < 0.4) continue;
            gx!.beginPath();
            gx!.arc(cx_, cy, r, 0, 6.28);
            gx!.fill();
          }
        }
      }

      if (topY > -300 && Math.random() < 0.15) {
        const dx = Math.random() * W;
        spawnDrop(dx, topY + 10 + Math.random() * 8, 2 + Math.random() * 4);
      }

      for (const d of drops) {
        if (!d.on) continue;
        d.vy += 0.3;
        d.y += d.vy;
        d.x += d.vx;
        d.vx *= 0.98;
        d.a -= 0.008;
        d.r *= 0.998;
        if (d.a <= 0 || d.y > H + 30) {
          d.on = false;
          continue;
        }
        gx!.save();
        gx!.globalAlpha = clamp(d.a, 0, 1);
        gx!.beginPath();
        gx!.arc(d.x, d.y, Math.max(0.5, d.r), 0, 6.28);
        gx!.fill();
        gx!.restore();
      }
    }

    function drawTop() {
      tx!.clearRect(0, 0, W, H);
      if (eyeA > 0.005) {
        const m = mobile();
        const glowR = m ? 60 : 120;
        const orbR = m ? 16 : 30;
        const eyeOffset = m ? 35 : 65;
        const t = time * 0.01;
        const ey = topY - eyeOffset + Math.sin(t * 0.6) * 2;
        for (const ex of [W * 0.34, W * 0.66]) {
          tx!.save();
          tx!.globalAlpha = eyeA;
          const g1 = tx!.createRadialGradient(ex, ey, 0, ex, ey, glowR);
          g1.addColorStop(0, `rgba(220,200,255,${0.15 * eyeA})`);
          g1.addColorStop(0.3, `rgba(160,120,220,${0.06 * eyeA})`);
          g1.addColorStop(1, "rgba(0,0,0,0)");
          tx!.fillStyle = g1;
          tx!.beginPath();
          tx!.arc(ex, ey, glowR, 0, Math.PI * 2);
          tx!.fill();
          tx!.beginPath();
          tx!.arc(ex, ey, orbR, 0, Math.PI * 2);
          tx!.fillStyle = "rgba(255,245,255,1)";
          tx!.fill();
          tx!.restore();
        }
      }
    }

    // Boot phases — same lerp system as GobbleOverlay, reversed sequence:
    //   1: pure black → eyes fade in, jaws nearly closed
    //   2: eyes visible, jaws breathe — waiting for page ready
    //   3: jaws open wide (= GobbleOverlay phase 6)
    //   4: jaws off screen, dark fades (= GobbleOverlay phase 9) → onDone
    function update() {
      time++;
      pTopY = topY;
      pBotY = botY;

      const jSpd =
        phase <= 2 ? 0.008 : phase === 3 ? 0.02 : phase === 4 ? 0.03 : 0.02;
      topY = lerp(topY, topT, jSpd);
      botY = lerp(botY, botT, jSpd);
      dark = lerp(dark, darkT, 0.018);
      eyeA = lerp(eyeA, eyeAT, 0.012);
      pt++;

      if (phase === 1) {
        darkT = 0.97;
        eyeAT = 1;
        topT = MID - 4;
        botT = MID + 4;
        if (pt > 80) {
          phase = 2;
          pt = 0;
        }
      }
      if (phase === 2) {
        topT = MID - 4 + Math.sin(time * 0.02) * 2;
        botT = MID + 4 - Math.sin(time * 0.02) * 2;
        darkT = 0.97;
        eyeAT = 1;
        if (openingRef.current) {
          phase = 3;
          pt = 0;
        }
      }
      if (phase === 3) {
        const openHalf = mobile() ? Math.min(H * 0.35, 140) : 180;
        topT = MID - openHalf;
        botT = MID + openHalf;
        darkT = 0.92;
        eyeAT = 0;
        if (pt > 160) {
          phase = 4;
          pt = 0;
        }
      }
      if (phase === 4) {
        topT = -350;
        botT = H + 350;
        darkT = 0;
        if (topY < -100) eyeAT = 0;
        if (topY < -280 && dark < 0.03) {
          cancelled = true;
          onDoneRef.current();
        }
      }
    }

    function frame() {
      if (cancelled) return;
      drawBg();
      drawGoo();
      drawTop();
      update();
      requestAnimationFrame(frame);
    }

    frame();
    return () => {
      cancelled = true;
      window.removeEventListener("resize", resize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-[120]"
      style={{ width: "100vw", height: "100vh" }}
      aria-hidden
    >
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <filter id="bootGooFilter" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="b" />
            <feColorMatrix
              in="b"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9"
            />
          </filter>
        </defs>
      </svg>
      <canvas
        ref={bgRef}
        className="absolute inset-0"
        style={{ width: "100%", height: "100%" }}
      />
      <canvas
        ref={gooRef}
        className="absolute inset-0"
        style={{ width: "100%", height: "100%", filter: "url(#bootGooFilter)" }}
      />
      <canvas
        ref={topRef}
        className="absolute inset-0"
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}

export default function Home() {
  const { isLoaded, context, isMiniApp } = useMiniApp();
  const { isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [gobbling, setGobbling] = useState(false);
  const [warpletVisible, setWarpletVisible] = useState(true);
  const [selectedFid, setSelectedFid] = useState<number | null>(null);
  const [flyingFid, setFlyingFid] = useState<number | null>(null);
  const [flyRect, setFlyRect] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  // Buy overlay state
  const [buyingFid, setBuyingFid] = useState<number | null>(null);
  const [buyRect, setBuyRect] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const [boughtFids, setBoughtFids] = useState<Set<number>>(new Set());
  const [bidding, setBidding] = useState(false);
  const [auctionBidError, setAuctionBidError] = useState<string | null>(null);
  const auctionSell = useAuctionSellAuction();
  const { approveAndBid, isPending: bidTxPending } = useAuctionSell777Bid();
  const dutchAuctionPriceQuery = useDutchAuctionPrice();
  const currentPrice = dutchAuctionPriceQuery.data;
  const { symbol: payoutSymbol, decimals: payoutDecimals } =
    useDutchAuctionPayoutToken();
  const payoutStream = useDutchAuctionPayoutStream(
    currentPrice,
    payoutDecimals,
    dutchAuctionPriceQuery.dataUpdatedAt,
  );
  const { priceUsd: warpgobbPriceUsd } = useWarpgobbUsdPrice();
  const { gobbleWarplet, isWriting } = useDutchAuctionActions();
  const {
    warplets: ownedWarplets,
    isLoading: ownedWarpletsLoading,
    isError: ownedWarpletsError,
    warpletsConfigured,
  } = useOwnedWarplets();

  const pickerWarplets = useMemo(() => {
    if (!warpletsConfigured || !isConnected) {
      return [];
    }

    if (ownedWarpletsLoading && ownedWarplets.length === 0) {
      return [];
    }

    if (ownedWarpletsError) {
      return [];
    }

    if (ownedWarplets.length === 0) {
      return [];
    }

    return ownedWarplets.map((w) => ({
      fid: w.fid,
      name: w.name,
      imageSrc: w.imageSrc,
    }));
  }, [
    warpletsConfigured,
    isConnected,
    ownedWarpletsLoading,
    ownedWarpletsError,
    ownedWarplets,
  ]);

  const showWarpletPickerSkeleton =
    !warpletsConfigured ||
    !isConnected ||
    (warpletsConfigured &&
      isConnected &&
      !ownedWarpletsError &&
      ownedWarpletsLoading &&
      ownedWarplets.length === 0);

  useEffect(() => {
    if (
      selectedFid != null &&
      !pickerWarplets.some((w) => w.fid === selectedFid)
    ) {
      setSelectedFid(null);
    }
  }, [selectedFid, pickerWarplets, setSelectedFid]);

  const nowSecs = Math.floor(Date.now() / 1000);
  const auctionLot = auctionSell.auction;
  const auctionExpired =
    !!auctionLot &&
    !auctionLot.settled &&
    nowSecs >= Number(auctionLot.endTime);
  const auctionChainBidActive =
    auctionSell.configured &&
    !auctionSell.isError &&
    auctionLot != null &&
    auctionLot.tokenId > 0n;

  const auctionBidDisabled =
    !isConnected ||
    bidTxPending ||
    bidding ||
    (auctionChainBidActive &&
      (auctionSell.isPaused ||
        auctionExpired ||
        auctionSell.minNextBidAmount == null ||
        !auctionSell.bidTokenAddress));

  const [activeView, setActiveView] = useState<"sell" | "buy">("buy");
  const [scrollBlend, setScrollBlend] = useState(0); // 0 = buy (purple), 1 = sell (cyan)
  const [claimBlocking, setClaimBlocking] = useState<boolean | null>(null);
  const claimBlockingResolved = claimBlocking !== null;
  const claimBlockingActive = claimBlocking ?? false;
  const [initialViewResolved, setInitialViewResolved] = useState(false);
  const [bootDone, setBootDone] = useState(false);
  /** Hysteresis for jump-link label — avoids flip-flopping when scroll sits near 50% blend. */
  const viewHintScrollRef = useRef<"sell" | "buy">("buy");

  // Resolve startup target only after claim blocking status is known.
  useEffect(() => {
    if (!claimBlockingResolved) return;
    if (typeof window === "undefined") return;

    if (claimBlockingActive) {
      setInitialViewResolved(true);
      return;
    }

    const isFirstSellVisit =
      window.localStorage.getItem(FIRST_SELL_VISIT_KEY) == null;
    if (!isFirstSellVisit) {
      setInitialViewResolved(true);
      return;
    }

    viewHintScrollRef.current = "sell";
    setActiveView("sell");
    setScrollBlend(1);
    let cancelled = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 6;

    const settleAtSell = () => {
      if (cancelled) return;
      const sellSection = document.getElementById("sell-section");
      if (sellSection) {
        sellSection.scrollIntoView({ behavior: "auto" });
        window.localStorage.setItem(FIRST_SELL_VISIT_KEY, "1");
        setInitialViewResolved(true);
        return;
      }
      attempts += 1;
      if (attempts >= MAX_ATTEMPTS) {
        window.localStorage.setItem(FIRST_SELL_VISIT_KEY, "1");
        setInitialViewResolved(true);
        return;
      }
      requestAnimationFrame(settleAtSell);
    };

    requestAnimationFrame(settleAtSell);
    return () => {
      cancelled = true;
    };
  }, [claimBlockingResolved, claimBlockingActive]);

  const handleBootDone = useCallback(() => setBootDone(true), []);

  const rescueViewerDisplayName =
    context?.user != null
      ? (context.user.displayName ?? `FID ${context.user.fid}`)
      : null;

  const rescueViewerPfpUrl = (() => {
    const u = context?.user as
      | { pfpUrl?: string; pfp?: string; profileImageUrl?: string }
      | undefined;
    if (!u) return null;
    const url = u.pfpUrl ?? u.pfp ?? u.profileImageUrl;
    return typeof url === "string" && url.length > 0 ? url : null;
  })();

  // Scroll blend + buy/sell hint; rescue gate keeps sell section unmounted (no jump to sell).
  useEffect(() => {
    if (!claimBlockingResolved) return;

    if (claimBlockingActive) {
      viewHintScrollRef.current = "buy";
      setActiveView("buy");
      setScrollBlend(0);
      window.scrollTo(0, 0);
      return;
    }

    let rafId = 0;
    let pending = false;
    const compute = () => {
      pending = false;
      const sellEl = document.getElementById("sell-section");
      if (!sellEl) return;
      const sellTop = sellEl.getBoundingClientRect().top;
      const vh = window.innerHeight;
      const t = Math.max(0, Math.min(1, 1 - sellTop / vh));
      setScrollBlend(t);
      const prev = viewHintScrollRef.current;
      let next = prev;
      if (prev === "buy" && t >= 0.56) next = "sell";
      else if (prev === "sell" && t <= 0.44) next = "buy";
      if (next !== prev) {
        viewHintScrollRef.current = next;
        setActiveView(next);
      }
    };
    const onScroll = () => {
      if (pending) return;
      pending = true;
      rafId = requestAnimationFrame(compute);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    compute();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [claimBlockingResolved, claimBlockingActive]);

  const toggleView = useCallback((view: "sell" | "buy") => {
    viewHintScrollRef.current = view;
    setActiveView(view);
    const target = view === "buy" ? "auction" : "sell-section";
    document.getElementById(target)?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const cardRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const [isSelling, setIsSelling] = useState(false);
  const [sellError, setSellError] = useState<string | null>(null);
  /** Snapshot for GobbleOverlay: live `currentPrice` hits 0 right after gobble mines. */
  const [chestPayout, setChestPayout] = useState<{
    tokens: number;
    usd: number | null;
  } | null>(null);

  const displayPrice = currentPrice ?? BigInt(0);
  const payoutAmount = Number(formatUnits(displayPrice, payoutDecimals));
  // USD quote fallback rules:
  // - if payout amount is 0 => show $0.00
  // - if the payout amount hasn't loaded yet => show a very conservative $50k estimate
  //   (assumes a hypothetical market cap).
  const FX_EST_MARKET_CAP_USD = 50_000;

  const isAmountMissing = currentPrice === undefined;

  const isDutchAuctionConfigured =
    CONTRACTS.dutchAuction.toLowerCase() !== ZERO_ADDRESS.toLowerCase();

  const payoutUsd: number | null = isAmountMissing
    ? isDutchAuctionConfigured
      ? FX_EST_MARKET_CAP_USD
      : 0
    : payoutAmount === 0
      ? 0
      : warpgobbPriceUsd != null
        ? payoutAmount * warpgobbPriceUsd
        : null;

  const handleChestReveal = useCallback(() => {
    setWarpletVisible(false);
  }, []);
  const handleGobbleDone = useCallback(() => {
    setGobbling(false);
    setFlyingFid(null);
    setFlyRect(null);
    setSelectedFid(null);
    setWarpletVisible(true);
    setChestPayout(null);
  }, []);

  const startSellAnimation = useCallback((): boolean => {
    if (!selectedFid || gobbling || flyingFid) return false;
    const el = cardRefs.current.get(selectedFid);
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    setFlyRect({ x: rect.left, y: rect.top, w: rect.width, h: rect.height });
    setFlyingFid(selectedFid);
    return true;
  }, [selectedFid, gobbling, flyingFid]);

  const handleSell = useCallback(async () => {
    if (
      !selectedFid ||
      !isConnected ||
      !publicClient ||
      isSelling ||
      isWriting
    ) {
      return;
    }

    setSellError(null);
    setIsSelling(true);

    try {
      if (currentPrice === undefined) {
        setSellError("Waiting for Gobbler price — try again in a moment.");
        return;
      }
      const payoutWeiSnapshot = currentPrice;
      const chestTokens = Number(
        formatUnits(payoutWeiSnapshot, payoutDecimals),
      );
      const chestUsd =
        chestTokens === 0
          ? 0
          : warpgobbPriceUsd != null
            ? chestTokens * warpgobbPriceUsd
            : null;

      // On-chain min payout for this tx (1% slippage vs snapshot). Always abi-encoded into safeTransferFrom `data`.
      const minPrice = (payoutWeiSnapshot * BigInt(99)) / BigInt(100);
      const gobbleHash = await gobbleWarplet(selectedFid, minPrice);
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: gobbleHash,
      });
      if (receipt.status === "reverted") {
        setSellError(GOBBLE_TRANSACTION_REVERTED_FRIENDLY);
        return;
      }

      setChestPayout({ tokens: chestTokens, usd: chestUsd });
      if (!startSellAnimation()) {
        setChestPayout(null);
        setSellError(
          "Could not start reveal animation — scroll to your Warplet and try again.",
        );
      }
    } catch (err) {
      setSellError(formatGobbleSellTxError(err));
    } finally {
      setIsSelling(false);
    }
  }, [
    selectedFid,
    isConnected,
    publicClient,
    isSelling,
    isWriting,
    currentPrice,
    payoutDecimals,
    warpgobbPriceUsd,
    gobbleWarplet,
    startSellAnimation,
  ]);

  const handleBuy = useCallback(
    async (
      fid: number,
      rect: { x: number; y: number; w: number; h: number },
    ) => {
      if (buyingFid) return;

      const a = auctionSell.auction;
      const canSubmitOnChain =
        auctionSell.configured &&
        !auctionSell.isError &&
        a != null &&
        a.tokenId > 0n &&
        !a.settled &&
        !auctionSell.isPaused &&
        Math.floor(Date.now() / 1000) < Number(a.endTime) &&
        auctionSell.minNextBidAmount != null &&
        auctionSell.bidTokenAddress != null;

      if (canSubmitOnChain) {
        setAuctionBidError(null);
        setBidding(true);
        try {
          if (!publicClient) {
            setAuctionBidError("Something went wrong. Try again in a moment.");
            return;
          }
          const hash = await approveAndBid({
            amount: auctionSell.minNextBidAmount!,
            bidTokenAddress: auctionSell.bidTokenAddress!,
          });
          await publicClient.waitForTransactionReceipt({ hash });
          await auctionSell.refetchAuction();
          setBuyingFid(fid);
          setBuyRect(rect);
        } catch (err) {
          setAuctionBidError(formatUserFacingTxError(err));
        } finally {
          setBidding(false);
        }
        return;
      }

      setBuyingFid(fid);
      setBuyRect(rect);
    },
    [buyingFid, auctionSell, publicClient, approveAndBid],
  );

  const handleBuyDone = useCallback(() => {
    if (buyingFid) {
      setBoughtFids((prev) => new Set(prev).add(buyingFid));
    }
    setBuyingFid(null);
    setBuyRect(null);
  }, [buyingFid]);

  if (isMiniApp && !isLoaded) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-400">Loading...</div>
      </main>
    );
  }

  return (
    <main
      className={`${
        claimBlockingActive ? "min-h-min" : "min-h-screen"
      } relative noise-overlay flex flex-col overflow-x-hidden ${
        claimBlockingActive ? "" : "overflow-hidden"
      }`}
    >
      {!bootDone && (
        <GobblerBootOverlay
          opening={initialViewResolved}
          onDone={handleBootDone}
        />
      )}
      {/* Buy overlay — Silksong Void combat sequence */}
      {buyingFid && buyRect && (
        <BuyOverlay
          fid={buyingFid}
          startRect={buyRect}
          onDone={handleBuyDone}
        />
      )}

      {/* Gobble overlay — canvas jaws on top of everything */}
      {gobbling && (
        <GobbleOverlay
          onDone={handleGobbleDone}
          onChestReveal={handleChestReveal}
          payout={chestPayout?.tokens ?? payoutAmount}
          payoutSymbol={payoutSymbol}
          payoutUsd={chestPayout?.usd ?? payoutUsd}
        />
      )}

      {/* Centered warplet — fixed in viewport center during gobble, fades out when chest appears */}
      {gobbling && flyingFid && warpletVisible && (
        <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none">
          <img
            src={warpletImageSrc(flyingFid)}
            alt=""
            className="w-[280px] h-[280px] sm:w-[350px] sm:h-[350px] rounded-2xl animate-breathe"
            draggable={false}
          />
        </div>
      )}

      {/* Flying warplet — animates from card position to center */}
      {flyingFid && flyRect && !gobbling && (
        <FlyingWarplet
          fid={flyingFid}
          startRect={flyRect}
          onArrived={() => setGobbling(true)}
        />
      )}

      {/* Hollow Knight Abyss texture — always visible */}
      <AbyssBackground />

      {/* Ambient gobbler peek — jaws hint at their presence */}
      <GobblePeek hidden={gobbling} />

      {/* Everything below fades out during gobble */}
      {/* Nav — fixed on top of everything */}
      <nav className="fixed top-0 left-0 right-0 z-[45]">
        <div
          className="relative flex items-center justify-between px-4 sm:px-6 py-2 sm:py-3 backdrop-blur-md transition-none"
          style={{
            backgroundColor: `rgba(0, 0, 0, 0.85)`,
          }}
        >
          {/* Left — logo */}
          <img
            src="/logo.jpeg"
            alt="WarpletGobbler"
            className="h-8 sm:h-10 w-auto rounded-md"
            draggable={false}
          />
          {/* Right — status + wallet */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-full border border-[#0052FF]/50">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0052FF] animate-pulse" />
              <span className="text-xs text-[#4C82FB]">Base</span>
            </div>
            {isMiniApp ? (
              <MiniAppWalletButton />
            ) : (
              <ConnectKitButton.Custom>
                {({ isConnected, show, address, ensName }) => (
                  <button
                    onClick={show}
                    className="text-xs px-3 py-1.5 rounded-full border border-base-content/20 text-base-content/70 hover:border-base-content/40 hover:text-base-content transition-colors"
                  >
                    {isConnected
                      ? (ensName ??
                        `${address?.slice(0, 4)}…${address?.slice(-3)}`)
                      : "Connect"}
                  </button>
                )}
              </ConnectKitButton.Custom>
            )}
          </div>
        </div>
        {/* Gobbler lip border */}
        <svg
          className="w-full h-4 sm:h-5 block"
          viewBox="0 0 1200 20"
          preserveAspectRatio="none"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M0,0 L0,16 Q80,18 160,10 Q240,2 320,6 Q400,14 480,8 Q540,2 600,2 Q660,2 720,8 Q800,14 880,6 Q960,2 1040,10 Q1120,18 1200,16 L1200,0 Z"
            fill="#000000"
            fillOpacity="1"
          />
        </svg>
      </nav>

      {/* Buy ↔ Sell — text jump link, bottom-left (above CaFooter z-[50] and full-width content) */}
      <button
        type="button"
        onClick={() => toggleView(activeView === "buy" ? "sell" : "buy")}
        className={`group fixed left-0 bottom-[calc(3.25rem+env(safe-area-inset-bottom))] z-[55] flex items-center gap-1.5 pl-[max(1rem,env(safe-area-inset-left))] text-xs sm:text-sm font-medium tracking-[0.12em] uppercase text-white/80 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:duration-200 motion-reduce:ease-out hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent motion-safe:hover:scale-[1.02] ${
          gobbling || buyingFid || claimBlockingActive || !bootDone
            ? "pointer-events-none opacity-0 scale-[0.98]"
            : "opacity-100 scale-100"
        }`}
        aria-label={
          activeView === "buy"
            ? "Scroll to sell section"
            : "Scroll to buy section"
        }
      >
        <span className="relative inline-grid place-items-start">
          <span
            className={`col-start-1 row-start-1 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:duration-200 motion-reduce:ease-out ${
              activeView === "buy"
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-1.5 pointer-events-none"
            }`}
            aria-hidden={activeView !== "buy"}
          >
            sell
          </span>
          <span
            className={`col-start-1 row-start-1 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:duration-200 motion-reduce:ease-out ${
              activeView === "sell"
                ? "opacity-100 translate-y-0"
                : "opacity-0 -translate-y-1.5 pointer-events-none"
            }`}
            aria-hidden={activeView !== "sell"}
          >
            buy
          </span>
        </span>
        <span
          className="relative inline-flex h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 items-center justify-center"
          aria-hidden
        >
          <svg
            className={`absolute transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:duration-200 motion-reduce:ease-out ${
              activeView === "buy"
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-2 scale-90"
            }`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
          <svg
            className={`absolute transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:duration-200 motion-reduce:ease-out ${
              activeView === "sell"
                ? "opacity-100 translate-y-0"
                : "opacity-0 -translate-y-2 scale-90"
            }`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m18 15-6-6-6 6" />
          </svg>
        </span>
      </button>

      <div
        className={`${
          claimBlockingActive ? "" : "flex-1"
        } flex flex-col transition-opacity duration-700`}
        style={{ opacity: gobbling || !initialViewResolved ? 0 : 1 }}
      >
        {/* Scroll-blended rich background — purple (buy) → cyan (sell) */}
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            zIndex: 0,
            background: `
              linear-gradient(
                180deg,
                rgba(${Math.round(60 - 50 * scrollBlend)}, ${Math.round(20 + 40 * scrollBlend)}, ${Math.round(100 - 60 * scrollBlend)}, 1) 0%,
                rgba(${Math.round(80 - 70 * scrollBlend)}, ${Math.round(30 + 60 * scrollBlend)}, ${Math.round(130 - 80 * scrollBlend)}, 1) 40%,
                rgba(${Math.round(50 - 40 * scrollBlend)}, ${Math.round(15 + 35 * scrollBlend)}, ${Math.round(80 - 50 * scrollBlend)}, 1) 100%
              )
            `,
          }}
        />
        {/* Organic morphing cutout shapes — morph between buy ↔ sell states */}
        <MorphingSilhouettes scrollBlend={scrollBlend} />

        {/* Parallax warplet background — on top of color wash */}
        <ParallaxBackground />

        {/* Mobile readability veil — darkens viewport middle without boxing cards */}
        <div
          className="pointer-events-none fixed inset-0 z-[5] sm:hidden"
          style={{
            background: `
              linear-gradient(
                180deg,
                rgba(0, 0, 0, 0.08) 0%,
                rgba(0, 0, 0, 0.10) 20%,
                rgba(0, 0, 0, 0.39) 38%,
                rgba(0, 0, 0, 0.55) 52%,
                rgba(0, 0, 0, 0.39) 66%,
                rgba(0, 0, 0, 0.10) 80%,
                rgba(0, 0, 0, 0.08) 100%
              )
            `,
          }}
          aria-hidden
        />

        {/* === Auction Section (Buy) === */}
        {/* Claim gate: pt ≈ GobblePeek jaw + ~2rem breathing room + safe-area */}
        <section
          id="auction"
          className={`relative z-10 flex flex-col items-center px-4 sm:px-6 ${
            claimBlockingActive
              ? "pt-[calc(env(safe-area-inset-top)+8.0625rem)] sm:pt-[calc(env(safe-area-inset-top)+11.625rem)] pb-[calc(3.5rem+env(safe-area-inset-bottom))] sm:pb-16"
              : "pt-36 sm:pt-56 pb-12 sm:pb-20"
          }`}
        >
          <GobblerAuctionSection
            auctionBidPlacedFids={boughtFids}
            onBid={handleBuy}
            bidDisabled={auctionBidDisabled}
            onClaimBlockingChange={setClaimBlocking}
            viewerDisplayName={rescueViewerDisplayName}
            viewerPfpUrl={rescueViewerPfpUrl}
          />
          {auctionBidError && (
            <p className="mt-4 max-w-xl mx-auto text-center text-xs text-error/90 break-words px-2">
              {auctionBidError}
            </p>
          )}
        </section>

        {/* === Sell Section === */}
        <SellSection
          claimBlocking={claimBlockingActive}
          payoutStream={payoutStream}
          payoutSymbol={payoutSymbol}
          isAmountMissing={isAmountMissing}
          isDutchAuctionConfigured={isDutchAuctionConfigured}
          fxEstMarketCapUsd={FX_EST_MARKET_CAP_USD}
          payoutAmount={payoutAmount}
          warpgobbPriceUsd={warpgobbPriceUsd}
          pickerScrollId="warplet-scroll"
          warpletsConfigured={warpletsConfigured}
          isConnected={isConnected}
          ownedWarpletsError={ownedWarpletsError}
          ownedWarpletsLoading={ownedWarpletsLoading}
          showWarpletPickerSkeleton={showWarpletPickerSkeleton}
          pickerWarplets={pickerWarplets}
          selectedFid={selectedFid}
          flyingFid={flyingFid}
          isSelling={isSelling}
          isWriting={isWriting}
          sellError={sellError}
          onSelectFid={setSelectedFid}
          onSell={() => void handleSell()}
          registerCardRef={(fid, el) => {
            if (el) cardRefs.current.set(fid, el);
            else cardRefs.current.delete(fid);
          }}
        />

        {!claimBlockingActive ? (
          <div className="relative z-10 mt-6 sm:mt-8 pb-4" aria-hidden />
        ) : null}
      </div>
      {/* end gobble fade wrapper */}

      {/* Fixed footer — contract address (z-[50] sits above auction z-10; disable hit-testing during claim so the CTA isn’t covered) */}
      <CaFooter pointerThrough={claimBlockingActive} />
    </main>
  );
}

// Fall back to the deployed $LARPBOBB address if the env var isn't set (e.g. local dev),
// so the footer always shows a real address rather than zero.
const FOOTER_CA: Address =
  CONTRACTS.warpgobbToken !== ZERO_ADDRESS
    ? CONTRACTS.warpgobbToken
    : ("0x3042b035325393F3d72390C7E5d51F26fe1F0e61" as Address);

function CaFooter({ pointerThrough = false }: { pointerThrough?: boolean }) {
  const [copied, setCopied] = useState(false);
  const ca = FOOTER_CA;

  const handleCopy = useCallback(() => {
    navigator.clipboard
      .writeText(ca)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {
        // clipboard API can reject in non-secure contexts / iframes / when
        // permission is denied — silently no-op so we don't unhandle-reject.
      });
  }, [ca]);

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-[50] bg-black/90 backdrop-blur-sm py-3 sm:py-4 px-4 text-center select-all ${
        pointerThrough ? "pointer-events-none cursor-default" : "cursor-pointer"
      }`}
      onClick={pointerThrough ? undefined : handleCopy}
    >
      <span className="text-[8px] sm:text-sm text-base-content/60 font-mono tracking-wide">
        CA: <span className="text-base-content/80">{ca}</span>
        {copied ? (
          <svg
            className="inline-block ml-1.5 w-3.5 h-3.5 align-middle relative -top-px text-primary/80"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          <svg
            className="inline-block ml-1.5 w-3.5 h-3.5 align-middle relative -top-px text-base-content/40"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
            <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
          </svg>
        )}
      </span>
    </div>
  );
}
