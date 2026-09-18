import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './vitest.setup.ts',
    // Ignora la carpeta de Playwright
    exclude: ['**/tests/**', '**/node_modules/**'],
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 30, // Ir subiendo mediante avanza el proyecto, ideal es 80
      },
    },
  },
})