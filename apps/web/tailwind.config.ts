import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        worldnest: {
          primary: "#4F46E5",
          secondary: "#10B981",
          dark: "#1F2937",
          light: "#F9FAFB",
        },
      },
    },
  },
  plugins: [],
};

export default config;
