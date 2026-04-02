/** Resolve ipfs:// URIs to an HTTP gateway URL for <img src>. */
export function ipfsToHttp(uri: string): string {
  if (uri.startsWith("ipfs://")) {
    const path = uri.slice("ipfs://".length).replace(/^ipfs\//, "");
    return `https://ipfs.io/ipfs/${path}`;
  }
  return uri;
}

/**
 * Warplets use inline data:application/json;base64 tokenURI with an `image` field (often ipfs://).
 */
export function imageUrlFromTokenUri(tokenUri: string): string | null {
  const prefix = "data:application/json;base64,";
  if (!tokenUri.startsWith(prefix)) {
    const u = tokenUri.trim();
    if (u.startsWith("http://") || u.startsWith("https://")) return u;
    if (u.startsWith("ipfs://")) return ipfsToHttp(u);
    return null;
  }
  try {
    const json = JSON.parse(atob(tokenUri.slice(prefix.length))) as {
      image?: string;
    };
    const image = json.image;
    if (!image || typeof image !== "string") return null;
    return ipfsToHttp(image);
  } catch {
    return null;
  }
}
