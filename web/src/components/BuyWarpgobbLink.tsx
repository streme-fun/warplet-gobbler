"use client";

import { type ReactNode, useCallback } from "react";
import { buyWarpgobb } from "@/lib/warpgobbBuy";

type BuyWarpgobbLinkProps = {
  children: ReactNode;
  className?: string;
  title?: string;
};

/**
 * Wraps a $WARPGOBB label so clicking it buys the token: the host's native swap
 * inside a Farcaster mini-app, or the streme.fun token page on the web.
 *
 * Renders inline and inherits the surrounding font/color (Tailwind preflight),
 * with a dotted underline to signal it's clickable. Stops propagation so it's
 * safe to place inside larger clickable regions.
 */
export default function BuyWarpgobbLink({
  children,
  className = "",
  title = "Buy $WARPGOBB",
}: BuyWarpgobbLinkProps) {
  const handleClick = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    void buyWarpgobb();
  }, []);

  return (
    <button
      type="button"
      onClick={handleClick}
      title={title}
      aria-label={title}
      className={`inline cursor-pointer rounded underline decoration-dotted decoration-current/40 underline-offset-2 transition-colors hover:decoration-current focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${className}`}
    >
      {children}
    </button>
  );
}
