import type { Metadata } from "next";
import { EB_Garamond, Inter, Space_Grotesk, DM_Sans, Outfit, Sora } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import FontToggle from "@/components/FontToggle";

const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  variable: "--font-eb-garamond",
});
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});
const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});
const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});
const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://warpletgobbler.xyz";

export const metadata: Metadata = {
  title: "WarpletGobbler",
  description: "A PunkStrategy-style flywheel for Warplets using Superfluid streaming",
  other: {
    "fc:miniapp": JSON.stringify({
      version: "1",
      imageUrl: `${appUrl}/og-image.png`,
      button: {
        title: "Launch",
        action: {
          type: "launch_miniapp",
          name: "WarpletGobbler",
          url: appUrl,
          splashImageUrl: `${appUrl}/splash.png`,
          splashBackgroundColor: "#13111C",
        },
      },
    }),
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="warplet" className={`${ebGaramond.variable} ${inter.variable} ${spaceGrotesk.variable} ${dmSans.variable} ${outfit.variable} ${sora.variable}`}>
      <body className="min-h-screen bg-base-100 text-base-content">
        <Providers>{children}</Providers>
        <FontToggle />
      </body>
    </html>
  );
}
