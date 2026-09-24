import { config } from 'dotenv'

config({ path: '.env' })

const databaseUrlTest = process.env.DATABASE_URL_TEST

if (databaseUrlTest) {
  process.env.DATABASE_URL = databaseUrlTest
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    'No se encontró DATABASE_URL ni DATABASE_URL_TEST para los tests de integración'
  )
}