import { put, list } from "@vercel/blob";
import { GoogleGenAI } from "@google/genai";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const PRIMARY_PROMPT =
  "Cover this creature in black ooze and make it look resigned and unhappy";
const FALLBACK_PROMPT = "Apply a dark, gloomy transformation to this creature";
const BLOB_TOKEN = process.env.warpletgobbler_READ_WRITE_TOKEN!;
const SOURCE_BASE =
  "https://qcntgudzysvobg72.public.blob.vercel-storage.com/warplets";

export async function ensureGobbledImage(
  tokenId: number,
): Promise<{ url: string }> {
  // Check if already exists (include .png to avoid prefix collisions like 1 vs 10)
  const existing = await list({
    prefix: `gobbled-warplets/warplet-${tokenId}-gobbled.png`,
    token: BLOB_TOKEN,
  });
  if (existing.blobs.length > 0) {
    return { url: existing.blobs[0].url };
  }

  // Fetch source image
  const sourceUrl = `${SOURCE_BASE}/warplet-${tokenId}.png`;
  const sourceResponse = await fetch(sourceUrl);
  if (!sourceResponse.ok) {
    throw new Error(`Source warplet image not found: ${sourceResponse.status}`);
  }
  const sourceBuffer = await sourceResponse.arrayBuffer();
  const sourceBase64 = Buffer.from(sourceBuffer).toString("base64");

  // Generate via Gemini (with fallback prompt)
  const imageBuffer = await generateWithFallback(sourceBase64);

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
  for (const prompt of [PRIMARY_PROMPT, FALLBACK_PROMPT]) {
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
        },
      });

      const imagePart = response.candidates?.[0]?.content?.parts?.find(
        (p: { inlineData?: { data?: string } }) => p.inlineData,
      );

      if (!imagePart?.inlineData?.data) {
        continue; // try fallback prompt
      }

      return Buffer.from(imagePart.inlineData.data as string, "base64");
    } catch {
      continue; // try fallback prompt
    }
  }

  throw new Error("Image generation failed after primary and fallback prompts");
}
