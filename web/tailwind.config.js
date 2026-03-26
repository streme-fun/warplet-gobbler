/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  safelist: [
    "bg-primary/20", "border-primary/30", "text-primary",
    "bg-secondary/20", "border-secondary/30", "text-secondary",
    "bg-accent/20", "border-accent/30", "text-accent",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['var(--font-cinzel)', 'Cinzel', 'serif'],
      },
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        warplet: {
          "primary":           "#00F5FF",
          "primary-content":   "#0D0B14",

          "secondary":         "#7B61FF",
          "secondary-content": "#FFFFFF",

          "accent":            "#FF007A",
          "accent-content":    "#FFFFFF",

          "neutral":           "#0D0B14",
          "neutral-content":   "#C9C5D4",

          "base-100":          "#13111C",
          "base-200":          "#1A1726",
          "base-300":          "#221F2E",
          "base-content":      "#E8E5F0",

          "info":              "#00B4D8",
          "success":           "#00E676",
          "warning":           "#FFB800",
          "error":             "#FF3D71",
        },
      },
    ],
    darkTheme: "warplet",
    logs: false,
  },
};
