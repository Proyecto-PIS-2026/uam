import "temporal-polyfill/full/global";
import "temporal-polyfill/types/global";
import { randomBytes, randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { basename, join } from "node:path";
import argon2 from "argon2";
import postgres from "@prisma/orm-postgres/runtime";
import { test as base } from "@playwright/test";
import type { Contract } from "../src/infraestructura/persistencia/prisma/contract";
import contractJson from "../src/infraestructura/persistencia/prisma/contract.json" with { type: "json" };
import type { Credenciales } from "./autenticacion";

function conectar() {
  const url = process.env.DATABASE_URL;
  if (!url || url !== process.env.DATABASE_URL_TEST) {
    throw new Error("BP-15.1 requiere DATABASE_URL y DATABASE_URL_TEST apuntando a la misma base de pruebas que el servidor E2E.");
  }
  return postgres<Contract>({ contractJson, url });
}

type ProductorPrueba = { id: number; usuarioId: number; credenciales: Credenciales };
type PublicacionesProductor = {
  db: ReturnType<typeof conectar>;
  propio: ProductorPrueba;
  ajeno: ProductorPrueba;
  administrador: Credenciales;
  operador: Credenciales;
};

export const test = base.extend<{ publicacionesProductor: PublicacionesProductor }>({
  publicacionesProductor: async ({}, ejecutarTest) => {
    const db = conectar();
    const usuarios: number[] = [];
    const productores: number[] = [];
    try {
      const contrasena = randomBytes(24).toString("hex");
      const passwordHash = await argon2.hash(contrasena, { type: argon2.argon2id });
      async function crearProductor(): Promise<ProductorPrueba> {
        const username = `e2e_bp151_${randomUUID()}`;
        const usuario = await db.orm.public.Usuario.create({ username, passwordHash, rol: "PRODUCTOR", twoFactorEnabled: false });
        usuarios.push(usuario.id);
        const productor = await db.orm.public.Productor.create({
          usuarioId: usuario.id,
          nombreFantasia: `Productor de prueba ${usuario.id}`,
          whatsApp: "+59890000000",
        });
        productores.push(productor.id);
        return { id: productor.id, usuarioId: usuario.id, credenciales: { usuario: username, contrasena } };
      }

      const propio = await crearProductor();
      const ajeno = await crearProductor();
      const username = `e2e_bp151_admin_${randomUUID()}`;
      const email = `${username}@example.com`;
      const usuario = await db.orm.public.Usuario.create({ username, passwordHash, rol: "ADMINISTRADOR", twoFactorEnabled: false });
      usuarios.push(usuario.id);
      await db.orm.public.Administrador.create({ usuarioId: usuario.id, email });
      const nombreOperador = `e2e_bp151_operador_${randomUUID()}`;
      const usuarioOperador = await db.orm.public.Usuario.create({ username: nombreOperador, passwordHash, rol: "OPERADOR", twoFactorEnabled: false });
      usuarios.push(usuarioOperador.id);
      const operador = await db.orm.public.Operador.create({ usuarioId: usuarioOperador.id, nombreFantasia: nombreOperador, whatsApp: "+59890000000", enLicencia: false });
      const nave = await db.orm.public.Nave.select("id").first();
      if (!nave) throw new Error("La base E2E debe tener al menos una Nave de la seed.");
      await db.orm.public.Local.create({ operadorId: operador.id, naveId: nave.id, numeroLocal: nombreOperador, finContrato: null });
      await ejecutarTest({ db, propio, ajeno, administrador: { usuario: email, contrasena }, operador: { usuario: nombreOperador, contrasena } });
    } finally {
      try {
        for (const productorId of productores) {
          const relaciones = await db.orm.public.PublicacionProductor.where({ productorId }).all();
          for (const relacion of relaciones) {
            const publicacion = await db.orm.public.Publicacion.where({ id: relacion.publicacionId }).select("foto").first();
            await db.orm.public.Publicacion.where({ id: relacion.publicacionId }).delete();
            if (publicacion?.foto?.startsWith(`/api/publicaciones/imagenes/${relacion.publicacionId}/`)) {
              await rm(join(process.cwd(), "storage", "publicaciones", String(relacion.publicacionId), basename(publicacion.foto)), { force: true });
            }
          }
        }
        for (const usuarioId of usuarios) {
          const operador = await db.orm.public.Operador.where({ usuarioId }).select("id").first();
          if (operador) await db.orm.public.Local.where({ operadorId: operador.id }).delete();
          await db.orm.public.Usuario.where({ id: usuarioId }).delete();
        }
      } finally {
        await db.close();
      }
    }
  },
});
