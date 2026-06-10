"use client";

import { useState } from "react";
import { useShareCast, type SharePayload } from "@/hooks/useShareCast";

/**
 * The one share button. `buildPayload` runs at click time so copy can embed
 * live values (current pot, the viewer's fid as referral) without re-renders.
 */
export default function ShareCastButton({
  buildPayload,
  label,
  sharedLabel = "Casted ✓",
  className = "",
  onShared,
}: {
  buildPayload: (viewerFid: number | null) => SharePayload;
  label: string;
  sharedLabel?: string;
  className?: string;
  onShared?: () => void;
}) {
  const { share, isSharing, viewerFid } = useShareCast();
  const [shared, setShared] = useState(false);

  const handleClick = async () => {
    const ok = await share(buildPayload(viewerFid));
    if (ok) {
      setShared(true);
      onShared?.();
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={isSharing}
      className={`btn gap-2 ${className}`}
    >
      {isSharing ? (
        <span className="loading loading-spinner loading-xs" />
      ) : (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7" />
          <path d="M16 6l-4-4-4 4" />
          <path d="M12 2v13" />
        </svg>
      )}
      {shared ? sharedLabel : label}
    </button>
  );
}
