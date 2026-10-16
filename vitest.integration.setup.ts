import { config } from 'dotenv'
import { afterAll } from 'vitest'
import { obtenerDatabaseUrlTest } from './src/infraestructura/persistencia/configuracion-db-test'

config({ path: '.env' })

const databaseUrlPrincipal = process.env.DATABASE_URL
process.env.DATABASE_URL = obtenerDatabaseUrlTest()

afterAll(() => {
  if (databaseUrlPrincipal === undefined) delete process.env.DATABASE_URL
  else process.env.DATABASE_URL = databaseUrlPrincipal
})
