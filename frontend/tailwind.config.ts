import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "#0f172a",
          secondary: "#1e293b",
          card: "#334155",
        },
        accent: {
          blue: "#3b82f6",
          purple: "#8b5cf6",
        },
        status: {
          success: "#22c55e",
          warning: "#f59e0b",
          diadoc: "#f97316",
          onec: "#ffd54f",
        },
        text: {
          primary: "#e2e8f0",
          secondary: "#94a3b8",
          muted: "#64748b",
        },
      },
    },
  },
  plugins: [],
};
export default config;
