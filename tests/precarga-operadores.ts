import "temporal-polyfill/full/global";
import "temporal-polyfill/types/global";
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import argon2 from "argon2";
import postgres from "@prisma/orm-postgres/runtime";
import { test as base } from "@playwright/test";
import type { Contract } from "../src/infraestructura/persistencia/prisma/contract";
import contractJson from "../src/infraestructura/persistencia/prisma/contract.json" with { type: "json" };
import type { Credenciales } from "./autenticacion";

function conectar() {
  const url = process.env.DATABASE_URL;
  if (!url || url !== process.env.DATABASE_URL_TEST) {
    throw new Error("BP-14.1 requiere DATABASE_URL y DATABASE_URL_TEST apuntando a la base aislada utilizada por el servidor E2E.");
  }
  return postgres<Contract>({ contractJson, url });
}

export type OperadorPrecarga = {
  id: number;
  usuarioId: number;
  nombre: string;
  credenciales: Credenciales;
};
export type DatosOperadorPrecarga = {
  nombre: string;
  local: string;
  naveId: number;
  credenciales: Credenciales;
};
type PrecargaOperadores = {
  db: ReturnType<typeof conectar>;
  administrador: Credenciales;
  productor: Credenciales;
  operadorA: OperadorPrecarga;
  operadorB: OperadorPrecarga;
  reservarOperador: () => DatosOperadorPrecarga;
};

export const test = base.extend<{ precargaOperadores: PrecargaOperadores }>({
  precargaOperadores: async ({}, ejecutarTest) => {
    const db = conectar();
    const nombresUsuarios = new Set<string>();
    try {
      const contrasena = randomBytes(24).toString("hex");
      const passwordHash = await argon2.hash(contrasena, { type: argon2.argon2id });
      const nave = await db.orm.public.Nave.select("id").first();
      if (!nave) throw new Error("La base E2E necesita las naves de la seed.");

      function reservarOperador(): DatosOperadorPrecarga {
        const sufijo = randomUUID().replaceAll("-", "");
        const usuario = `e2e_bp141_${sufijo}`;
        nombresUsuarios.add(usuario);
        return {
          nombre: `Operador BP14 ${sufijo.slice(0, 12)}`,
          local: `9${randomInt(100000000, 1000000000)}`,
          naveId: nave!.id,
          credenciales: { usuario, contrasena },
        };
      }

      async function crearOperador(): Promise<OperadorPrecarga> {
        const datos = reservarOperador();
        const usuario = await db.orm.public.Usuario.create({ username: datos.credenciales.usuario, passwordHash, rol: "OPERADOR", twoFactorEnabled: false });
        const operador = await db.orm.public.Operador.create({ usuarioId: usuario.id, nombreFantasia: datos.nombre, whatsApp: "+59899123456", enLicencia: false });
        await db.orm.public.Local.create({ operadorId: operador.id, naveId: datos.naveId, numeroLocal: datos.local, finContrato: null });
        return { id: operador.id, usuarioId: usuario.id, nombre: datos.nombre, credenciales: datos.credenciales };
      }

      const nombreAdmin = `e2e_bp141_admin_${randomUUID()}`;
      nombresUsuarios.add(nombreAdmin);
      const administrador = await db.orm.public.Usuario.create({ username: nombreAdmin, passwordHash, rol: "ADMINISTRADOR", twoFactorEnabled: false });
      const email = `${nombreAdmin}@example.com`;
      await db.orm.public.Administrador.create({ usuarioId: administrador.id, email });
      const nombreProductor = `e2e_bp141_productor_${randomUUID()}`;
      nombresUsuarios.add(nombreProductor);
      const productor = await db.orm.public.Usuario.create({ username: nombreProductor, passwordHash, rol: "PRODUCTOR", twoFactorEnabled: false });
      await db.orm.public.Productor.create({ usuarioId: productor.id, nombreFantasia: nombreProductor, whatsApp: "+59899123456" });
      const operadorA = await crearOperador();
      const operadorB = await crearOperador();
      await ejecutarTest({ db, administrador: { usuario: email, contrasena }, productor: { usuario: nombreProductor, contrasena }, operadorA, operadorB, reservarOperador });
    } finally {
      try {
        // Se eliminan únicamente las cuentas reservadas por este caso y sus publicaciones.
        for (const username of nombresUsuarios) {
          const usuario = await db.orm.public.Usuario.where({ username }).select("id").first();
          if (!usuario) continue;
          const operador = await db.orm.public.Operador.where({ usuarioId: usuario.id }).select("id").first();
          if (operador) {
            const relaciones = await db.orm.public.PublicacionOperador.where({ operadorId: operador.id }).all();
            for (const relacion of relaciones) {
              await db.orm.public.Publicacion.where({ id: relacion.publicacionId }).delete();
            }
            await db.orm.public.Local.where({ operadorId: operador.id }).delete();
          }
          await db.orm.public.Usuario.where({ id: usuario.id }).delete();
        }
      } finally {
        await db.close();
      }
    }
  },
});
