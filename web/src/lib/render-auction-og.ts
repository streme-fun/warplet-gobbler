import { readFile } from "node:fs/promises";
import path from "node:path";
import * as opentype from "opentype.js";
import sharp from "sharp";
import { formatUnits } from "viem";
import { warpletImageSrc } from "@/lib/warplet-image-src";

const WIDTH = 1024;
const HEIGHT = 720;
const MAIN_HEIGHT = 336;
const SHADOW_HEIGHT = 246;
const MAIN_Y = 132;
const SHADOW_X = 140;
const SHADOW_Y = 173;
const LOGO_SHIFT_Y = 12;
const FOOTER_TIME_Y = 676;

const TEMPLATE_PATH = "og-auction-render-background-inpaint.png";
const CREEPSTER_FONT_PATH = "og-assets/creepster-latin.ttf";

type RgbaImage = {
  data: Buffer;
  width: number;
  height: number;
};

type Rgb = [number, number, number];

export type AuctionOgRenderInput = {
  tokenId: number;
  gobbledImageUrl: string;
  topBidWei: bigint;
  bidDecimals: number;
  bidSymbol: string;
  endTime: bigint;
  nowSeconds?: number;
};

function publicPath(file: string) {
  return path.join(process.cwd(), "public", file);
}

async function loadRgba(input: string | Buffer): Promise<RgbaImage> {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels !== 4) {
    throw new Error(`Expected RGBA image, got ${info.channels} channels`);
  }

  return {
    data: Buffer.from(data),
    width: info.width,
    height: info.height,
  };
}

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) {
    throw new Error(`Image fetch failed (${response.status}): ${url}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function median(values: number[]): number {
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)] ?? 0;
}

function sampleBorderRgb(image: RgbaImage, borderPx = 32): Rgb {
  const r: number[] = [];
  const g: number[] = [];
  const b: number[] = [];
  const { data, width, height } = image;

  function pushPixel(x: number, y: number) {
    const i = (y * width + x) * 4;
    r.push(data[i]);
    g.push(data[i + 1]);
    b.push(data[i + 2]);
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (
        y < borderPx ||
        y >= height - borderPx ||
        x < borderPx ||
        x >= width - borderPx
      ) {
        pushPixel(x, y);
      }
    }
  }

  return [median(r), median(g), median(b)];
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta > 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h /= 6;
    if (h < 0) h += 1;
  }

  const s = max === 0 ? 0 : delta / max;
  return [h, s, max];
}

function hsvToRgb(h: number, s: number, v: number): Rgb {
  const c = v * s;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m = v - c;
  let rn = 0;
  let gn = 0;
  let bn = 0;

  if (h < 1 / 6) [rn, gn, bn] = [c, x, 0];
  else if (h < 2 / 6) [rn, gn, bn] = [x, c, 0];
  else if (h < 3 / 6) [rn, gn, bn] = [0, c, x];
  else if (h < 4 / 6) [rn, gn, bn] = [0, x, c];
  else if (h < 5 / 6) [rn, gn, bn] = [x, 0, c];
  else [rn, gn, bn] = [c, 0, x];

  return [
    Math.round((rn + m) * 255),
    Math.round((gn + m) * 255),
    Math.round((bn + m) * 255),
  ];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function colorDistance(data: Buffer, i: number, bg: Rgb): number {
  const dr = data[i] - bg[0];
  const dg = data[i + 1] - bg[1];
  const db = data[i + 2] - bg[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function edgeConnectedMask(mask: Uint8Array, width: number, height: number) {
  const connected = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  function push(index: number) {
    if (mask[index] && !connected[index]) {
      connected[index] = 1;
      queue[tail] = index;
      tail += 1;
    }
  }

  for (let x = 0; x < width; x += 1) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    push(y * width);
    push(y * width + width - 1);
  }

  while (head < tail) {
    const index = queue[head];
    head += 1;
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) push(index - 1);
    if (x < width - 1) push(index + 1);
    if (y > 0) push(index - width);
    if (y < height - 1) push(index + width);
  }

  return connected;
}

function removeLargeInnerBackgroundPockets({
  backgroundMask,
  connectedMask,
  image,
  sampledBg,
  minComponentPx = 120,
}: {
  backgroundMask: Uint8Array;
  connectedMask: Uint8Array;
  image: RgbaImage;
  sampledBg: Rgb;
  minComponentPx?: number;
}) {
  const { data, width, height } = image;
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  const component: number[] = [];
  const [sampleHue] = rgbToHsv(sampledBg[0], sampledBg[1], sampledBg[2]);

  function isInnerBackgroundLike(index: number) {
    if (connectedMask[index] || backgroundMask[index]) return false;
    const i = index * 4;
    const dist = colorDistance(data, i, sampledBg);
    const [h, s, v] = rgbToHsv(data[i], data[i + 1], data[i + 2]);
    const hueDelta = Math.min(Math.abs(h - sampleHue), 1 - Math.abs(h - sampleHue));
    return dist < 105 && hueDelta < 0.06 && s > 0.16 && v > 0.42;
  }

  for (let start = 0; start < width * height; start += 1) {
    if (visited[start] || !isInnerBackgroundLike(start)) continue;

    let head = 0;
    let tail = 0;
    component.length = 0;
    visited[start] = 1;
    queue[tail] = start;
    tail += 1;

    while (head < tail) {
      const index = queue[head];
      head += 1;
      component.push(index);
      const x = index % width;
      const y = Math.floor(index / width);
      const neighbors = [
        x > 0 ? index - 1 : -1,
        x < width - 1 ? index + 1 : -1,
        y > 0 ? index - width : -1,
        y < height - 1 ? index + width : -1,
      ];
      for (const next of neighbors) {
        if (next < 0 || visited[next] || !isInnerBackgroundLike(next)) continue;
        visited[next] = 1;
        queue[tail] = next;
        tail += 1;
      }
    }

    if (component.length >= minComponentPx) {
      for (const index of component) backgroundMask[index] = 1;
    }
  }
}

async function softenMask(mask: Uint8Array, width: number, height: number) {
  const eroded = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (!mask[index]) continue;
      let keep = true;
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          const nx = x + ox;
          const ny = y + oy;
          if (
            nx < 0 ||
            nx >= width ||
            ny < 0 ||
            ny >= height ||
            !mask[ny * width + nx]
          ) {
            keep = false;
          }
        }
      }
      eroded[index] = keep ? 255 : 0;
    }
  }

  const { data, info } = await sharp(Buffer.from(eroded), {
    raw: { width, height, channels: 1 },
  })
    .blur(0.75)
    .extractChannel(0)
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels !== 1) {
    throw new Error(`Expected one-channel softened mask, got ${info.channels}`);
  }
  return Buffer.from(data);
}

async function blurMask(
  mask: Uint8Array,
  width: number,
  height: number,
  sigma: number,
) {
  const { data, info } = await sharp(Buffer.from(mask), {
    raw: { width, height, channels: 1 },
  })
    .blur(sigma)
    .extractChannel(0)
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels !== 1) {
    throw new Error(`Expected one-channel blurred mask, got ${info.channels}`);
  }
  return Buffer.from(data);
}

async function cutOutFlatBackground(
  image: RgbaImage,
  targetHeight: number,
): Promise<RgbaImage> {
  const { data, width, height } = image;
  const sampledBg = sampleBorderRgb(image);
  const [sampleHue] = rgbToHsv(sampledBg[0], sampledBg[1], sampledBg[2]);
  const flatBg = new Uint8Array(width * height);

  for (let index = 0; index < width * height; index += 1) {
    const i = index * 4;
    const [h, s, v] = rgbToHsv(data[i], data[i + 1], data[i + 2]);
    const hueDelta = Math.min(Math.abs(h - sampleHue), 1 - Math.abs(h - sampleHue));
    if (
      colorDistance(data, i, sampledBg) < 82 ||
      (hueDelta < 0.07 && s > 0.12 && v > 0.38)
    ) {
      flatBg[index] = 1;
    }
  }

  const connectedBg = edgeConnectedMask(flatBg, width, height);
  const bgMask = new Uint8Array(connectedBg);
  removeLargeInnerBackgroundPockets({
    backgroundMask: bgMask,
    connectedMask: connectedBg,
    image,
    sampledBg,
  });
  for (let index = 0; index < width * height; index += 1) {
    const i = index * 4;
    const [h, s, v] = rgbToHsv(data[i], data[i + 1], data[i + 2]);
    const hueDelta = Math.min(Math.abs(h - sampleHue), 1 - Math.abs(h - sampleHue));
    if (hueDelta < 0.07 && s > 0.12 && v > 0.38 && colorDistance(data, i, sampledBg) < 150) {
      bgMask[index] = 1;
    }
  }

  const alpha = new Uint8Array(width * height);
  for (let index = 0; index < width * height; index += 1) {
    alpha[index] = bgMask[index] ? 0 : 255;
  }
  const softAlpha = await softenMask(alpha, width, height);

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const a = softAlpha[y * width + x];
      if (a <= 8) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  const cropLeft = Math.max(0, minX - 14);
  const cropTop = Math.max(0, minY - 14);
  const cropWidth = Math.min(width - cropLeft, maxX - cropLeft + 15);
  const cropHeight = Math.min(height - cropTop, maxY - cropTop + 15);

  const rgba = Buffer.alloc(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    const src = index * 4;
    rgba[src] = data[src];
    rgba[src + 1] = data[src + 1];
    rgba[src + 2] = data[src + 2];
    rgba[src + 3] = softAlpha[index];
  }

  const resized = await sharp(rgba, { raw: { width, height, channels: 4 } })
    .extract({
      left: cropLeft,
      top: cropTop,
      width: cropWidth,
      height: cropHeight,
    })
    .resize({ height: targetHeight })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (resized.info.channels !== 4) {
    throw new Error(`Expected RGBA cutout, got ${resized.info.channels} channels`);
  }

  return {
    data: Buffer.from(resized.data),
    width: resized.info.width,
    height: resized.info.height,
  };
}

function alphaComposite(dest: Buffer, destWidth: number, layer: RgbaImage, left: number, top: number) {
  for (let y = 0; y < layer.height; y += 1) {
    const dy = top + y;
    if (dy < 0 || dy >= HEIGHT) continue;
    for (let x = 0; x < layer.width; x += 1) {
      const dx = left + x;
      if (dx < 0 || dx >= destWidth) continue;

      const srcI = (y * layer.width + x) * 4;
      const srcA = layer.data[srcI + 3] / 255;
      if (srcA <= 0) continue;

      const destI = (dy * destWidth + dx) * 4;
      const destA = dest[destI + 3] / 255;
      const outA = srcA + destA * (1 - srcA);
      if (outA <= 0) continue;

      dest[destI] = Math.round(
        (layer.data[srcI] * srcA + dest[destI] * destA * (1 - srcA)) / outA,
      );
      dest[destI + 1] = Math.round(
        (layer.data[srcI + 1] * srcA + dest[destI + 1] * destA * (1 - srcA)) /
          outA,
      );
      dest[destI + 2] = Math.round(
        (layer.data[srcI + 2] * srcA + dest[destI + 2] * destA * (1 - srcA)) /
          outA,
      );
      dest[destI + 3] = Math.round(outA * 255);
    }
  }
}

function moveTopLeftLogoDown(canvas: Buffer) {
  const regionWidth = 150;
  const regionHeight = 144;
  const topPaddingHeight = 32;
  const logo = Buffer.alloc(regionWidth * regionHeight * 4);

  for (let y = 0; y < regionHeight; y += 1) {
    for (let x = 0; x < regionWidth; x += 1) {
      const src = (y * WIDTH + x) * 4;
      const dest = (y * regionWidth + x) * 4;
      const r = canvas[src];
      const g = canvas[src + 1];
      const b = canvas[src + 2];
      const isLogoPixel = g > 40 && b > 40 && g > r + 8 && b > r + 8;

      if (!isLogoPixel) continue;

      logo[dest] = r;
      logo[dest + 1] = g;
      logo[dest + 2] = b;
      logo[dest + 3] = canvas[src + 3];
      canvas[src] = 0;
      canvas[src + 1] = 0;
      canvas[src + 2] = 0;
      canvas[src + 3] = 255;
    }
  }

  for (let y = 0; y < topPaddingHeight; y += 1) {
    for (let x = 0; x < regionWidth; x += 1) {
      const i = (y * WIDTH + x) * 4;
      canvas[i] = 0;
      canvas[i + 1] = 0;
      canvas[i + 2] = 0;
      canvas[i + 3] = 255;
    }
  }

  alphaComposite(
    canvas,
    WIDTH,
    { data: logo, width: regionWidth, height: regionHeight },
    0,
    LOGO_SHIFT_Y,
  );
}

function enhanceColorContrast(r: number, g: number, b: number): Rgb {
  let [h, s, v] = rgbToHsv(r, g, b);
  s = clamp(s * 1.12, 0, 1);
  [r, g, b] = hsvToRgb(h, s, v);
  return [
    clamp(Math.round((r - 128) * 1.1 + 128), 0, 255),
    clamp(Math.round((g - 128) * 1.1 + 128), 0, 255),
    clamp(Math.round((b - 128) * 1.1 + 128), 0, 255),
  ];
}

async function buildDynamicBackground(base: RgbaImage, sampledBg: Rgb) {
  const { data, width, height } = base;
  const [sampleHue] = rgbToHsv(sampledBg[0], sampledBg[1], sampledBg[2]);
  const targetHue = clamp(sampleHue - 0.01, 0.045, 0.085);
  const field = new Uint8Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;
      const max = Math.max(r, g, b);
      const alpha = data[i + 3];
      const logoGuard = x < 142 && y < 130;
      if (alpha > 0 && y > 108 && y < 548 && max > 0.055 && !logoGuard) {
        field[y * width + x] = 255;
      }
    }
  }

  const fieldBlur = await blurMask(field, width, height, 1.25);
  const out = Buffer.from(data);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const i = index * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const max = Math.max(r, g, b) / 255;
      if (max <= 0.085) continue;

      const radial =
        1 -
        clamp(((x - width * 0.52) / 570) ** 2 + ((y - 320) / 340) ** 2, 0, 1);
      const strength = (fieldBlur[index] / 255) * (0.66 + radial * 0.16);
      if (strength <= 0.002) continue;

      const [, s, v] = rgbToHsv(r, g, b);
      const newS = 0.7 + Math.min(0.08, s * 0.08);
      const newV = clamp(0.58 + (v - 0.38) * 0.42, 0.18, 0.74);
      const next = hsvToRgb(targetHue, newS, newV);
      out[i] = Math.round(r * (1 - strength) + next[0] * strength);
      out[i + 1] = Math.round(g * (1 - strength) + next[1] * strength);
      out[i + 2] = Math.round(b * (1 - strength) + next[2] * strength);
    }
  }

  const restoreMask = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const radial =
        1 -
        clamp(((x - width * 0.52) / 570) ** 2 + ((y - 320) / 340) ** 2, 0, 1);
      const restore = clamp(
        (fieldBlur[index] / 255) * (0.42 - radial * 0.08),
        0,
        0.38,
      );
      restoreMask[index] = Math.round(restore * 255);
    }
  }

  const restoreAlpha = await blurMask(restoreMask, width, height, 1);
  for (let index = 0; index < width * height; index += 1) {
    const a = restoreAlpha[index] / 255;
    if (a <= 0.002) continue;
    const i = index * 4;
    const restored = enhanceColorContrast(data[i], data[i + 1], data[i + 2]);
    out[i] = Math.round(out[i] * (1 - a) + restored[0] * a);
    out[i + 1] = Math.round(out[i + 1] * (1 - a) + restored[1] * a);
    out[i + 2] = Math.round(out[i + 2] * (1 - a) + restored[2] * a);
  }

  return out;
}

async function makeOriginalShadow(originalCutout: RgbaImage): Promise<RgbaImage> {
  const shadow = Buffer.from(originalCutout.data);
  for (let index = 0; index < originalCutout.width * originalCutout.height; index += 1) {
    const i = index * 4;
    const r = shadow[i];
    const g = shadow[i + 1];
    const b = shadow[i + 2];
    const avg = (r + g + b) / 3;
    const tintMix = 0.45;
    const desaturated: Rgb = [
      Math.round(r * 0.55 + avg * 0.45),
      Math.round(g * 0.55 + avg * 0.45),
      Math.round(b * 0.55 + avg * 0.45),
    ];
    shadow[i] = Math.round(desaturated[0] * (1 - tintMix) + 70 * tintMix);
    shadow[i + 1] = Math.round(desaturated[1] * (1 - tintMix) + 52 * tintMix);
    shadow[i + 2] = Math.round(desaturated[2] * (1 - tintMix) + 140 * tintMix);
    shadow[i + 3] = Math.min(255, Math.round(shadow[i + 3] * 0.33));
  }

  const blurred = await sharp(shadow, {
    raw: {
      width: originalCutout.width,
      height: originalCutout.height,
      channels: 4,
    },
  })
    .blur(0.3)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (blurred.info.channels !== 4) {
    throw new Error(`Expected RGBA shadow, got ${blurred.info.channels} channels`);
  }

  return {
    data: Buffer.from(blurred.data),
    width: originalCutout.width,
    height: originalCutout.height,
  };
}

function formatBid(topBidWei: bigint, decimals: number, symbol: string) {
  const value = Number(formatUnits(topBidWei, decimals));
  const maximumFractionDigits = value >= 1_000_000 ? 0 : value >= 1_000 ? 2 : 4;
  const amount = Number.isFinite(value)
    ? value.toLocaleString("en-US", { maximumFractionDigits })
    : "0";
  return `${amount} ${symbol.replace(/^\$/, "")}`;
}

function formatTimeLeft(endTime: bigint, nowSeconds = Math.floor(Date.now() / 1000)) {
  const seconds = Math.max(0, Number(endTime - BigInt(nowSeconds)));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours}H ${minutes}M ${secs}S`;
}

function fontFromBuffer(font: Buffer) {
  const arrayBuffer = font.buffer.slice(
    font.byteOffset,
    font.byteOffset + font.byteLength,
  ) as ArrayBuffer;
  return opentype.parse(arrayBuffer);
}

function textPath({
  font,
  text,
  x,
  y,
  size,
  anchor = "start",
}: {
  font: opentype.Font;
  text: string;
  x: number;
  y: number;
  size: number;
  anchor?: "start" | "middle" | "end";
}) {
  const width = font.getAdvanceWidth(text, size);
  const left = anchor === "middle" ? x - width / 2 : anchor === "end" ? x - width : x;
  return font.getPath(text, left, y, size).toPathData(2);
}

async function textOverlay(input: AuctionOgRenderInput, fontBuffer: Buffer) {
  const bid = formatBid(input.topBidWei, input.bidDecimals, input.bidSymbol);
  const timeLeft = formatTimeLeft(input.endTime, input.nowSeconds);
  const label = `Warplet #${input.tokenId}`;
  const bidFontSize = bid.length > 24 ? 38 : bid.length > 20 ? 42 : 46;
  const font = fontFromBuffer(fontBuffer);
  const topBidLabelPath = textPath({ font, text: "TOP BID", x: 68, y: 617, size: 48 });
  const timeLeftLabelPath = textPath({
    font,
    text: "TIME LEFT",
    x: 68,
    y: FOOTER_TIME_Y,
    size: 48,
  });
  const bidPath = textPath({
    font,
    text: bid,
    x: 956,
    y: 617,
    size: bidFontSize,
    anchor: "end",
  });
  const timePath = textPath({
    font,
    text: timeLeft,
    x: 956,
    y: FOOTER_TIME_Y,
    size: 46,
    anchor: "end",
  });
  const labelPath = textPath({
    font,
    text: label,
    x: 512,
    y: 493,
    size: 26,
    anchor: "middle",
  });

  const svg = `
<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="labelGlow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.2" result="blur"/>
      <feFlood flood-color="#00F5FF" flood-opacity="0.12"/>
      <feComposite in2="blur" operator="in"/>
      <feMerge>
        <feMergeNode/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect x="0" y="548" width="${WIDTH}" height="172" fill="#000"/>
  <path d="${topBidLabelPath}" fill="#7B61FF" stroke="#060410" stroke-width="2"/>
  <path d="${timeLeftLabelPath}" fill="#7B61FF" stroke="#060410" stroke-width="2"/>
  <path d="${bidPath}" fill="#7B61FF" stroke="#060410" stroke-width="2"/>
  <path d="${timePath}" fill="#7B61FF" stroke="#060410" stroke-width="2"/>
  <path d="${labelPath}" fill="#7B61FF" fill-opacity="0.75" stroke="#080610" stroke-opacity="0.66" stroke-width="2" filter="url(#labelGlow)"/>
</svg>`;

  const overlay = await sharp(Buffer.from(svg))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (overlay.info.channels !== 4) {
    throw new Error(`Expected RGBA text overlay, got ${overlay.info.channels} channels`);
  }
  return { data: Buffer.from(overlay.data), width: WIDTH, height: HEIGHT };
}

async function eyesOverlay(): Promise<RgbaImage> {
  const svg = `
<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <circle cx="350" cy="74" r="23" fill="#FFFFFF"/>
  <circle cx="676" cy="74" r="23" fill="#FFFFFF"/>
</svg>`;

  const overlay = await sharp(Buffer.from(svg))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (overlay.info.channels !== 4) {
    throw new Error(`Expected RGBA eyes overlay, got ${overlay.info.channels} channels`);
  }
  return { data: Buffer.from(overlay.data), width: WIDTH, height: HEIGHT };
}

export async function renderAuctionOg(input: AuctionOgRenderInput): Promise<Buffer> {
  const [template, font, originalBuffer, gobbledBuffer] = await Promise.all([
    loadRgba(publicPath(TEMPLATE_PATH)),
    readFile(publicPath(CREEPSTER_FONT_PATH)),
    fetchImageBuffer(warpletImageSrc(input.tokenId)),
    fetchImageBuffer(input.gobbledImageUrl),
  ]);

  const original = await loadRgba(originalBuffer);
  const gobbled = await loadRgba(gobbledBuffer);
  const sampledBg = sampleBorderRgb(original);
  const [mainCutout, originalCutout] = await Promise.all([
    cutOutFlatBackground(gobbled, MAIN_HEIGHT),
    cutOutFlatBackground(original, SHADOW_HEIGHT),
  ]);
  const shadow = await makeOriginalShadow(originalCutout);
  const background = await buildDynamicBackground(template, sampledBg);

  const canvas = Buffer.from(background);
  moveTopLeftLogoDown(canvas);
  alphaComposite(canvas, WIDTH, shadow, SHADOW_X, SHADOW_Y);
  alphaComposite(canvas, WIDTH, mainCutout, Math.round((WIDTH - mainCutout.width) / 2), MAIN_Y);
  alphaComposite(canvas, WIDTH, await textOverlay(input, font), 0, 0);
  alphaComposite(canvas, WIDTH, await eyesOverlay(), 0, 0);

  return sharp(canvas, { raw: { width: WIDTH, height: HEIGHT, channels: 4 } })
    .png()
    .toBuffer();
}
