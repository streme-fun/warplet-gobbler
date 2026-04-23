import type { Metadata } from "next";
import { Caveat, Creepster, Inter, Rubik_Wet_Paint } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

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

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://warpletgobbler.xyz";

export const metadata: Metadata = {
  title: "WarpletGobbler",
  description: "A PunkStrategy-style flywheel for Warplets using Superfluid streaming",
  other: {
    "fc:miniapp": JSON.stringify({
      version: "1",
      imageUrl: `https://frm.lol/api/gobbler/frimg/mini/auction.png`,
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
