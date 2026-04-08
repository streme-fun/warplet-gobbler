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

function walkErrorCauses(e: unknown, visit: (x: unknown) => void): void {
  visit(e);
  if (
    e != null &&
    typeof e === "object" &&
    "cause" in e &&
    (e as { cause: unknown }).cause !== undefined
  ) {
    walkErrorCauses((e as { cause: unknown }).cause, visit);
  }
}

/** EIP-1474 user rejection; some wallets use CAIP-5000. */
function errorChainHasUserRejectionCode(e: unknown): boolean {
  let hit = false;
  walkErrorCauses(e, (x) => {
    if (x != null && typeof x === "object" && "code" in x) {
      const c = (x as { code: unknown }).code;
      if (c === 4001 || c === 5000 || c === "4001" || c === "5000") hit = true;
    }
    if (x != null && typeof x === "object" && "name" in x) {
      const n = String((x as { name: unknown }).name);
      if (/UserRejected/i.test(n)) hit = true;
    }
  });
  return hit;
}

/** Viem often exposes a short label on the root error while `message` contains RPC blobs. */
function topLevelShortMessage(e: unknown): string | null {
  if (e != null && typeof e === "object" && "shortMessage" in e) {
    const sm = (e as { shortMessage: unknown }).shortMessage;
    if (typeof sm === "string" && sm.trim()) return sm.trim();
  }
  return null;
}

function stringField(e: unknown, key: string): string | null {
  if (e != null && typeof e === "object" && key in e) {
    const v = (e as Record<string, unknown>)[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/** Flatten common wallet / viem fields across the cause chain for rejection heuristics. */
function collectRejectionHintText(e: unknown): string {
  const parts: string[] = [];
  walkErrorCauses(e, (x) => {
    if (typeof x === "string" && x.trim()) {
      parts.push(x);
      return;
    }
    for (const k of ["message", "shortMessage", "details"] as const) {
      const s = stringField(x, k);
      if (s) parts.push(s);
    }
  });
  return parts.join(" ");
}

/** Remove viem / wallet verbose tails so we never surface hex dumps or "Contract Call:" blocks. */
function stripWalletRpcNoise(msg: string): string {
  const markers = [
    "\nRequest Arguments:",
    "\r\nRequest Arguments:",
    " Request Arguments:",
    "\nContract Call:",
    "\r\nContract Call:",
    " Contract Call:",
    "\nDocs:",
    "\r\nDocs:",
    "\nDetails:",
    "\r\nDetails:",
    "\nVersion:",
    "\r\nVersion:",
    "\nEstimate Gas",
    "\r\nEstimate Gas",
    "\nRaw Call",
    "\r\nRaw Call",
  ];
  let s = msg.trim();
  let cut = s.length;
  for (const m of markers) {
    const i = s.indexOf(m);
    if (i >= 0) cut = Math.min(cut, i);
  }
  s = s.slice(0, cut).trim();
  // Single-line dumps sometimes use "Request Arguments:" without leading newline
  const inlineArgs = "Request Arguments:";
  const ia = s.indexOf(inlineArgs);
  if (ia > 0 && s[ia - 1] !== "\n") {
    s = s.slice(0, ia).trim();
  }
  const inlineContract = "Contract Call:";
  const ic = s.indexOf(inlineContract);
  if (ic > 0 && s[ic - 1] !== "\n") {
    s = s.slice(0, ic).trim();
  }
  return s;
}

function isUserRejected(raw: string): boolean {
  const lower = raw.toLowerCase();
  return (
    lower.includes("user rejected") ||
    lower.includes("rejected the request") ||
    lower.includes("user denied") ||
    lower.includes("denied transaction signature") ||
    lower.includes("request rejected") ||
    lower.includes("action_rejected") ||
    lower.includes("ethers-user-denied") ||
    lower.includes("rejected by user") ||
    /\b4001\b/.test(raw)
  );
}

/** True if a string still looks like a raw RPC / viem artifact after stripping. */
function looksLikeRawRpcDump(s: string): boolean {
  const lower = s.toLowerCase();
  return (
    /0x[0-9a-f]{24,}/i.test(s) ||
    lower.includes("request arguments") ||
    lower.includes("contract call:") ||
    lower.includes("raw call arguments") ||
    /viem@[0-9]/i.test(s) ||
    lower.includes("docs: https://viem") ||
    /\bargs:\s*\(/i.test(s)
  );
}

const MAX_USER_MESSAGE_LEN = 280;

/** User-facing copy for wallet / RPC layer; avoids dumping full viem request blobs in the UI. */
export function formatUserFacingTxError(e: unknown): string {
  if (errorChainHasUserRejectionCode(e)) {
    return "You cancelled in your wallet.";
  }

  const hint = collectRejectionHintText(e);
  if (hint && isUserRejected(hint)) {
    return "You cancelled in your wallet.";
  }

  const short = topLevelShortMessage(e);
  const chain = errorMessageChain(e);
  const fallbackObj =
    e != null &&
    typeof e === "object" &&
    "message" in e &&
    typeof (e as { message: unknown }).message === "string"
      ? ((e as { message: string }).message as string).trim()
      : "";

  const raw = (short || chain || fallbackObj || "").trim();
  if (!raw && !hint) return "Something went wrong. Try again.";

  const cleaned = stripWalletRpcNoise(short || raw || hint);
  let result =
    cleaned ||
    stripWalletRpcNoise(chain) ||
    stripWalletRpcNoise(fallbackObj || hint) ||
    "Transaction failed";

  if (looksLikeRawRpcDump(result)) {
    return "Something went wrong. Try again.";
  }

  if (result.length > MAX_USER_MESSAGE_LEN) {
    return `${result.slice(0, MAX_USER_MESSAGE_LEN - 1)}…`;
  }
  return result;
}
