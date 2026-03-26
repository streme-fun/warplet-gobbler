import type { Metadata } from "next";
import { Cinzel } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-cinzel",
});

export const metadata: Metadata = {
  title: "WarpletGobbler",
  description: "A PunkStrategy-style flywheel for Warplets using Superfluid streaming",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="warplet" className={cinzel.variable}>
      <body className="min-h-screen bg-base-100 text-base-content font-serif">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
