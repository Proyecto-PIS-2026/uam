import 'dotenv/config'
import { spawnSync } from 'node:child_process'

const databaseUrlTest = process.env.DATABASE_URL_TEST

if (!databaseUrlTest) {
  throw new Error('No se encontró DATABASE_URL_TEST en el archivo .env')
}

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'

const resultado = spawnSync(
  npmCommand,
  ['run', 'db:seed'],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      DATABASE_URL: databaseUrlTest,
    },
  }
)

if (resultado.error) {
  throw resultado.error
}

process.exit(resultado.status ?? 1)