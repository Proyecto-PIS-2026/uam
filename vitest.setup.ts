import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

process.env.DATABASE_URL = 'postgresql://unit:unit@127.0.0.1:1/uam_unit'
process.env.DATABASE_URL_TEST = 'postgresql://unit:unit@127.0.0.1:1/uam_unit_test'

vi.mock('@/infraestructura/persistencia/prisma/db', () => ({
  db: new Proxy({}, {
    get() {
      throw new Error('Los tests unitarios deben simular la base de datos con vi.mock.')
    },
  }),
}))
