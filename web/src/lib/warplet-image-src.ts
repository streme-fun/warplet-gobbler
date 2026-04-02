/** Client-safe URL — resolved on the server from chain + IPFS, then cached (immutable). */
export function warpletImageSrc(fid: number): string {
  return `/api/warplet-image/${fid}`;
}
