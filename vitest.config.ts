import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react' // Asegúrate de tenerlo o instálalo si falta

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    // Fuerza a Vitest a ignorar la carpeta de Playwright
    exclude: ['**/tests/**', '**/node_modules/**'],
  },
})
