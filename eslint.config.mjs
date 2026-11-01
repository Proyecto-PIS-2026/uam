import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{tsx,jsx}"],
    ignores: ["**/*.test.*"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXOpeningElement[name.name='select']",
          message: "Usá Select de MUI con MenuItem para mantener el diseño y la interacción de los selects de la aplicación.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    ".playwright/**",
    "next-env.d.ts",
    "migrations/**",
    "src/infraestructura/persistencia/prisma/contract.d.ts",
    "src/infraestructura/persistencia/prisma/migrations/snapshots/**",
    "**/.agents/**",
    "**/.claude/**",
    "**/.cursor/**",
    "**/.devin/**",
  ]),
]);

export default eslintConfig;
