import "temporal-polyfill/full/global";
import "temporal-polyfill/types/global";
import { randomBytes, randomUUID } from "node:crypto";
import argon2 from "argon2";
import { config } from "dotenv";
import postgres from "@prisma/orm-postgres/runtime";
import { test as base } from "@playwright/test";
import type { Contract } from "../src/infraestructura/persistencia/prisma/contract";
import contractJson from "../src/infraestructura/persistencia/prisma/contract.json" with { type: "json" };
import type { Credenciales } from "./autenticacion";

type UsuariosAdministrativos = {
  administrador: Credenciales;
  productor: Credenciales;
};

export const test = base.extend<{ usuariosAdministrativos: UsuariosAdministrativos }>({
  usuariosAdministrativos: async ({}, ejecutarTest) => {
    config({ path: [".env.local", ".env"], quiet: true });
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("Configure DATABASE_URL con la base utilizada por el servidor E2E.");

    const db = postgres<Contract>({ contractJson, url });
    const sufijo = randomUUID();
    const contrasena = randomBytes(24).toString("hex");
    try {
      const passwordHash = await argon2.hash(contrasena, { type: argon2.argon2id });
      // Cada test usa cuentas propias; las cuentas de la seed conservan sus contraseñas.
      const usuarios = await db.transaction(async (tx) => {
        const administrador = await tx.orm.public.Usuario.create({
          username: `e2e_admin_${sufijo}`,
          passwordHash,
          rol: "ADMINISTRADOR",
          twoFactorEnabled: false,
        });
        const email = `e2e_admin_${sufijo}@example.com`;
        await tx.orm.public.Administrador.create({ usuarioId: administrador.id, email });
        const productor = await tx.orm.public.Usuario.create({
          username: `e2e_productor_${sufijo}`,
          passwordHash,
          rol: "PRODUCTOR",
          twoFactorEnabled: false,
        });
        await tx.orm.public.Productor.create({ usuarioId: productor.id, nombreFantasia: `Productor de prueba ${productor.id}`, whatsApp: "+59890000000" });
        return { administrador, productor, email };
      });

      try {
        await ejecutarTest({
          administrador: { usuario: usuarios.email, contrasena },
          productor: { usuario: usuarios.productor.username, contrasena },
        });
      } finally {
        // Las relaciones Administrador y Productor se eliminan por cascada.
        await db.transaction(async (tx) => {
          await tx.orm.public.Usuario.where({ id: usuarios.administrador.id }).delete();
          await tx.orm.public.Usuario.where({ id: usuarios.productor.id }).delete();
        });
      }
    } finally {
      await db.close();
    }
  },
});
