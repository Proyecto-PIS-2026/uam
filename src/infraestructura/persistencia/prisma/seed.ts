import "dotenv/config";
import "temporal-polyfill/full/global";
import "temporal-polyfill/types/global";
import postgres from "@prisma/orm-postgres/runtime";

import type { Contract } from "./contract.d";
import contractJson from "./contract.json" with { type: "json" };
import { crearCuentasEntrega, obtenerUsuariosSinLocal } from "./seed-entrega/cuentas";
import { crearHashesIniciales } from "./seed-entrega/credenciales";
import { cargarDatosBase } from "./seed-entrega/datos-base";
import { crearPublicacionesDePrueba } from "./seed-entrega/escenarios-fechas";
import { limpiarBase } from "./seed-entrega/limpiar-base";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("Falta configurar DATABASE_URL para ejecutar la seed.");
  const cuentas = crearCuentasEntrega();
  const sinLocal = obtenerUsuariosSinLocal(cuentas);
  console.log(`Preparando ${cuentas.length} cuentas de entrega...`);
  const hashes = await crearHashesIniciales(cuentas);

  const prisma = postgres<Contract>({ contractJson, url: process.env.DATABASE_URL });
  try {
    const publicaciones = await prisma.transaction(async (tx) => {
      await limpiarBase(tx);
      const naves = cuentas.flatMap((cuenta) => cuenta.rol === "OPERADOR"
        ? cuenta.locales.map((local) => local.nave) : []);
      const base = await cargarDatosBase(tx, naves);
      const paisId = base.paisIds.get("URUGUAY");
      if (paisId === undefined) throw new Error("Falta Uruguay en el catálogo de países.");
      let cantidadPublicaciones = 0;

      for (const cuenta of cuentas) {
        const usuario = await tx.orm.public.Usuario.create({
          username: cuenta.username,
          passwordHash: hashes.get(cuenta.identificadorIngreso)!,
          rol: cuenta.rol,
          habilitado: true,
          twoFactorEnabled: false,
        });
        if (cuenta.rol === "ADMINISTRADOR") {
          await tx.orm.public.Administrador.create({ usuarioId: usuario.id, email: cuenta.email });
          continue;
        }

        let propietarioId: number;
        if (cuenta.rol === "OPERADOR") {
          const operador = await tx.orm.public.Operador.create({
            usuarioId: usuario.id,
            nombreFantasia: cuenta.nombreFantasia,
            whatsApp: cuenta.whatsapp,
            enLicencia: false,
          });
          propietarioId = operador.id;
          for (const local of cuenta.locales) {
            const naveId = base.naveIds.get(local.nave);
            if (naveId === undefined) throw new Error(`Falta la nave ${local.nave}.`);
            await tx.orm.public.Local.create({
              operadorId: operador.id,
              naveId,
              numeroLocal: local.numero,
              finContrato: local.finContrato === null ? null : Temporal.Instant.from(local.finContrato),
            });
          }
        } else {
          const productor = await tx.orm.public.Productor.create({
            usuarioId: usuario.id,
            nombreFantasia: cuenta.nombreFantasia,
            whatsApp: cuenta.whatsapp,
          });
          propietarioId = productor.id;
        }
        cantidadPublicaciones += await crearPublicacionesDePrueba(tx, cuenta, propietarioId, base.especies, paisId);
      }
      return cantidadPublicaciones;
    });
    console.log(`Seed de entrega completa: ${cuentas.length} cuentas y ${publicaciones} publicaciones de prueba.`);
    console.log(`${sinLocal.length} operadores sin local no pueden iniciar sesión.`);
  } finally {
    await prisma.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
