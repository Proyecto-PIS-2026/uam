import "dotenv/config";
import { randomInt } from "node:crypto";
import { obtenerDatabaseUrlTest } from "../src/infraestructura/persistencia/configuracion-db-test";

const password = process.env.E03_TEST_PASSWORD;
if (!password) throw new Error("Definí E03_TEST_PASSWORD para crear las cuentas locales de BP-E03.");

const databaseUrl = obtenerDatabaseUrlTest();
const database = new URL(databaseUrl);
if (!["localhost", "127.0.0.1", "[::1]"].includes(database.hostname)
    || decodeURIComponent(database.pathname.slice(1)) !== "uam_test") {
  throw new Error("La precarga BP-E03 solo puede ejecutarse contra localhost/uam_test.");
}

process.env.DATABASE_URL = databaseUrl;
const [{ default: argon2 }, { db }] = await Promise.all([
  import("argon2"),
  import("../src/infraestructura/persistencia/prisma/db"),
]);

try {
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  const nave = await db.orm.public.Nave.select("id").first();
  if (!nave) throw new Error("La base local no tiene naves. Ejecutá npm run db:setup:test primero.");

  for (let numero = 1; numero <= 30; numero++) {
    const sufijo = String(numero).padStart(2, "0");
    const username = `carga_e03_${sufijo}`;
    const nombreFantasia = `Prueba Carga E03 ${sufijo}`;
    const existente = await db.orm.public.Usuario.where({ username }).first();

    let usuarioId: number;
    if (existente) {
      if (existente.rol !== "OPERADOR") {
        throw new Error(`${username} ya existe con rol ${existente.rol}; no se modificó.`);
      }
      usuarioId = existente.id;
      await db.orm.public.Usuario.where({ id: usuarioId }).update({ passwordHash: hash, twoFactorEnabled: false });
    } else {
      const usuario = await db.orm.public.Usuario.create({ username, passwordHash: hash, rol: "OPERADOR", twoFactorEnabled: false });
      usuarioId = usuario.id;
    }

    const operadorExistente = await db.orm.public.Operador.where({ usuarioId }).first();
    let operadorId: number;
    if (operadorExistente) {
      operadorId = operadorExistente.id;
      await db.orm.public.Operador.where({ id: operadorId }).update({ nombreFantasia, whatsApp: "+59899123456", enLicencia: false });
    } else {
      const operador = await db.orm.public.Operador.create({ usuarioId, nombreFantasia, whatsApp: "+59899123456", enLicencia: false });
      operadorId = operador.id;
    }

    const locales = await db.orm.public.Local.where({ operadorId }).all();
    if (locales.length) {
      await db.orm.public.Local.where({ operadorId }).update({ finContrato: null });
    } else {
      await db.orm.public.Local.create({
        operadorId,
        naveId: nave.id,
        numeroLocal: String(randomInt(800_000_000, 899_999_999)),
        finContrato: null,
      });
    }
  }

  console.log("Precargadas 30 cuentas carga_e03_* en localhost/uam_test.");
} finally {
  await db.close();
}
