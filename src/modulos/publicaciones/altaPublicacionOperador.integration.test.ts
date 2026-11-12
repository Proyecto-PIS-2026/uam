import "temporal-polyfill/full/global";
import "temporal-polyfill/types/global";

import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { db } from "../../infraestructura/persistencia/prisma/db";
import { altaPublicacionOperador } from "./altaPublicacionOperador";

async function obtenerDatosDePublicacionSemilla() {
    const relaciones = await db.orm.public.PublicacionOperador.all();

    if (relaciones.length === 0) {
        throw new Error(
            "El test necesita una publicación de operador cargada por el seed.",
        );
    }

    const [publicaciones, variedades] = await Promise.all([
        db.orm.public.Publicacion.all(),
        db.orm.public.Variedad.all(),
    ]);

    for (const relacion of relaciones) {
        const publicacionSemilla = publicaciones.find(
            (publicacion) =>
                publicacion.id === relacion.publicacionId,
        );

        if (!publicacionSemilla) {
            continue;
        }

        if (publicacionSemilla.variedadId === null) {
            continue;
        }

        const variedadSemilla = variedades.find(
            (variedad) =>
                variedad.id === publicacionSemilla.variedadId,
        );

        if (!variedadSemilla) {
            continue;
        }

        const idsPublicacionesDelOperador = new Set(
            relaciones
                .filter(
                    (item) =>
                        item.operadorId === relacion.operadorId &&
                        item.paisId === relacion.paisId,
                )
                .map((item) => item.publicacionId),
        );

        const publicacionesDelOperador = publicaciones.filter(
            (publicacion) =>
                idsPublicacionesDelOperador.has(publicacion.id),
        );

        for (const candidata of publicaciones) {
            if (candidata.variedadId === null) {
                continue;
            }

            const variedad = variedades.find(
                (item) => item.id === candidata.variedadId,
            );

            if (!variedad) {
                continue;
            }

            const yaExiste = publicacionesDelOperador.some(
                (publicacion) =>
                    publicacion.especieId === variedad.especieId &&
                    publicacion.variedadId === variedad.id &&
                    publicacion.envaseId === candidata.envaseId &&
                    publicacion.kilosId === candidata.kilosId &&
                    publicacion.categoriaId === candidata.categoriaId &&
                    publicacion.calibreId === candidata.calibreId,
            );

            if (yaExiste) {
                continue;
            }

            return {
                relacion,
                publicacion: publicacionSemilla,
                variedad: variedadSemilla,
                datos: {
                    operadorId: relacion.operadorId,
                    especieId: variedad.especieId,
                    variedadId: variedad.id,
                    envaseId: candidata.envaseId,
                    kilosId: candidata.kilosId,
                    categoriaId: candidata.categoriaId,
                    calibreId: candidata.calibreId,
                    paisId: relacion.paisId,
                    disponibilidad: true,
                    precio: "999",
                    cantidadUnidades: 5,
                },
            };
        }
    }

    throw new Error(
        "El test no encontró una combinación disponible en el seed.",
    );
}

async function obtenerUsuarioOperador(operadorId: number) {
    const operador = await db.orm.public.Operador
        .where({ id: operadorId })
        .first();

    if (!operador) {
        throw new Error("El operador del test no existe.");
    }

    const usuario = await db.orm.public.Usuario
        .where({ id: operador.usuarioId })
        .first();

    if (!usuario) {
        throw new Error("El usuario del operador no existe.");
    }

    return usuario;
}

function obtenerFechaSnapshotActual(): Temporal.Instant {
    const fechaStr = Temporal.Now
        .plainDateISO("America/Montevideo")
        .toString();

    return Temporal.Instant.from(`${fechaStr}T00:00:00Z`);
}

async function obtenerEstadisticaActual(
    username: string,
    fecha: Temporal.Instant,
) {
    return db.orm.public.EstadisticaCantidadPublicacion
        .where({ username, fecha })
        .first();
}

async function restaurarEstadisticaAnterior(
    username: string,
    fecha: Temporal.Instant,
    estadisticaAnterior: Awaited<
        ReturnType<typeof obtenerEstadisticaActual>
    >,
) {
    const estadisticaActual = await obtenerEstadisticaActual(
        username,
        fecha,
    );

    if (estadisticaAnterior) {
        if (estadisticaActual) {
            await db.orm.public.EstadisticaCantidadPublicacion
                .where({ id: estadisticaActual.id })
                .update({
                    cantidad: estadisticaAnterior.cantidad,
                });
        } else {
            await db.orm.public.EstadisticaCantidadPublicacion.create({
                fecha,
                username,
                cantidad: estadisticaAnterior.cantidad,
            });
        }

        return;
    }

    if (estadisticaActual) {
        await db.orm.public.EstadisticaCantidadPublicacion
            .where({ id: estadisticaActual.id })
            .delete();
    }
}

describe.sequential(
    "alta de publicación de operador",
    { timeout: 15000 },
    () => {
        it("devuelve los errores del validador cuando los datos son inválidos", async () => {
            const resultado = await altaPublicacionOperador(null);

            expect(resultado).toEqual({
                esValido: false,
                errores: [
                    "Los datos de la publicación no son válidos.",
                ],
            });
        });

        it.each([undefined, ""])("aplica la vigencia general al omitir o vaciar la fecha: %s", async (fechaVigencia) => {
            const [habilitada, dias] = await Promise.all([
                db.orm.public.Configuracion.where({ nombreConfiguracion: "vigencia_publicaciones_operador_habilitada" }).first(),
                db.orm.public.Configuracion.where({ nombreConfiguracion: "vigencia_publicaciones_operador" }).first(),
            ]);
            if (!habilitada || !dias) throw new Error("Falta la configuración de vigencia de operadores en la base de pruebas.");
            const { datos } = await obtenerDatosDePublicacionSemilla();
            const usuario = await obtenerUsuarioOperador(datos.operadorId);
            const fecha = obtenerFechaSnapshotActual();
            const estadisticaAnterior = await obtenerEstadisticaActual(usuario.username, fecha);
            let id: number | undefined;

            try {
                await db.orm.public.Configuracion.where({ nombreConfiguracion: dias.nombreConfiguracion })
                    .update({ valorConfiguracion: "7" });
                await db.orm.public.Configuracion.where({ nombreConfiguracion: habilitada.nombreConfiguracion })
                    .update({ valorConfiguracion: "true" });
                const fechaMaxima = Temporal.Now.plainDateISO("America/Montevideo").add({ days: 7 });

                const resultado = await altaPublicacionOperador({ ...datos, fechaVigencia });
                expect(resultado.esValido).toBe(true);
                if (!resultado.esValido) return;
                id = resultado.id;
                const publicacion = await db.orm.public.Publicacion.where({ id }).first();
                const fechaGuardada = publicacion?.fechaVigencia?.toZonedDateTimeISO("America/Montevideo");
                expect(fechaGuardada?.toPlainDate().toString()).toBe(fechaMaxima.toString());
                expect(fechaGuardada?.toPlainTime().toString()).toBe("23:59:59");

                const fueraDelLimite = await altaPublicacionOperador({
                    ...datos, fechaVigencia: fechaMaxima.add({ days: 1 }).toString(),
                });
                expect(fueraDelLimite).toEqual({
                    esValido: false,
                    errores: [`La fecha de vigencia no puede superar el ${fechaMaxima}.`],
                });
            } finally {
                try {
                    if (id !== undefined) await db.orm.public.Publicacion.where({ id }).delete();
                    await restaurarEstadisticaAnterior(usuario.username, fecha, estadisticaAnterior);
                } finally {
                    await db.orm.public.Configuracion.where({ nombreConfiguracion: dias.nombreConfiguracion })
                        .update({ valorConfiguracion: dias.valorConfiguracion });
                    await db.orm.public.Configuracion.where({ nombreConfiguracion: habilitada.nombreConfiguracion })
                        .update({ valorConfiguracion: habilitada.valorConfiguracion });
                }
            }
        });

        it("rechaza catálogos inactivos", async () => {
            const { datos, variedad } =
                await obtenerDatosDePublicacionSemilla();

            const inactiva = await db.orm.public.Variedad.create({
                especieId: variedad.especieId,
                nombreVariedad: `Inactiva ${randomUUID()}`,
                variedadActiva: false,
            });

            try {
                const resultado = await altaPublicacionOperador({
                    ...datos,
                    variedadId: inactiva.id,
                });

                expect(resultado.esValido).toBe(false);

                if (resultado.esValido === false) {
                    const tieneErrorDeCatalogo = resultado.errores.some(
                        (err) =>
                            err.includes("ya no están disponibles") ||
                            err.includes("inactiv") ||
                            err.includes("operador ya tiene"),
                    );

                    expect(tieneErrorDeCatalogo).toBe(true);
                }
            } finally {
                await db.orm.public.Variedad
                    .where({ id: inactiva.id })
                    .delete();
            }
        });

        it("crea una publicación válida y registra la cantidad total del operador", async () => {
            const { datos } = await obtenerDatosDePublicacionSemilla();
            const operadorId = datos.operadorId;

            const usuario = await obtenerUsuarioOperador(operadorId);
            const fecha = obtenerFechaSnapshotActual();

            const relacionesAntes = await db.orm.public.PublicacionOperador
                .where({ operadorId })
                .all();

            const estadisticaAnterior = await obtenerEstadisticaActual(
                usuario.username,
                fecha,
            );

            let id: number | undefined;

            try {
                const resultado = await altaPublicacionOperador(datos);

                expect(resultado.esValido).toBe(true);

                if (!resultado.esValido) return;

                id = resultado.id;

                expect(resultado.mensaje).toBe(
                    "Publicación creada correctamente.",
                );

                const publicacionCreada = await db.orm.public.Publicacion
                    .where({ id })
                    .first();

                expect(publicacionCreada).not.toBeNull();
                expect(Number(publicacionCreada?.cantidadUnidades)).toBe(5);

                expect(publicacionCreada?.envaseId).toBe(datos.envaseId);
                expect(publicacionCreada?.kilosId).toBe(datos.kilosId);

                const relacionCreada = await db.orm.public.PublicacionOperador
                    .where({ publicacionId: id })
                    .first();

                expect(relacionCreada).not.toBeNull();
                expect(relacionCreada?.operadorId).toBe(operadorId);

                const relacionesDespues = await db.orm.public.PublicacionOperador
                    .where({ operadorId })
                    .all();

                expect(relacionesDespues).toHaveLength(
                    relacionesAntes.length + 1,
                );

                const estadisticaActual = await obtenerEstadisticaActual(
                    usuario.username,
                    fecha,
                );

                expect(estadisticaActual).not.toBeNull();

                expect(Number(estadisticaActual?.cantidad)).toBe(
                    relacionesDespues.length,
                );

                if (estadisticaAnterior) {
                    expect(estadisticaActual?.id).toBe(
                        estadisticaAnterior.id,
                    );
                }

                const estadisticasDelDia = await db.orm.public.EstadisticaCantidadPublicacion
                    .where({
                        username: usuario.username,
                        fecha,
                    })
                    .all();

                expect(estadisticasDelDia).toHaveLength(1);
            } finally {
                try {
                    if (id !== undefined) {
                        await db.orm.public.Publicacion
                            .where({ id })
                            .delete();
                    }
                } finally {
                    await restaurarEstadisticaAnterior(
                        usuario.username,
                        fecha,
                        estadisticaAnterior,
                    );
                }
            }
        });

        it("actualiza el registro existente cuando se realiza otra alta durante el mismo día", async () => {
            const { datos } = await obtenerDatosDePublicacionSemilla();
            const operadorId = datos.operadorId;

            const usuario = await obtenerUsuarioOperador(operadorId);
            const fecha = obtenerFechaSnapshotActual();

            const relacionesAntes = await db.orm.public.PublicacionOperador
                .where({ operadorId })
                .all();

            const estadisticaAnterior = await obtenerEstadisticaActual(
                usuario.username,
                fecha,
            );

            let id: number | undefined;

            try {
                // Si todavía no existe un registro del día, creamos uno
                // para simular una actualización de una estadística existente.
                if (!estadisticaAnterior) {
                    await db.orm.public.EstadisticaCantidadPublicacion.create({
                        fecha,
                        username: usuario.username,
                        cantidad: relacionesAntes.length,
                    });
                }

                const estadisticaPrevia = await obtenerEstadisticaActual(
                    usuario.username,
                    fecha,
                );

                expect(estadisticaPrevia).not.toBeNull();

                const resultado = await altaPublicacionOperador(datos);

                expect(resultado.esValido).toBe(true);

                if (!resultado.esValido) return;

                id = resultado.id;

                const relacionesDespues = await db.orm.public.PublicacionOperador
                    .where({ operadorId })
                    .all();

                const estadisticaActual = await obtenerEstadisticaActual(
                    usuario.username,
                    fecha,
                );

                expect(estadisticaActual).not.toBeNull();

                expect(estadisticaActual?.id).toBe(
                    estadisticaPrevia?.id,
                );

                expect(Number(estadisticaActual?.cantidad)).toBe(
                    relacionesDespues.length,
                );

                expect(Number(estadisticaActual?.cantidad)).toBe(
                    relacionesAntes.length + 1,
                );

                const estadisticasDelDia = await db.orm.public.EstadisticaCantidadPublicacion
                    .where({
                        username: usuario.username,
                        fecha,
                    })
                    .all();

                expect(estadisticasDelDia).toHaveLength(1);
            } finally {
                try {
                    if (id !== undefined) {
                        await db.orm.public.Publicacion
                            .where({ id })
                            .delete();
                    }
                } finally {
                    await restaurarEstadisticaAnterior(
                        usuario.username,
                        fecha,
                        estadisticaAnterior,
                    );
                }
            }
        });

        it("rechaza una publicación duplicada sin crear otro registro ni modificar la estadística", async () => {
            const { relacion, publicacion, variedad } =
                await obtenerDatosDePublicacionSemilla();

            const operadorId = relacion.operadorId;
            const usuario = await obtenerUsuarioOperador(operadorId);
            const fecha = obtenerFechaSnapshotActual();

            const publicacionesAntes = await db.orm.public.PublicacionOperador
                .where({ operadorId })
                .all();

            const registrosAntes = await db.orm.public.Publicacion.all();

            const estadisticasAntes = await db.orm.public.EstadisticaCantidadPublicacion
                .where({
                    username: usuario.username,
                    fecha,
                })
                .all();

            const resultado = await altaPublicacionOperador({
                operadorId,
                especieId: variedad.especieId,
                variedadId: variedad.id,
                envaseId: publicacion.envaseId,
                kilosId: publicacion.kilosId,
                categoriaId: publicacion.categoriaId,
                calibreId: publicacion.calibreId,
                paisId: relacion.paisId,
                disponibilidad: !publicacion.publicacionDisponible,
                precio: "999",
                cantidadUnidades: 5,
            });

            const publicacionesDespues = await db.orm.public.PublicacionOperador
                .where({ operadorId })
                .all();

            const registrosDespues = await db.orm.public.Publicacion.all();

            const estadisticasDespues = await db.orm.public.EstadisticaCantidadPublicacion
                .where({
                    username: usuario.username,
                    fecha,
                })
                .all();

            expect(resultado).toEqual({
                esValido: false,
                errores: [
                    "Este operador ya tiene una publicación con la misma especie, variedad, empaquetado, kilos, categoría, calibre y país.",
                ],
            });

            expect(publicacionesDespues).toHaveLength(
                publicacionesAntes.length,
            );

            expect(registrosDespues).toHaveLength(
                registrosAntes.length,
            );

            expect(
                estadisticasDespues.map((item) => ({
                    id: item.id,
                    cantidad: item.cantidad,
                })),
            ).toEqual(
                estadisticasAntes.map((item) => ({
                    id: item.id,
                    cantidad: item.cantidad,
                })),
            );
        });
    },
);
