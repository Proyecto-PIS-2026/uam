import "temporal-polyfill/full/global";
import "temporal-polyfill/types/global";

import { validarCatalogosSeleccion } from "./seleccion-publicacion";
import { db } from "../../infraestructura/persistencia/prisma/db";
import {
    ErrorImagenProductor,
    guardarImagenProductor,
} from "./imagenes-productor";
import { limpiarImagenPublicacionNoReferenciada } from "./operadores/limpiar-imagen-publicacion";
import { validarAltaPublicacionProductor } from "./validarAltaPublicacionProductor";
import { normalizarPrecioPublicacion } from "./precio-publicacion";
import { convertirFechaVigenciaAInstant } from "./vigencia-publicacion";

export type ResultadoAltaPublicacionProductor =
    | { esValido: false; errores: string[] }
    | { esValido: true; id: number; mensaje: string };

export async function altaPublicacionProductor(
    valor: unknown,
): Promise<ResultadoAltaPublicacionProductor> {
    const validacion = validarAltaPublicacionProductor(valor);

    if (!validacion.esValido) return validacion;

    const datos = validacion.datos;

    const [configHabilitada, configDias] = await Promise.all([
        db.orm.public.Configuracion
            .where({
                nombreConfiguracion: "vigencia_publicaciones_productor_habilitada",
            })
            .select("valorConfiguracion")
            .first(),

        db.orm.public.Configuracion
            .where({
                nombreConfiguracion: "vigencia_publicaciones_productor",
            })
            .select("valorConfiguracion")
            .first(),
    ]);

    let fechaVigencia = datos.fechaVigencia ?? null;

    if (!configHabilitada || !configDias) {
        throw new Error(
            "No se pudo consultar la configuración de vigencia de publicaciones.",
        );
    }

    if (configHabilitada.valorConfiguracion === "true") {
        const dias = Number(configDias.valorConfiguracion);

        if (!Number.isSafeInteger(dias) || dias <= 0) {
            throw new Error(
                "La configuración de vigencia de publicaciones no es válida.",
            );
        }

        const fechaMaxima = Temporal.Now
            .plainDateISO("America/Montevideo")
            .add({ days: dias })
            .toString();

        if (fechaVigencia === null) {
            fechaVigencia = fechaMaxima;
        } else if (fechaVigencia > fechaMaxima) {
            return {
                esValido: false,
                errores: [
                    `La fecha de vigencia no puede superar el ${fechaMaxima}.`,
                ],
            };
        }
    }

    const [productor, catalogosValidos] = await Promise.all([
        db.orm.public.Productor
            .where({ id: datos.productorId })
            .first(),

        validarCatalogosSeleccion(db, datos),
    ]);

    if (!productor || !catalogosValidos) {
        return {
            esValido: false,
            errores: [
                "La selección contiene datos que ya no están disponibles. Actualizá el formulario.",
            ],
        };
    }

    type Precio = Parameters<
        typeof db.orm.public.Publicacion.create
    >[0]["precio"];

    const precio = normalizarPrecioPublicacion(datos.precio) as Precio;

    let imagenCreada: {
        url: string;
        publicacionId: number;
    } | undefined;

    let resultado: ResultadoAltaPublicacionProductor;

    try {
        if (datos.fotografia) {
            const plan = db.raw.sql`
                SELECT nextval(pg_get_serial_sequence('publicacion', 'id'))::int AS id
            `
                .returnsRow({ id: "pg/int4@1" })
                .build();

            const [identificador] = await db.runtime().query(plan);

            if (!identificador) {
                throw new Error(
                    "No se pudo reservar el identificador de la publicación.",
                );
            }

            const url = await guardarImagenProductor(
                identificador.id,
                datos.fotografia,
            );

            imagenCreada = {
                url,
                publicacionId: identificador.id,
            };
        }

        resultado = await db.transaction(
            async (tx): Promise<ResultadoAltaPublicacionProductor> => {
                await tx.execute(
                    db.raw.sql`
                        SELECT 1::int AS locked
                        FROM pg_advisory_xact_lock(1720, ${productor.id})
                    `
                        .returnsRow({ locked: "pg/int4@1" })
                        .build(),
                );

                const productorActual = await tx.orm.public.Productor
                    .where({ id: productor.id })
                    .first();

                if (!productorActual) {
                    return {
                        esValido: false,
                        errores: [
                            "El Productor ya no existe. No se pudo guardar la publicación.",
                        ],
                    };
                }

                const relaciones = await tx.orm.public.PublicacionProductor
                    .where({ productorId: productor.id })
                    .all();

                const ids = new Set(
                    relaciones
                        .filter(
                            (relacion) => relacion.paisId === datos.paisId,
                        )
                        .map((relacion) => relacion.publicacionId),
                );

                const coincidencias = await tx.orm.public.Publicacion
                    .where({
                        especieId: datos.especieId,
                        variedadId: datos.variedadId,
                        envaseId: datos.envaseId,
                        kilosId: datos.kilosId,
                        categoriaId: datos.categoriaId,
                        calibreId: datos.calibreId,
                        tipoPublicacion: "PRODUCTOR",
                    })
                    .select("id")
                    .all();

                if (
                    coincidencias.some((publicacion) =>
                        ids.has(publicacion.id),
                    )
                ) {
                    return {
                        esValido: false,
                        errores: [
                            "Este Productor ya tiene una publicación con la misma especie, variedad, empaquetado, kilos, categoría, calibre y país.",
                        ],
                    };
                }

                const publicacion = await tx.orm.public.Publicacion.create({
                    ...(imagenCreada
                        ? { id: imagenCreada.publicacionId }
                        : {}),
                    tipoPublicacion: "PRODUCTOR",
                    publicacionDisponible: datos.disponibilidad,
                    precio,
                    foto: imagenCreada?.url ?? null,
                    cantidadUnidades: datos.cantidadUnidades ?? null,
                    comentario: datos.comentario ?? null,
                    especieId: datos.especieId,
                    variedadId: datos.variedadId,
                    envaseId: datos.envaseId,
                    kilosId: datos.kilosId,
                    categoriaId: datos.categoriaId,
                    calibreId: datos.calibreId,
                    fechaVigencia:
                        convertirFechaVigenciaAInstant(fechaVigencia),
                });

                const publicacionProductor =
                    await tx.orm.public.PublicacionProductor.create({
                        publicacionId: publicacion.id,
                        productorId: productor.id,
                        paisId: datos.paisId,
                    });

                if (datos.ubicaciones !== undefined) {
                    for (const ubicacion of datos.ubicaciones) {
                        await tx.orm.public.Ubicacion.create({
                            ...ubicacion,
                            publicacionId: publicacionProductor.id,
                        });
                    }
                } else if (
                    datos.latitud !== undefined &&
                    datos.latitud !== null &&
                    datos.longitud !== undefined &&
                    datos.longitud !== null
                ) {
                    await tx.orm.public.Ubicacion.create({
                        publicacionId: publicacionProductor.id,
                        nombreUbicacion:
                            datos.nombreLugar?.trim() ||
                            datos.departamento!.trim(),
                        urlMaps: `https://www.google.com/maps?q=${encodeURIComponent(
                            `${datos.latitud},${datos.longitud}`,
                        )}`,
                        departamento: datos.departamento,
                    });
                }

                const usuarioActual = await tx.orm.public.Usuario
                    .where({ id: productorActual.usuarioId })
                    .first();

                if (!usuarioActual) {
                    throw new Error(
                        "No se encontró el usuario asociado al productor.",
                    );
                }

                const relacionesActualizadas =
                    await tx.orm.public.PublicacionProductor
                        .where({ productorId: productor.id })
                        .all();

                const fechaStr = new Date().toISOString().slice(0, 10);
                const fecha = Temporal.Instant.from(
                    `${fechaStr}T00:00:00Z`,
                );

                const estadisticaExistente =
                    await tx.orm.public.EstadisticaCantidadPublicacion
                        .where({
                            fecha,
                            username: usuarioActual.username,
                        })
                        .first();

                if (estadisticaExistente) {
                    await tx.orm.public.EstadisticaCantidadPublicacion
                        .where({ id: estadisticaExistente.id })
                        .update({
                            cantidad: relacionesActualizadas.length,
                        });
                } else {
                    await tx.orm.public.EstadisticaCantidadPublicacion.create({
                        fecha,
                        username: usuarioActual.username,
                        cantidad: relacionesActualizadas.length,
                    });
                }

                return {
                    esValido: true,
                    id: publicacion.id,
                    mensaje: "Publicación creada correctamente.",
                };
            },
        );
    } catch (error) {
        if (imagenCreada) {
            await limpiarImagenPublicacionNoReferenciada(
                imagenCreada.url,
                imagenCreada.publicacionId,
            );
        }

        if (error instanceof ErrorImagenProductor) {
            return {
                esValido: false,
                errores: [error.message],
            };
        }

        throw error;
    }

    if (!resultado.esValido && imagenCreada) {
        await limpiarImagenPublicacionNoReferenciada(
            imagenCreada.url,
            imagenCreada.publicacionId,
        );
    }

    return resultado;
}