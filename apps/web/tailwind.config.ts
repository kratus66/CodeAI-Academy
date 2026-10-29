import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#070b14",
          soft: "#0b1220",
          card: "#0f172a",
        },
        line: "#1e293b",
        accent: {
          DEFAULT: "#38bdf8",
          soft: "#0ea5e9",
          deep: "#0284c7",
        },
        mint: "#34d399",
        piece: {
          i: "#22d3ee",
          o: "#facc15",
          t: "#a78bfa",
          s: "#34d399",
          z: "#fb7185",
          j: "#60a5fa",
          l: "#fb923c",
        },
      },
      fontFamily: {
        display: [
          "var(--font-display)",
          "system-ui",
          "sans-serif",
        ],
        sans: [
          "var(--font-sans)",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "var(--font-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "Liberation Mono",
          "monospace",
        ],
      },
      backgroundImage: {
        grid:
          "linear-gradient(to right, rgba(148,163,184,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.10) 1px, transparent 1px)",
      },
      keyframes: {
        "drop-in": {
          "0%": { opacity: "0", transform: "translateY(-14px) scale(0.9)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "piece-fall": {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
          "40%, 80%": { opacity: "1", transform: "translateY(0)" },
          "100%": { opacity: "0", transform: "translateY(0)" },
        },
        rise: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "drop-in": "drop-in 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both",
        "piece-fall": "piece-fall 1.4s ease-in-out infinite",
        rise: "rise 0.35s ease-out both",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(56,189,248,0.22), 0 30px 80px -32px rgba(56,189,248,0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
