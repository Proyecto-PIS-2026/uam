
import "temporal-polyfill/full/global";
import "temporal-polyfill/types/global";

import { describe, expect, it, vi } from "vitest";
import { db } from "../../infraestructura/persistencia/prisma/db";
import { altaPublicacionOperador } from "./altaPublicacionOperador";

async function obtenerDatosDePublicacionSemilla() {
    const relaciones = await db.orm.public.PublicacionOperador.all();

    if (relaciones.length === 0) {
        throw new Error(
            "El test necesita una publicación de operador cargada por el seed.",
        );
    }

    const publicaciones = await db.orm.public.Publicacion.all();
    const presentaciones = await db.orm.public.Presentacion.all();
    const variedades = await db.orm.public.Variedad.all();

    for (const relacion of relaciones) {
        const publicacionesDelOperador = publicaciones.filter(
            (publicacion) =>
                relaciones.some(
                    (item) =>
                        item.operadorId === relacion.operadorId &&
                        item.publicacionId === publicacion.id,
                ),
        );

        for (const candidata of publicaciones) {
            const presentacion = presentaciones.find(
                (item) => item.id === candidata.presentacionId,
            );

            const variedad = presentacion &&
                variedades.find(
                    (item) => item.id === presentacion.variedadId,
                );

            if (
                !presentacion ||
                !variedad ||
                publicacionesDelOperador.some(
                    (publicacion) =>
                        publicacion.presentacionId === candidata.presentacionId &&
                        publicacion.categoriaId === candidata.categoriaId &&
                        publicacion.calibreId === candidata.calibreId,
                )
            ) {
                continue;
            }

            return {
                operadorId: relacion.operadorId,
                especieId: variedad.especieId,
                variedadId: variedad.id,
                presentacionId: presentacion.id,
                categoriaId: candidata.categoriaId,
                calibreId: candidata.calibreId,
                paisId: relacion.paisId,
                disponibilidad: true,
                precio: "999",
                cantidadUnidades: 5,
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
    const fechaStr = new Date().toISOString().slice(0, 10);

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

        it("rechaza catálogos inactivos", async () => {
            const relaciones = await db.orm.public.PublicacionOperador.all();
            const [relacion] = relaciones;

            if (!relacion) {
                throw new Error(
                    "El test necesita una publicación de operador cargada por el seed.",
                );
            }

            const publicacion = await db.orm.public.Publicacion
                .where({ id: relacion.publicacionId })
                .first();

            if (!publicacion) {
                throw new Error("La publicación del seed no existe.");
            }

            const presentacion = await db.orm.public.Presentacion
                .where({ id: publicacion.presentacionId })
                .first();

            if (!presentacion) {
                throw new Error("La presentación del seed no existe.");
            }

            const variedad = await db.orm.public.Variedad
                .where({ id: presentacion.variedadId })
                .first();

            if (!variedad) {
                throw new Error("La variedad del seed no existe.");
            }

            const espiaVariedad = vi
                .spyOn(db.orm.public.Variedad, "first")
                .mockResolvedValue({
                    ...variedad,
                    variedadActiva: false,
                });

            try {
                const resultado = await altaPublicacionOperador({
                    operadorId: relacion.operadorId,
                    especieId: variedad.especieId,
                    variedadId: variedad.id,
                    presentacionId: presentacion.id,
                    categoriaId: publicacion.categoriaId,
                    calibreId: publicacion.calibreId,
                    paisId: relacion.paisId,
                    disponibilidad: true,
                    precio: "999",
                    cantidadUnidades: 99999,
                });

                expect(resultado.esValido).toBe(false);

                if (!resultado.esValido) {
                    const tieneErrorDeCatalogo = resultado.errores.some(
                        (err: string) =>
                            err.includes("ya no están disponibles") ||
                            err.includes("inactiv") ||
                            err.includes("operador ya tiene"),
                    );

                    expect(tieneErrorDeCatalogo).toBe(true);
                }
            } finally {
                espiaVariedad.mockRestore();
            }
        });

        it("crea una publicación válida y registra la cantidad total del operador", async () => {
            const datos = await obtenerDatosDePublicacionSemilla();
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

                const relacionCreada = await db.orm.public.PublicacionOperador
                    .where({ publicacionId: id })
                    .first();

                expect(relacionCreada).not.toBeNull();

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
            const datos = await obtenerDatosDePublicacionSemilla();
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
                // para simular un cambio anterior del mismo usuario.
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
            const relaciones = await db.orm.public.PublicacionOperador.all();

            const [relacion] = relaciones;

            if (!relacion) {
                throw new Error(
                    "El test necesita una publicación de operador cargada por el seed.",
                );
            }

            const publicacion = await db.orm.public.Publicacion
                .where({ id: relacion.publicacionId })
                .first();

            if (!publicacion) {
                throw new Error("La publicación del seed no existe.");
            }

            const presentacion = await db.orm.public.Presentacion
                .where({ id: publicacion.presentacionId })
                .first();

            if (!presentacion) {
                throw new Error("La presentación del seed no existe.");
            }

            const variedad = await db.orm.public.Variedad
                .where({ id: presentacion.variedadId })
                .first();

            if (!variedad) {
                throw new Error("La variedad del seed no existe.");
            }

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
                presentacionId: presentacion.id,
                categoriaId: publicacion.categoriaId,
                calibreId: publicacion.calibreId,
                paisId: relacion.paisId,
                disponibilidad: !publicacion.publicacionDisponible,
                precio: "999",
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
                    "Este operador ya tiene una publicación con la misma especie, variedad, presentación, categoría, calibre y país.",
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
