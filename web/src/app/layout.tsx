import type { Metadata } from "next";
import { EB_Garamond } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  variable: "--font-eb-garamond",
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
    <html lang="en" data-theme="warplet" className={ebGaramond.variable}>
      <body className="min-h-screen bg-base-100 text-base-content font-serif">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
