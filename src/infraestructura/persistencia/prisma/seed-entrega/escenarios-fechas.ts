import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Temporal } from "temporal-polyfill";

import { compararEspeciesPorPrioridad } from "../../../../compartido/prioridad-especies";
import { claveImagen, urlImagen } from "../../../imagenes/almacenamiento-imagenes";
import type { ClienteSeed } from "./datos-base";
import type { CuentaOperadorEntrega, CuentaProductorEntrega } from "./cuentas";

type EspecieEscenario = { id: number; nombre: string; fotoEspecie: string | null };

export function fechasDePrueba(): string[] {
  return Array.from({ length: 16 }, (_, indice) => `2026-11-${indice + 15}`);
}

export function seleccionarEspeciesDePrueba(especies: readonly EspecieEscenario[]): EspecieEscenario[] {
  const seleccionadas = especies.filter((especie) => especie.fotoEspecie !== null)
    .sort((a, b) => compararEspeciesPorPrioridad(a.nombre, b.nombre))
    .slice(0, fechasDePrueba().length);
  if (seleccionadas.length !== fechasDePrueba().length) {
    throw new Error("Se necesitan dieciséis especies con foto genérica para las pruebas de fechas.");
  }
  return seleccionadas;
}

export async function crearPublicacionesDePrueba(
  cliente: ClienteSeed,
  cuenta: CuentaOperadorEntrega | CuentaProductorEntrega,
  propietarioId: number,
  especies: readonly EspecieEscenario[],
  paisId: number,
): Promise<number> {
  if (!cuenta.escenario) return 0;
  const muestras = seleccionarEspeciesDePrueba(especies);
  const ahora = Temporal.Now.instant();

  for (const [indice, dia] of fechasDePrueba().entries()) {
    const especie = muestras[indice];
    const fecha = Temporal.PlainDate.from(dia).toZonedDateTime("America/Montevideo").toInstant();
    const fechaVigencia = cuenta.escenario === "vigencia"
      ? Temporal.PlainDate.from(dia).toPlainDateTime({ hour: 23, minute: 59, second: 59 })
        .toZonedDateTime("America/Montevideo").toInstant()
      : null;
    const publicacion = await cliente.orm.public.Publicacion.create({
      fecha,
      fechaVigencia,
      tipoPublicacion: cuenta.rol,
      especieId: especie.id,
      publicacionActiva: true,
      publicacionDisponible: fechaVigencia === null || Temporal.Instant.compare(fechaVigencia, ahora) >= 0,
      comentario: cuenta.escenario === "aging"
        ? `Prueba de foto cargada el ${dia}.`
        : cuenta.escenario === "vigencia"
          ? `Prueba de publicación vigente hasta el ${dia}.`
          : `Prueba de vencimiento de locales del ${dia}.`,
    });

    if (cuenta.rol === "OPERADOR") {
      await cliente.orm.public.PublicacionOperador.create({
        publicacionId: publicacion.id, operadorId: propietarioId, paisId,
      });
    } else {
      await cliente.orm.public.PublicacionProductor.create({
        publicacionId: publicacion.id, productorId: propietarioId, paisId,
      });
    }

    if (cuenta.escenario === "aging") {
      const foto = especie.fotoEspecie!;
      const contenido = readFileSync(new URL(`../../../../../public${foto}`, import.meta.url));
      const archivo = `${randomUUID()}${foto.slice(foto.lastIndexOf("."))}`;
      await cliente.orm.public.Imagen.create({
        clave: claveImagen("publicaciones", publicacion.id, archivo),
        contenido,
        cargadaEn: fecha,
        avisoVencimientoEn: null,
      });
      await cliente.orm.public.Publicacion.where({ id: publicacion.id }).update({
        foto: urlImagen("publicaciones", publicacion.id, archivo),
        // Conservar la fecha de prueba al asociar la foto, pese a temporal.updatedAt().
        fecha,
      });
    }
  }
  return muestras.length;
}
