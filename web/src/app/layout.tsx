import type { Metadata } from "next";
import { Caveat, Inter } from "next/font/google";
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
    <html
      lang="en"
      data-theme="warplet"
      className={`${inter.variable} ${handwritten.variable}`}
    >
      <body className="min-h-screen bg-base-100 text-base-content">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
