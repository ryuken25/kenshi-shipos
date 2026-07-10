import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default [
  { ignores: [".next/**", "out/**", "build/**", "scripts/**", "qa/**", "playwright-report/**", "test-results/**", "*.config.*", "*.mjs"] },
  ...nextVitals,
  ...nextTs,
  { rules: { "@typescript-eslint/no-unused-vars": "warn", "@typescript-eslint/no-explicit-any": "off", "react/no-unescaped-entities": "off" } },
];
