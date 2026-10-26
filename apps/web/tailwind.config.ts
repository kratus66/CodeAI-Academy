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
      },
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
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
      boxShadow: {
        glow: "0 0 0 1px rgba(56,189,248,0.22), 0 30px 80px -32px rgba(56,189,248,0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
