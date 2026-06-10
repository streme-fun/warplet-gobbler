/**
 * Minimal Upstash-Redis-over-REST client (also matches Vercel KV's env names).
 * fetch-only — no SDK dependency — and degrades to "unconfigured" so referral
 * counters and notification tokens are simply skipped on deployments without
 * a KV store, instead of erroring.
 */

const restUrl = (
  process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
)?.trim();
const restToken = (
  process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN
)?.trim();

export const kvConfigured = Boolean(restUrl && restToken);

type KvValue = string | number;

/**
 * Run commands through the REST pipeline endpoint. Returns each command's
 * result in order, or null when KV is unconfigured/unreachable. Per-command
 * Redis errors surface as null entries (logged), not thrown.
 */
export async function kvPipeline(
  commands: KvValue[][],
): Promise<(unknown | null)[] | null> {
  if (!restUrl || !restToken || commands.length === 0) return null;
  try {
    const res = await fetch(`${restUrl}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${restToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(commands.map((cmd) => cmd.map(String))),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.warn("[kv] pipeline failed", { status: res.status });
      return null;
    }
    const json = (await res.json()) as Array<{
      result?: unknown;
      error?: string;
    }>;
    return json.map((entry) => {
      if (entry.error) {
        console.warn("[kv] command error", { error: entry.error });
        return null;
      }
      return entry.result ?? null;
    });
  } catch (e) {
    console.warn("[kv] pipeline unreachable", e);
    return null;
  }
}

export async function kvCommand(
  ...command: KvValue[]
): Promise<unknown | null> {
  const results = await kvPipeline([command]);
  return results?.[0] ?? null;
}
