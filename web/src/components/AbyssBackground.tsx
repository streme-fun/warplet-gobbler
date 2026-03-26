"use client";

/* eslint-disable @next/next/no-img-element */

// Ground silhouette only — undulating terrain at bottom of viewport
const ABYSS_TENDRILS: {
  id: number;
  swayDur: number;
  swayFrom: number;
  swayTo: number;
  swayDelay: number;
  fill: string;
  highlight?: string;
}[] = [
  {
    id: 0,
    swayDur: 999,
    swayFrom: 0,
    swayTo: 0,
    swayDelay: 0,
    fill: "M-10,900 L-10,870 C60,865 130,858 200,862 C280,867 340,855 400,850 C480,844 540,848 620,855 C700,862 780,858 860,852 C940,846 1020,850 1100,856 C1180,862 1260,855 1340,848 C1380,845 1420,850 1460,858 L1460,900Z",
  },
];

// Scattered void particles — mostly black dots of varying sizes, some white
const VOID_PARTICLES = [
  // Large black blobs
  { id: 0, left: "5%", bottom: "30%", size: 8, color: "#000", opacity: 0.8, travel: -350, drift: 20, dur: 12, delay: 0 },
  { id: 1, left: "22%", bottom: "25%", size: 10, color: "#000", opacity: 0.7, travel: -400, drift: -25, dur: 14, delay: 2 },
  { id: 2, left: "48%", bottom: "20%", size: 9, color: "#000", opacity: 0.75, travel: -380, drift: 15, dur: 13, delay: 4 },
  { id: 3, left: "72%", bottom: "28%", size: 7, color: "#000", opacity: 0.8, travel: -320, drift: -18, dur: 11, delay: 1 },
  { id: 4, left: "90%", bottom: "22%", size: 8, color: "#000", opacity: 0.7, travel: -360, drift: 10, dur: 12, delay: 5 },
  // Medium black dots
  { id: 5, left: "8%", bottom: "15%", size: 5, color: "#000", opacity: 0.7, travel: -280, drift: 15, dur: 8, delay: 0.5 },
  { id: 6, left: "18%", bottom: "35%", size: 4, color: "#000", opacity: 0.6, travel: -250, drift: -20, dur: 9, delay: 3 },
  { id: 7, left: "32%", bottom: "10%", size: 6, color: "#000", opacity: 0.65, travel: -300, drift: 25, dur: 10, delay: 1.5 },
  { id: 8, left: "42%", bottom: "40%", size: 5, color: "#000", opacity: 0.7, travel: -260, drift: -12, dur: 7, delay: 4.5 },
  { id: 9, left: "55%", bottom: "8%", size: 4, color: "#000", opacity: 0.6, travel: -290, drift: -30, dur: 9, delay: 2.5 },
  { id: 10, left: "65%", bottom: "32%", size: 6, color: "#000", opacity: 0.7, travel: -310, drift: 22, dur: 11, delay: 0.8 },
  { id: 11, left: "78%", bottom: "12%", size: 5, color: "#000", opacity: 0.65, travel: -270, drift: -15, dur: 8, delay: 3.5 },
  { id: 12, left: "88%", bottom: "38%", size: 4, color: "#000", opacity: 0.6, travel: -240, drift: 18, dur: 7, delay: 6 },
  // Small black specks
  { id: 13, left: "12%", bottom: "5%", size: 3, color: "#000", opacity: 0.5, travel: -200, drift: 8, dur: 6, delay: 1 },
  { id: 14, left: "28%", bottom: "18%", size: 2, color: "#000", opacity: 0.55, travel: -180, drift: -10, dur: 5, delay: 3.2 },
  { id: 15, left: "38%", bottom: "28%", size: 3, color: "#000", opacity: 0.5, travel: -220, drift: 14, dur: 6.5, delay: 5.5 },
  { id: 16, left: "58%", bottom: "22%", size: 2, color: "#000", opacity: 0.6, travel: -190, drift: -8, dur: 5.5, delay: 0.3 },
  { id: 17, left: "82%", bottom: "5%", size: 3, color: "#000", opacity: 0.5, travel: -210, drift: 12, dur: 6, delay: 2.8 },
  { id: 18, left: "95%", bottom: "15%", size: 2, color: "#000", opacity: 0.55, travel: -175, drift: -20, dur: 5, delay: 4.8 },
  // White/gray specks (sparse)
  { id: 19, left: "15%", bottom: "42%", size: 2, color: "#fff", opacity: 0.2, travel: -160, drift: -12, dur: 6, delay: 1.5 },
  { id: 20, left: "45%", bottom: "35%", size: 2, color: "#fff", opacity: 0.15, travel: -180, drift: 10, dur: 7, delay: 4 },
  { id: 21, left: "70%", bottom: "45%", size: 2, color: "#fff", opacity: 0.2, travel: -150, drift: -8, dur: 5.5, delay: 6.5 },
  { id: 22, left: "35%", bottom: "48%", size: 3, color: "#fff", opacity: 0.18, travel: -200, drift: 15, dur: 8, delay: 2.2 },
];

export default function AbyssBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
      <svg
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMax slice"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          overflow: "visible",
        }}
      >
        {ABYSS_TENDRILS.map((t) => (
          <g
            key={t.id}
            className="abyss-tendril-group"
            style={{
              transformOrigin: "50% 100%",
              // @ts-expect-error CSS custom properties
              "--sway-dur": `${t.swayDur}s`,
              "--sway-from": `${t.swayFrom}deg`,
              "--sway-to": `${t.swayTo}deg`,
              "--sway-delay": `${t.swayDelay}s`,
            }}
          >
            <path d={t.fill} fill="#000" />
          </g>
        ))}
      </svg>

      {VOID_PARTICLES.map((p) => (
        <div
          key={p.id}
          className="void-particle"
          style={{
            left: p.left,
            bottom: p.bottom,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            // @ts-expect-error CSS custom properties
            "--p-opacity": p.opacity,
            "--p-travel": `${p.travel}px`,
            "--p-drift": `${p.drift}px`,
            "--p-dur": `${p.dur}s`,
            "--p-delay": `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
