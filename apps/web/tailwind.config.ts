import type { Config } from "tailwindcss";

/**
 * Los neutros y los acentos salen de tokens CSS (`globals.css`), no de valores
 * fijos: `[data-theme="light"]` cambia el valor y toda la UI se adapta. `<alpha-value>`
 * conserva los modificadores de opacidad (`bg-ink/80`, `border-white/10`).
 */
function token(name: string): string {
  return `rgb(var(--${name}) / <alpha-value>)`;
}

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: token("ink"),
          soft: token("ink-soft"),
          card: token("ink-card"),
        },
        line: token("line"),
        white: token("white"),
        slate: {
          100: token("slate-100"),
          200: token("slate-200"),
          300: token("slate-300"),
          400: token("slate-400"),
          500: token("slate-500"),
          600: token("slate-600"),
          700: token("slate-700"),
          800: token("slate-800"),
          900: token("slate-900"),
          950: token("slate-950"),
        },
        accent: {
          DEFAULT: token("accent"),
          soft: token("accent-soft"),
          deep: token("accent-deep"),
        },
        mint: token("mint"),
        // Estados: solo los pasos que se usan como texto llevan token.
        rose: {
          200: token("rose-200"),
          300: token("rose-300"),
          400: token("rose-400"),
        },
        amber: {
          100: token("amber-100"),
          200: token("amber-200"),
          300: token("amber-300"),
          400: token("amber-400"),
        },
        emerald: {
          200: token("emerald-200"),
          300: token("emerald-300"),
          400: token("emerald-400"),
        },
        sky: {
          200: token("sky-200"),
          300: token("sky-300"),
          400: token("sky-400"),
        },
        cyan: {
          100: token("cyan-100"),
          400: token("cyan-400"),
        },
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
