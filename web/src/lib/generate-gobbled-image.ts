import { put, list } from "@vercel/blob";
import { GoogleGenAI } from "@google/genai";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const PRIMARY_PROMPT =
  "Cover this creature in black ooze and make it look resigned and unhappy";
const FALLBACK_PROMPT = "Apply a dark, gloomy transformation to this creature";
const BLOB_TOKEN = process.env.warpletgobbler_READ_WRITE_TOKEN!;
const SOURCE_BASE =
  "https://qcntgudzysvobg72.public.blob.vercel-storage.com/warplets";
const inFlightByToken = new Map<number, Promise<{ url: string }>>();
const GEMINI_SKIP_IMAGE_GENERATION =
  process.env.GEMINI_SKIP_IMAGE_GENERATION?.trim().toLowerCase() === "true";

async function existingGobbledBlobUrl(
  tokenId: number,
): Promise<string | null> {
  const exactName = `warplet-${tokenId}-gobbled.png`;
  const existing = await list({
    prefix: `gobbled-warplets/${exactName}`,
    token: BLOB_TOKEN,
  });
  const hit = existing.blobs.find((b) => b.pathname.endsWith(exactName));
  return hit?.url ?? null;
}

/** True if we already stored a gobbled PNG for this token (cheap list-only check). */
export async function gobbledBlobExists(tokenId: number): Promise<boolean> {
  return (await existingGobbledBlobUrl(tokenId)) != null;
}

export async function ensureGobbledImage(
  tokenId: number,
): Promise<{ url: string }> {
  const inFlight = inFlightByToken.get(tokenId);
  if (inFlight) return inFlight;

  const run = ensureGobbledImageUnlocked(tokenId);
  inFlightByToken.set(tokenId, run);
  try {
    return await run;
  } finally {
    inFlightByToken.delete(tokenId);
  }
}

async function ensureGobbledImageUnlocked(
  tokenId: number,
): Promise<{ url: string }> {
  const existingUrl = await existingGobbledBlobUrl(tokenId);
  if (existingUrl != null) {
    return { url: existingUrl };
  }

  // Fetch source image. Explicit timeout — the calling routes cap at
  // maxDuration=60, and a stalled blob fetch otherwise burns the whole
  // budget before Gemini even runs.
  const sourceUrl = `${SOURCE_BASE}/warplet-${tokenId}.png`;
  const sourceResponse = await fetch(sourceUrl, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!sourceResponse.ok) {
    throw new Error(`Source warplet image not found: ${sourceResponse.status}`);
  }
  const sourceBuffer = await sourceResponse.arrayBuffer();
  const sourceBytes = Buffer.from(sourceBuffer);
  let imageBuffer: Buffer;

  if (GEMINI_SKIP_IMAGE_GENERATION) {
    console.info(
      "[gobbled-image] GEMINI_SKIP_IMAGE_GENERATION=true, using source image",
      { tokenId },
    );
    imageBuffer = sourceBytes;
  } else {
    const sourceBase64 = sourceBytes.toString("base64");
    // Generate via Gemini (with fallback prompt)
    imageBuffer = await generateWithFallback(sourceBase64);
  }

  // Store in Vercel Blob
  const blob = await put(
    `gobbled-warplets/warplet-${tokenId}-gobbled.png`,
    imageBuffer,
    {
      access: "public",
      contentType: "image/png",
      token: BLOB_TOKEN,
    },
  );

  return { url: blob.url };
}

async function generateWithFallback(sourceBase64: string): Promise<Buffer> {
  const attempts = [PRIMARY_PROMPT, FALLBACK_PROMPT];
  for (const [index, prompt] of attempts.entries()) {
    const promptLabel = index === 0 ? "primary" : "fallback";
    try {
      const response = await genAI.models.generateContent({
        model: "gemini-3.1-flash-image-preview",
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              { inlineData: { mimeType: "image/png", data: sourceBase64 } },
            ],
          },
        ],
        config: {
          responseModalities: ["IMAGE", "TEXT"],
          abortSignal: AbortSignal.timeout(30_000),
        },
      });

      const imagePart = response.candidates?.[0]?.content?.parts?.find(
        (p: { inlineData?: { data?: string } }) => p.inlineData,
      );

      if (!imagePart?.inlineData?.data) {
        const candidateCount = response.candidates?.length ?? 0;
        const promptFeedback = JSON.stringify(
          (response as { promptFeedback?: unknown }).promptFeedback ?? null,
        );
        const firstFinishReason = (
          response.candidates?.[0] as { finishReason?: unknown } | undefined
        )?.finishReason;
        console.warn(
          `[gobbled-image] gemini ${promptLabel} attempt returned no image part`,
          {
            candidateCount,
            firstFinishReason: firstFinishReason ?? null,
            promptFeedback,
          },
        );
        continue; // try fallback prompt
      }

      return Buffer.from(imagePart.inlineData.data as string, "base64");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[gobbled-image] gemini ${promptLabel} attempt failed`, {
        error: message,
      });
      continue; // try fallback prompt
    }
  }

  throw new Error("Image generation failed after primary and fallback prompts");
}
