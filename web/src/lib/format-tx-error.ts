/** Collect message text from an Error and its `cause` chain (viem often nests details). */
function errorMessageChain(e: unknown): string {
  if (e instanceof Error) {
    const parts: string[] = [e.message];
    let c: unknown = e.cause;
    while (c instanceof Error) {
      parts.push(c.message);
      c = c.cause;
    }
    return parts.join(" ");
  }
  if (typeof e === "string") return e;
  return "";
}

/** User-facing copy for wallet / RPC layer; avoids dumping full viem request blobs in the UI. */
export function formatUserFacingTxError(e: unknown): string {
  const raw =
    errorMessageChain(e) ||
    (e != null && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string"
      ? (e as { message: string }).message
      : "");
  const normalized = raw.trim() || "Transaction failed";
  const lower = normalized.toLowerCase();
  if (
    lower.includes("user rejected") ||
    lower.includes("rejected the request") ||
    lower.includes("user denied") ||
    lower.includes("denied transaction signature") ||
    lower.includes("request rejected") ||
    /\b4001\b/.test(normalized)
  ) {
    return "transaction cancelled, try again";
  }
  return normalized;
}
