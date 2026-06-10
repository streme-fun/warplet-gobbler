import { list } from "@vercel/blob";

/**
 * Public URL of the AI-generated "gobbled" art for a Warplet, or null when it
 * hasn't been generated (or blob access isn't configured). Read-only sibling
 * of `generate-gobbled-image.ts`'s lookup — never triggers generation, so OG
 * images stay fast and free.
 */
export async function gobbledArtUrl(warpletId: number): Promise<string | null> {
  const token = process.env.warpletgobbler_READ_WRITE_TOKEN;
  if (!token) return null;
  try {
    const exactName = `warplet-${warpletId}-gobbled.png`;
    const existing = await list({
      prefix: `gobbled-warplets/${exactName}`,
      token,
    });
    return (
      existing.blobs.find((b) => b.pathname.endsWith(exactName))?.url ?? null
    );
  } catch {
    return null;
  }
}
