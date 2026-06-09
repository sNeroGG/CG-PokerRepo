import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        casino: {
          felt: "#0d5c2e",
          feltDark: "#094020",
          gold: "#d4af37",
          goldLight: "#f0d060",
          card: "#faf8f5",
          red: "#c41e3a",
        },
        neon: {
          purple: "#bf00ff",
          violet: "#8a2be2",
          deep: "#1a0033",
          abyss: "#0d001a",
          black: "#0a0a0a",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-playfair)", "Georgia", "serif"],
      },
      animation: {
        "deal-in": "dealIn 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "deal-from-dealer": "dealFromDealer 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "card-flip": "cardFlip 0.5s ease-in-out forwards",
        "chip-toss": "chipToss 0.4s ease-out forwards",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
        "turn-ring": "turnRing 1.5s ease-in-out infinite",
        "neon-pulse": "neonPulse 2s ease-in-out infinite",
        "neon-border": "neonBorder 1.5s ease-in-out infinite",
        "shuffle-fan": "shuffleFan 3s ease-in-out infinite",
        "timer-tick": "timerTick 1s ease-in-out infinite",
        "glow-drift": "glowDrift 6s ease-in-out infinite",
      },
      keyframes: {
        dealIn: {
          "0%": { opacity: "0", transform: "translateY(-30px) scale(0.75) rotate(-8deg)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1) rotate(0deg)" },
        },
        dealFromDealer: {
          "0%": { opacity: "0", transform: "translateY(-80px) scale(0.5) rotate(12deg)" },
          "60%": { opacity: "1", transform: "translateY(8px) scale(1.05) rotate(-2deg)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1) rotate(0deg)" },
        },
        cardFlip: {
          "0%": { transform: "rotateY(0deg)" },
          "50%": { transform: "rotateY(90deg)" },
          "100%": { transform: "rotateY(0deg)" },
        },
        chipToss: {
          "0%": { opacity: "0", transform: "translateY(20px) scale(0.5)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 8px rgba(212, 175, 55, 0.4)" },
          "50%": { boxShadow: "0 0 24px rgba(212, 175, 55, 0.85)" },
        },
        turnRing: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(212, 175, 55, 0.5)" },
          "50%": { boxShadow: "0 0 0 6px rgba(212, 175, 55, 0)" },
        },
        neonPulse: {
          "0%, 100%": {
            textShadow: "0 0 8px rgba(191, 0, 255, 0.6), 0 0 20px rgba(191, 0, 255, 0.3)",
            opacity: "1",
          },
          "50%": {
            textShadow: "0 0 16px rgba(191, 0, 255, 1), 0 0 40px rgba(191, 0, 255, 0.6)",
            opacity: "0.92",
          },
        },
        neonBorder: {
          "0%, 100%": {
            boxShadow:
              "0 0 12px rgba(191, 0, 255, 0.7), 0 0 24px rgba(138, 43, 226, 0.4), inset 0 0 12px rgba(191, 0, 255, 0.15)",
          },
          "50%": {
            boxShadow:
              "0 0 24px rgba(191, 0, 255, 1), 0 0 48px rgba(138, 43, 226, 0.7), inset 0 0 20px rgba(191, 0, 255, 0.3)",
          },
        },
        shuffleFan: {
          "0%, 100%": { transform: "rotateY(0deg) rotateZ(-2deg)" },
          "25%": { transform: "rotateY(12deg) rotateZ(3deg)" },
          "50%": { transform: "rotateY(-8deg) rotateZ(-4deg)" },
          "75%": { transform: "rotateY(6deg) rotateZ(2deg)" },
        },
        timerTick: {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.03)" },
        },
        glowDrift: {
          "0%, 100%": { opacity: "0.4", transform: "translate(0, 0)" },
          "50%": { opacity: "0.7", transform: "translate(10px, -8px)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
