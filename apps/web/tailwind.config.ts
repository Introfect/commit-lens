import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        mint: {
          50: "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          800: "#065f46",
          900: "#064e3b",
        },
        teal: {
          500: "#14b8a6",
        },
      },
      maxWidth: {
        "7xl": "80rem",
      },
      boxShadow: {
        soft: "0 2px 8px -2px rgba(0, 0, 0, 0.08), 0 1px 4px -1px rgba(0, 0, 0, 0.04)",
        "soft-lg": "0 10px 20px -3px rgba(0, 0, 0, 0.08), 0 4px 8px -2px rgba(0, 0, 0, 0.04)",
        "soft-xl": "0 20px 30px -5px rgba(0, 0, 0, 0.1), 0 8px 12px -3px rgba(0, 0, 0, 0.05)",
      },
      animation: {
        subtle: "subtle 1.5s ease-in-out infinite",
        "float": "float 3s ease-in-out infinite",
        "slide-up": "slide-up 0.5s ease-out",
      },
      keyframes: {
        subtle: {
          "0%, 100%": { opacity: "0.7" },
          "50%": { opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "slide-up": {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
