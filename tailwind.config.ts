
import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "#181B24",
        foreground: "hsl(var(--foreground))",
        panelglass: "rgba(32, 35, 49, 0.85)", // glass panel color
        marker: "#8ed6fb",
        cluster: "#6935e7",
        accent: "#a786e7"
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        glass: "1.35rem"
      },
      keyframes: {
        "slide-in-right": {
          "0%": { transform: "translateX(100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" }
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" }
        }
      },
      animation: {
        "slide-in-right": "slide-in-right 0.3s cubic-bezier(0.65, 0, 0.35, 1)",
        "fade-in": "fade-in 0.25s ease-in"
      },
      boxShadow: {
        glass: "0 6px 32px 0 rgba(34,40,80,0.25), 0 1.5px 2.5px 0 rgba(26,30,51,0.18)",
      }
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
