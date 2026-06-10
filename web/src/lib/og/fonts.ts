import {
  CREEPSTER_REGULAR_B64,
  PLEX_MONO_BOLD_B64,
  POPPINS_BOLD_B64,
} from "@/lib/og/font-data";

/** Decode without Buffer so this works on both edge and Node runtimes. */
function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export type OgFont = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 700;
  style: "normal";
};

let cache: OgFont[] | null = null;

/** Satori font set for every OG image: display, body, and number fonts. */
export function ogFonts(): OgFont[] {
  if (cache) return cache;
  cache = [
    {
      name: "Creepster",
      data: base64ToArrayBuffer(CREEPSTER_REGULAR_B64),
      weight: 400,
      style: "normal",
    },
    {
      name: "Poppins",
      data: base64ToArrayBuffer(POPPINS_BOLD_B64),
      weight: 700,
      style: "normal",
    },
    {
      name: "PlexMono",
      data: base64ToArrayBuffer(PLEX_MONO_BOLD_B64),
      weight: 700,
      style: "normal",
    },
  ];
  return cache;
}
