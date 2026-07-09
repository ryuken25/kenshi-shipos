import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        base: { DEFAULT: "#0B0D14", light: "#11131D", lighter: "#171923" },
        panel: { DEFAULT: "#171923", soft: "#202331", hover: "#292D3D" },
        verse: { purple: "#7C5CFF", blue: "#39D0FF" },
        success: "#49D17D",
        warning: "#FFD166",
        danger: "#FF5C7A",
      },
      fontFamily: {
        heading: ["Sora", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
