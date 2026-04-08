---
title: "Gemini image generation pipeline gotchas"
date: "2026-04-03"
category: "integration-issues"
tags:
  - gemini-api
  - google-genai-sdk
  - image-generation
  - pinata-sdk
  - vercel-blob
  - dotenv
module: web
symptoms:
  - "models/gemini-2.0-flash-preview-image-generation is not found for API version v1beta"
  - "Property 'file' does not exist on type 'Upload'"
  - "Environment variables undefined at module init despite dotenv"
  - "Gemini returns no image parts"
severity: medium
---

# Gemini Image Generation Pipeline Gotchas

## Problem

Building an AI image generation pipeline with `@google/genai`, Vercel Blob, and Pinata SDK surfaced several non-obvious API issues that each silently failed or threw misleading errors.

## Gotcha 1: Correct Gemini model name for image generation

**Symptom:** `ApiError: models/gemini-2.0-flash-preview-image-generation is not found`

**Root cause:** The model name in various tutorials/docs is wrong or outdated. The correct model for image generation (as of 2026-04) is:

```
gemini-3.1-flash-image-preview
```

**How to verify:** List available models via the SDK:

```typescript
const result = await genAI.models.list();
for (const m of result.page) {
  if (m.name?.includes("image")) console.log(m.name, m.supportedActions);
}
```

## Gotcha 2: `@google/genai` requires responseModalities + role for image output

**Symptom:** Gemini returns text-only response with no `inlineData` parts, even with the correct model.

**Root cause:** The SDK requires explicit configuration to return images:

```typescript
// WRONG — returns text only
await genAI.models.generateContent({
  model: "gemini-3.1-flash-image-preview",
  contents: [
    { text: prompt },
    { inlineData: { mimeType: "image/png", data: base64 } },
  ],
});

// CORRECT — returns image
await genAI.models.generateContent({
  model: "gemini-3.1-flash-image-preview",
  contents: [
    {
      role: "user",
      parts: [
        { text: prompt },
        { inlineData: { mimeType: "image/png", data: base64 } },
      ],
    },
  ],
  config: {
    responseModalities: ["IMAGE", "TEXT"],
  },
});
```

Both `role: "user"` on the content and `responseModalities: ["IMAGE", "TEXT"]` are required.

## Gotcha 3: Pinata SDK v2.5+ moved `upload.file()` to `upload.public.file()`

**Symptom:** `TS2339: Property 'file' does not exist on type 'Upload'`

**Root cause:** Pinata SDK restructured uploads into `public` and `private` namespaces.

```typescript
// WRONG (pre-v2.5)
await pinata.upload.file(file);

// CORRECT (v2.5+)
await pinata.upload.public.file(file);
```

## Gotcha 4: Module-level env vars + dotenv in test scripts

**Symptom:** Env vars are `undefined` in module code despite `dotenv.config()` at top of test script.

**Root cause:** ESM `import` statements are hoisted above all other code. Module-level constants like `const TOKEN = process.env.MY_VAR!` capture `undefined` before dotenv runs.

```typescript
// WRONG — import is hoisted above config()
import { config } from "dotenv";
config({ path: "../.env.local" });
import { myFunction } from "../src/lib/my-module"; // runs BEFORE config()

// CORRECT — dynamic import after env is loaded
import { config } from "dotenv";
config({ path: "../.env.local" });
const { myFunction } = await import("../src/lib/my-module");
```

## Prevention

- Always list available models via SDK before hardcoding a model name
- Check SDK changelogs when upgrading major versions (Pinata, Google GenAI)
- Use dynamic imports in test scripts that depend on env vars
- Add a guard/assertion for required env vars at module init rather than silently using `undefined`

## References

- Plan: `docs/plans/2026-04-03-feat-gobbled-warplet-image-pipeline-plan.md`
- Implementation: `web/src/lib/generate-gobbled-image.ts`
- Test script: `web/scripts/test-gobbled-image.ts`
