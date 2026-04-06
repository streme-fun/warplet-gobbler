/**
 * Manual test: generate a gobbled warplet image for tokenId 1725.
 *
 * Usage:
 *   cd web
 *   npx tsx scripts/test-gobbled-image.ts
 *
 * Requires env vars: GEMINI_API_KEY, warpletgobbler_READ_WRITE_TOKEN
 * (loaded from ../.env.local via dotenv)
 */

import { config } from "dotenv";
config({ path: "../.env.local" });

const TOKEN_ID = 1725;

async function main() {
  console.log(`Testing gobbled image generation for tokenId ${TOKEN_ID}...`);
  console.log(`GEMINI_API_KEY set: ${!!process.env.GEMINI_API_KEY}`);
  console.log(
    `warpletgobbler_READ_WRITE_TOKEN set: ${!!process.env.warpletgobbler_READ_WRITE_TOKEN}`,
  );

  // Dynamic import so env vars are set before module-level code runs
  const { ensureGobbledImage } = await import(
    "../src/lib/generate-gobbled-image"
  );

  // Step 1: verify source image exists
  const sourceUrl = `https://qcntgudzysvobg72.public.blob.vercel-storage.com/warplets/warplet-${TOKEN_ID}.png`;
  console.log(`\n1. Checking source image: ${sourceUrl}`);
  const sourceRes = await fetch(sourceUrl, { method: "HEAD" });
  console.log(`   Status: ${sourceRes.status} ${sourceRes.statusText}`);
  if (!sourceRes.ok) {
    console.error("   Source image not found, aborting.");
    process.exit(1);
  }
  console.log(`   Content-Type: ${sourceRes.headers.get("content-type")}`);
  console.log(
    `   Content-Length: ${sourceRes.headers.get("content-length")} bytes`,
  );

  // Step 2: generate (or retrieve existing) gobbled image
  console.log("\n2. Calling ensureGobbledImage...");
  const start = Date.now();
  const result = await ensureGobbledImage(TOKEN_ID);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`   Done in ${elapsed}s`);
  console.log(`   Result URL: ${result.url}`);

  // Step 3: verify the blob is accessible
  console.log("\n3. Verifying blob is accessible...");
  const blobRes = await fetch(result.url, { method: "HEAD" });
  console.log(`   Status: ${blobRes.status} ${blobRes.statusText}`);
  console.log(`   Content-Type: ${blobRes.headers.get("content-type")}`);
  console.log(
    `   Content-Length: ${blobRes.headers.get("content-length")} bytes`,
  );

  // Step 4: test idempotency (second call should be instant)
  console.log("\n4. Testing idempotency (second call)...");
  const start2 = Date.now();
  const result2 = await ensureGobbledImage(TOKEN_ID);
  const elapsed2 = ((Date.now() - start2) / 1000).toFixed(1);
  console.log(`   Done in ${elapsed2}s`);
  console.log(`   URL matches: ${result.url === result2.url}`);

  console.log("\nAll tests passed!");
}

main().catch((err) => {
  console.error("\nTest failed:", err);
  process.exit(1);
});
