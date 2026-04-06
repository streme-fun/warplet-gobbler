/** Vercel Blob CDN — `warplet-{fid}.png` matches Farcaster fid (Warplet token id). */
export const WARPLET_IMAGE_CDN_BASE =
  "https://qcntgudzysvobg72.public.blob.vercel-storage.com/warplets";

export function warpletImageSrc(fid: number): string {
  return `${WARPLET_IMAGE_CDN_BASE}/warplet-${fid}.png`;
}
