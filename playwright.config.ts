import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,

  // Se puede cambiar el 1 por 2 o 4 para acelerar los tests móviles en paralelo si los servidores de CI son buenos
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'dot' : 'html',

  use: {
    // MIGRACIÓN REAL: Modificar 'http://localhost:3000' si el puerto de desarrollo local de Next.js cambia
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',

    // Se pueden guardar fotos y videos automáticos de las pantallas cuando un test falle con:
    // screenshot: 'only-on-failure',
    // video: 'retain-on-failure',

    // MIGRACIÓN REAL: Cuando el sistema real requiera Login obligatorio, descomentar para reutilizar la sesión autenticada en todos los tests móviles sin repetir el proceso de inicio de sesión
    // storageState: 'playwright/.auth/user.json',
  },

  projects: [
    // Chrome de Escritorio como control base del motor Chromium
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    /* Descomentar al migrar 

    // Se puede cambiar 'Pixel 7' por modelos más recientes de Android
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 7'] },
    },

    // Se puede cambiar 'iPhone 14' por un modelo más nuevo
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 14'] },
    },
    
    */

  ],
});
