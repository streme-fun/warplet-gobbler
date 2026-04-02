/** Resolve ipfs:// URIs to an HTTP gateway URL for <img src>. */
export function ipfsToHttp(uri: string): string {
  if (uri.startsWith("ipfs://")) {
    const path = uri.slice("ipfs://".length).replace(/^ipfs\//, "");
    return `https://ipfs.io/ipfs/${path}`;
  }
  return uri;
}

/** Same CID path tried in order when fetching on the server (public gateways vary in rate limits). */
const IPFS_GATEWAY_PREFIXES = [
  "https://dweb.link/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://w3s.link/ipfs/",
] as const;

function expandIpfsPathToGatewayUrls(path: string): string[] {
  const p = path.replace(/^ipfs\//, "");
  return IPFS_GATEWAY_PREFIXES.map((prefix) => `${prefix}${p}`);
}

/** Raw `image` string from token metadata (before gateway expansion). */
function rawImageUriFromTokenUri(tokenUri: string): string | null {
  const prefix = "data:application/json;base64,";
  if (tokenUri.startsWith(prefix)) {
    try {
      const json = JSON.parse(atob(tokenUri.slice(prefix.length))) as {
        image?: string;
      };
      const image = json.image;
      if (!image || typeof image !== "string") return null;
      return image;
    } catch {
      return null;
    }
  }
  const u = tokenUri.trim();
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("ipfs://")) return u;
  return null;
}

/**
 * Warplets use inline data:application/json;base64 tokenURI with an `image` field (often ipfs://).
 */
export function imageUrlFromTokenUri(tokenUri: string): string | null {
  const raw = rawImageUriFromTokenUri(tokenUri);
  if (!raw) return null;
  return ipfsToHttp(raw);
}

/**
 * URLs to try when downloading art server-side (multiple IPFS gateways + retries).
 */
export function warpletImageFetchCandidates(tokenUri: string): string[] {
  const raw = rawImageUriFromTokenUri(tokenUri);
  if (!raw) return [];

  if (raw.startsWith("ipfs://")) {
    const path = raw.slice("ipfs://".length).replace(/^ipfs\//, "");
    return [...expandIpfsPathToGatewayUrls(path)];
  }

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    const m = raw.match(/\/ipfs\/(.+)$/i);
    if (m) {
      const tail = m[1].split("?")[0] ?? m[1];
      return [...expandIpfsPathToGatewayUrls(tail)];
    }
    return [raw];
  }

  return [];
}
