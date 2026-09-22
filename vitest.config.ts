import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  test: {
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 30,
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'jsdom',
          globals: true,
          setupFiles: './vitest.setup.ts',
          include: ['**/*.test.ts', '**/*.test.tsx'],
          exclude: [
            '**/*.integration.test.ts',
            '**/tests/**',
            '**/node_modules/**',
          ],
        },
      },
      {
        test: {
          name: 'integration',
          environment: 'node',
          globals: true,
          setupFiles: './vitest.integration.setup.ts',
          include: ['**/*.integration.test.ts'],
          exclude: [
            '**/tests/**',
            '**/node_modules/**',
          ],
        },
      },
    ],
  },
})