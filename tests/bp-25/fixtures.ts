import "temporal-polyfill/full/global";
import "temporal-polyfill/types/global";
import { config } from "dotenv";
import postgres from "@prisma/orm-postgres/runtime";
import type { Contract } from "../../src/infraestructura/persistencia/prisma/contract";
import contractJson from "../../src/infraestructura/persistencia/prisma/contract.json" with { type: "json" };
import { obtenerDatabaseUrlTest } from "../../src/infraestructura/persistencia/configuracion-db-test";

type EstadoPublicacion = {
  id: number;
  publicacionActiva: boolean;
  publicacionDisponible: boolean;
};

async function conPublicacionesProductorOcultas<T>(
  idsProductor: number[] | null,
  ejecutar: () => Promise<T>,
): Promise<T> {
  config({ path: [".env.local", ".env"], quiet: true });
  const url = obtenerDatabaseUrlTest();

  const db = postgres<Contract>({ contractJson, url });
  let estados: EstadoPublicacion[] = [];
  try {
    const relaciones = await db.orm.public.PublicacionProductor
      .select("productorId", "publicacionId")
      .include("publicacion", (publicacion) =>
        publicacion.select("publicacionActiva", "publicacionDisponible"),
      )
      .all();
    const seleccionadas = idsProductor === null
      ? relaciones
      : relaciones.filter((relacion) => idsProductor.includes(relacion.productorId));

    if (seleccionadas.length === 0) {
      throw new Error("La seed de uam_test debe incluir publicaciones de Productores para estos casos.");
    }
    if (idsProductor !== null && !seleccionadas.some(({ publicacion }) =>
      publicacion.publicacionActiva && publicacion.publicacionDisponible,
    )) {
      throw new Error("El Productor de prueba debe tener al menos una publicación pública antes del caso.");
    }

    estados = seleccionadas.map(({ publicacionId, publicacion }) => ({
      id: publicacionId,
      publicacionActiva: publicacion.publicacionActiva,
      publicacionDisponible: publicacion.publicacionDisponible,
    }));

    await db.transaction(async (tx) => {
      for (const publicacion of estados) {
        await tx.orm.public.Publicacion.where({ id: publicacion.id }).update({
          publicacionActiva: false,
          publicacionDisponible: false,
        });
      }
    });

    return await ejecutar();
  } finally {
    if (estados.length > 0) {
      await db.transaction(async (tx) => {
        for (const estado of estados) {
          await tx.orm.public.Publicacion.where({ id: estado.id }).update({
            publicacionActiva: estado.publicacionActiva,
            publicacionDisponible: estado.publicacionDisponible,
          });
        }
      });
    }
    await db.close();
  }
}

export async function conListadoSinProductoresPublicos<T>(ejecutar: () => Promise<T>) {
  return conPublicacionesProductorOcultas(null, ejecutar);
}

export async function conProductorSinPublicacionesPublicas<T>(
  nombreFantasia: string,
  ejecutar: () => Promise<T>,
) {
  config({ path: [".env.local", ".env"], quiet: true });
  const url = obtenerDatabaseUrlTest();

  const db = postgres<Contract>({ contractJson, url });
  try {
    const productores = await db.orm.public.Productor.select("id", "nombreFantasia").all();
    const productor = productores.find((item) => item.nombreFantasia === nombreFantasia);
    if (!productor) throw new Error(`No existe el Productor de prueba ${nombreFantasia} en uam_test.`);
    return await conPublicacionesProductorOcultas([productor.id], ejecutar);
  } finally {
    await db.close();
  }
}
