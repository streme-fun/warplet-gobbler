import type { Metadata } from "next";
import { Caveat, Creepster, Inter, Rubik_Wet_Paint } from "next/font/google";
import "@rainbow-me/rainbowkit/styles.css";
import "./globals.css";
import { Providers } from "./providers";
import {
  appUrl,
  AUCTION_EMBED_IMAGE,
  buildMiniappEmbed,
} from "@/lib/miniapp-embed";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const handwritten = Caveat({
  subsets: ["latin"],
  variable: "--font-handwritten",
  weight: ["600", "700"],
});

const display = Rubik_Wet_Paint({
  subsets: ["latin"],
  variable: "--font-display",
  weight: "400",
});

const creepster = Creepster({
  subsets: ["latin"],
  variable: "--font-creepster",
  weight: "400",
});

export const metadata: Metadata = {
  title: "WarpletGobbler",
  description:
    "A pot of $WARPGOBB streams in every second. Deposit a Warplet to drain it all in one gulp.",
  openGraph: {
    title: "Warplet Gobbler",
    description: "The pot fattens every second. One Warplet in takes it all.",
    images: [{ url: `${appUrl}/api/og/pot`, width: 1200, height: 800 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Warplet Gobbler",
    description: "The pot fattens every second. One Warplet in takes it all.",
    images: [`${appUrl}/api/og/pot`],
  },
  other: {
    "fc:miniapp": JSON.stringify(
      buildMiniappEmbed({
        imageUrl: AUCTION_EMBED_IMAGE,
        launchUrl: appUrl,
        buttonTitle: "🦷 Enter the Gobbler",
      }),
    ),
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-theme="warplet"
      className={`${inter.variable} ${handwritten.variable} ${display.variable} ${creepster.variable}`}
    >
      <body className="min-h-screen bg-base-100 text-base-content">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
