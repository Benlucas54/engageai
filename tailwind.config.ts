import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface:         "#f7f6f3",
        "surface-card":  "#ffffff",
        "surface-sidebar": "#ffffff",
        border:          "#e9e6e0",
        "border-light":  "#f0ede8",
        content:         "#1c1917",
        "content-sub":   "#78746e",
        "content-faint": "#b5b0a8",
        "content-xfaint":"#d4d0ca",

        "tag-replied-bg":     "#f0f7ee",
        "tag-replied-text":   "#4a7c59",
        "tag-replied-border": "#cfe5c9",

        "tag-flagged-bg":     "#fdf6ec",
        "tag-flagged-text":   "#92600a",
        "tag-flagged-border": "#f0ddb8",

        "tag-hidden-bg":      "#fdf0f0",
        "tag-hidden-text":    "#8c3a3a",
        "tag-hidden-border":  "#f0cece",

        "tag-pending-bg":     "#f0f7fd",
        "tag-pending-text":   "#3a6e8c",
        "tag-pending-border": "#c5dff0",

        "tag-instagram-bg":     "#fdf0f8",
        "tag-instagram-text":   "#8c3a6e",
        "tag-instagram-border": "#f0cee5",

        "tag-threads-bg":     "#f0f0fd",
        "tag-threads-text":   "#3a3a8c",
        "tag-threads-border": "#ceceee",

        "tag-x-bg":     "#f2f2f2",
        "tag-x-text":   "#555555",
        "tag-x-border": "#dddddd",

        // Smart tag colors
        "tag-purchase-bg":     "#ecfdf5",
        "tag-purchase-text":   "#065f46",
        "tag-purchase-border": "#a7f3d0",
        "tag-complaint-bg":    "#fef2f2",
        "tag-complaint-text":  "#991b1b",
        "tag-complaint-border":"#fecaca",
        "tag-question-bg":     "#eff6ff",
        "tag-question-text":   "#1e40af",
        "tag-question-border": "#bfdbfe",
        "tag-compliment-bg":   "#fffbeb",
        "tag-compliment-text": "#92400e",
        "tag-compliment-border":"#fde68a",
      },
      fontFamily: {
        sans:    ["var(--font-dm-sans)", "sans-serif"],
        display: ["var(--font-playfair)", "serif"],
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
