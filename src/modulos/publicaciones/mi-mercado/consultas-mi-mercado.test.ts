import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    actualizarPrecioPublicacion,
    ConflictoPublicacionError,
    incrementarPrecioPublicacion,
    obtenerPublicacionesDeOperador,
} from "./consultas-mi-mercado";
import { mapearPublicacionesMiMercado } from "./mapear-publicaciones";

const configuracion = vi.hoisted(() => ({
    habilitado: false,
    diasVigencia: 30,
    avisosHabilitados: true,
    diasAnticipacionAviso: 3,
}));

vi.mock("../configuracion-aging-fotos", () => ({
    obtenerConfiguracionAgingFotos: async () => configuracion,
}));

const mocks = vi.hoisted(() => {
    const consulta = () => {
        const builder = {
            where: vi.fn(),
            include: vi.fn(),
            select: vi.fn(),
            all: vi.fn(),
            first: vi.fn(),
            update: vi.fn(),
            create: vi.fn(),
        };

        builder.where.mockReturnValue(builder);
        builder.select.mockReturnValue(builder);
        builder.include.mockImplementation((_nombre, callback) => {
            callback?.(builder);
            return builder;
        });

        return builder;
    };

    return {
        relacion: consulta(),
        publicacion: consulta(),
        imagen: consulta(),
        operador: consulta(),
        usuario: consulta(),
        estadistica: consulta(),
        transaction: vi.fn(),
        execute: vi.fn(),
        notificar: vi.fn(),
    };
});

vi.mock("../../../infraestructura/persistencia/prisma/db", () => ({
    db: {
        orm: {
            public: {
                PublicacionOperador: mocks.relacion,
                Publicacion: mocks.publicacion,
                Imagen: mocks.imagen,
                Operador: mocks.operador,
                Usuario: mocks.usuario,
                EstadisticaPublicacion: mocks.estadistica,
            },
        },
        transaction: mocks.transaction,
        raw: {
            sql: () => ({
                returnsRow: () => ({
                    build: () => ({}),
                }),
            }),
        },
    },
}));

vi.mock("@/infraestructura/tiempo-real/publicaciones", () => ({
    notificarCambioPublicacion: mocks.notificar,
}));

describe("precios de Mi Mercado", () => {
    let fila: {
        id: number;
        precio: string | null;
        version: number;
        fecha: string;
    };

    let estadistica: {
        id: number;
        fecha: Date;
        username: string;
        cantidad: number;
    } | null;

    beforeEach(() => {
        vi.clearAllMocks();

        Object.assign(configuracion, {
            habilitado: false,
            diasVigencia: 30,
            avisosHabilitados: true,
            diasAnticipacionAviso: 3,
        });

        fila = {
            id: 20,
            precio: "100.00",
            version: 1,
            fecha: "2026-10-10T16:30:00Z",
        };

        estadistica = null;

        let turno = Promise.resolve();

        mocks.transaction.mockImplementation((callback) => {
            const resultado = turno.then(() =>
                callback({
                    orm: {
                        public: {
                            PublicacionOperador: mocks.relacion,
                            Publicacion: mocks.publicacion,
                            Imagen: mocks.imagen,
                            Operador: mocks.operador,
                            Usuario: mocks.usuario,
                            EstadisticaPublicacion: mocks.estadistica,
                        },
                    },
                    execute: mocks.execute,
                }),
            );

            turno = resultado.then(
                () => {},
                () => {},
            );

            return resultado;
        });

        mocks.relacion.all.mockResolvedValue([
            {
                id: 1,
                publicacionId: 20,
                publicacion: {
                    ...fila,
                    foto: null,
                },
            },
        ]);

        mocks.imagen.all.mockResolvedValue([]);

        mocks.publicacion.first.mockImplementation(async () => ({
            ...fila,
        }));

        mocks.publicacion.update.mockImplementation(async (cambios) => {
            fila = {
                ...fila,
                ...cambios,
            };

            return { ...fila };
        });

        mocks.operador.first.mockResolvedValue({
            usuarioId: 30,
        });

        mocks.usuario.first.mockResolvedValue({
            username: "operador1",
        });

        mocks.estadistica.first.mockImplementation(async () =>
            estadistica ? { ...estadistica } : null,
        );

        mocks.estadistica.create.mockImplementation(async (datos) => {
            estadistica = {
                id: 1,
                ...datos,
            };

            return { ...estadistica };
        });

        mocks.estadistica.update.mockImplementation(async (cambios) => {
            if (!estadistica) return null;

            estadistica = {
                ...estadistica,
                ...cambios,
            };

            return { ...estadistica };
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("consulta solamente las publicaciones del operador", async () => {
        expect(await obtenerPublicacionesDeOperador(10)).toEqual([
            {
                id: 1,
                publicacionId: 20,
                publicacion: {
                    ...fila,
                    foto: null,
                    estadoFoto: null,
                },
            },
        ]);

        expect(mocks.relacion.where).toHaveBeenCalledWith({
            operadorId: 10,
        });
    });

    it("conserva el estado de eliminación para el dueño sin serializar la marca interna de la base", async () => {
        mocks.relacion.all.mockResolvedValue([
            {
                id: 1,
                publicacionId: 20,
                paisId: null,
                publicacion: {
                    ...fila,
                    foto: null,
                    fotoEliminadaPorVencimientoEn: "2026-11-04T03:00:00Z",
                    publicacionActiva: true,
                    publicacionDisponible: true,
                    cantidadUnidades: null,
                    especie: {
                        id: 3,
                        nombreEspecie: "Papa",
                        fotoEspecie: null,
                    },
                    variedad: null,
                    envase: null,
                    kilos: null,
                    categoria: null,
                    calibre: null,
                },
            },
        ]);

        const [publicacion] = mapearPublicacionesMiMercado(
            await obtenerPublicacionesDeOperador(10),
        );

        expect(publicacion).toMatchObject({
            id: 20,
            publicacionOperadorId: 1,
            foto: null,
            estadoFoto: "eliminada",
        });

        expect(publicacion).not.toHaveProperty(
            "fotoEliminadaPorVencimientoEn",
        );
    });

    it("mantiene visible la foto con aviso amarillo hasta que la tarea la borre, sin perder precios ni versiones", async () => {
        configuracion.habilitado = true;

        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-11-02T12:00:00Z"));

        const archivo =
            "12345678-1234-4234-8234-123456789abc.webp";

        const relaciones = [
            {
                id: 1,
                publicacionId: 20,
                publicacion: {
                    ...fila,
                    foto: `/api/publicaciones/imagenes/20/${archivo}`,
                },
            },
            {
                id: 2,
                publicacionId: 21,
                publicacion: {
                    ...fila,
                    id: 21,
                    foto: `/api/publicaciones/imagenes/21/${archivo}`,
                },
            },
        ];

        mocks.relacion.all.mockResolvedValue(relaciones);

        mocks.imagen.all.mockResolvedValue([
            {
                clave: `publicaciones/20/${archivo}`,
                cargadaEn: "2026-09-01T12:00:00Z",
            },
            {
                clave: `publicaciones/21/${archivo}`,
                cargadaEn: "2026-11-01T12:00:00Z",
            },
        ]);

        expect(await obtenerPublicacionesDeOperador(10)).toEqual([
            {
                ...relaciones[0],
                publicacion: {
                    ...relaciones[0].publicacion,
                    estadoFoto: "por-vencer",
                },
            },
            {
                ...relaciones[1],
                publicacion: {
                    ...relaciones[1].publicacion,
                    estadoFoto: null,
                },
            },
        ]);

        expect(relaciones[0].publicacion.foto).toBe(
            `/api/publicaciones/imagenes/20/${archivo}`,
        );
    });

    it("guarda el precio con la revisión esperada, registra la estadística y notifica", async () => {
        expect(
            await actualizarPrecioPublicacion(10, 20, 125, 1),
        ).toEqual({
            precio: 125,
            version: 2,
            fecha: fila.fecha,
        });

        expect(mocks.publicacion.where).toHaveBeenCalledWith({
            id: 20,
            version: 1,
        });

        expect(mocks.estadistica.create).toHaveBeenCalledWith(
            expect.objectContaining({
                username: "operador1",
                cantidad: 1,
            }),
        );

        expect(mocks.notificar).toHaveBeenCalledWith(
            expect.anything(),
            {
                operadorId: 10,
                publicacionId: 20,
            },
        );

        expect(
            mocks.notificar.mock.invocationCallOrder[0],
        ).toBeGreaterThan(
            mocks.publicacion.update.mock.invocationCallOrder[0],
        );
    });

    it.each([
        ["2026-11-13T00:00:00Z", "2026-11-12"],
        ["2026-11-13T02:59:59Z", "2026-11-12"],
        ["2026-11-13T03:00:00Z", "2026-11-13"],
        ["2026-11-13T15:00:00Z", "2026-11-13"],
    ])("registra la edición y el ajuste de precio a las %s en el día uruguayo %s", async (instante, dia) => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(instante));

        await actualizarPrecioPublicacion(10, 20, 125, 1);
        await incrementarPrecioPublicacion(10, 20, 10);

        const consultasPorDia = mocks.estadistica.where.mock.calls
            .map(([filtro]) => filtro)
            .filter((filtro) => filtro.fecha !== undefined);
        expect(consultasPorDia).toHaveLength(2);
        for (const filtro of consultasPorDia) {
            expect(filtro.fecha.toString()).toBe(`${dia}T00:00:00Z`);
            expect(filtro.username).toBe("operador1");
        }
        expect(mocks.estadistica.create.mock.calls[0][0].fecha.toString()).toBe(`${dia}T00:00:00Z`);
        expect(mocks.estadistica.update).toHaveBeenCalledWith({ cantidad: 2 });
    });

    it("incrementa la estadística existente al modificar el precio", async () => {
        estadistica = {
            id: 5,
            fecha: new Date("2026-11-04T00:00:00Z"),
            username: "operador1",
            cantidad: 3,
        };

        await actualizarPrecioPublicacion(10, 20, 125, 1);

        expect(mocks.estadistica.update).toHaveBeenCalledWith({
            cantidad: 4,
        });

        expect(mocks.estadistica.create).not.toHaveBeenCalled();
    });

    it("registra la estadística al incrementar rápidamente el precio", async () => {
        expect(
            await incrementarPrecioPublicacion(10, 20, 10),
        ).toMatchObject({
            precio: 110,
            version: 2,
        });

        expect(mocks.estadistica.create).toHaveBeenCalledWith(
            expect.objectContaining({
                username: "operador1",
                cantidad: 1,
            }),
        );
    });

    it("guarda y devuelve null al quitar el precio, conservando revisión y notificación", async () => {
        expect(
            await actualizarPrecioPublicacion(10, 20, null, 1),
        ).toEqual({
            precio: null,
            version: 2,
            fecha: fila.fecha,
        });

        expect(fila).toMatchObject({
            precio: null,
            version: 2,
        });

        expect(mocks.notificar).toHaveBeenCalledWith(
            expect.anything(),
            {
                operadorId: 10,
                publicacionId: 20,
            },
        );

        await expect(
            actualizarPrecioPublicacion(10, 20, 125, 1),
        ).rejects.toMatchObject({
            actual: {
                precio: null,
                version: 2,
            },
        });

        expect(fila.precio).toBeNull();
    });

    it("incrementa desde un precio ausente sin persistir cero", async () => {
        fila.precio = null;

        expect(
            await incrementarPrecioPublicacion(10, 20, 10),
        ).toMatchObject({
            precio: 10,
            version: 2,
        });

        expect(fila.precio).toBe("10.00");
    });

    it("rechaza la segunda edición de la misma revisión sin sobrescribir", async () => {
        const resultados = await Promise.allSettled([
            actualizarPrecioPublicacion(10, 20, 125, 1),
            actualizarPrecioPublicacion(10, 20, 200, 1),
        ]);

        expect(resultados[0].status).toBe("fulfilled");

        expect(resultados[1]).toMatchObject({
            status: "rejected",
            reason: expect.any(ConflictoPublicacionError),
        });

        expect(fila.precio).toBe("125.00");
        expect(mocks.publicacion.update).toHaveBeenCalledOnce();
    });

    it("acumula dos incrementos concurrentes sobre el último precio guardado", async () => {
        await Promise.all([
            incrementarPrecioPublicacion(10, 20, 10),
            incrementarPrecioPublicacion(10, 20, 10),
        ]);

        expect(fila).toMatchObject({
            precio: "120.00",
            version: 3,
        });
    });

    it("rechaza ediciones sin revisión", async () => {
        await expect(
            actualizarPrecioPublicacion(10, 20, 125),
        ).rejects.toBeInstanceOf(ConflictoPublicacionError);

        expect(mocks.publicacion.update).not.toHaveBeenCalled();
    });

    it("rechaza publicaciones ajenas y no emite eventos", async () => {
        mocks.relacion.all.mockResolvedValue([]);

        await expect(
            incrementarPrecioPublicacion(10, 20, 10),
        ).rejects.toThrow("no pertenece");

        expect(mocks.publicacion.first).not.toHaveBeenCalled();
        expect(mocks.notificar).not.toHaveBeenCalled();
        expect(mocks.estadistica.create).not.toHaveBeenCalled();
    });

    it.each([0, -1, 125.5, 10_000_000_000, Number.NaN])(
        "rechaza precio inválido %s antes de consultar",
        async (precio) => {
            await expect(
                actualizarPrecioPublicacion(10, 20, precio, 1),
            ).rejects.toThrow();

            expect(mocks.transaction).not.toHaveBeenCalled();
        },
    );

    it.each([-100, -110])(
        "quita el precio cuando el decremento %s llega a cero o lo supera",
        async (incremento) => {
            expect(
                await incrementarPrecioPublicacion(
                    10,
                    20,
                    incremento,
                ),
            ).toEqual({
                precio: null,
                version: 2,
                fecha: fila.fecha,
            });

            expect(fila).toMatchObject({
                precio: null,
                version: 2,
            });

            expect(mocks.notificar).toHaveBeenCalledWith(
                expect.anything(),
                {
                    operadorId: 10,
                    publicacionId: 20,
                },
            );
        },
    );

    it("mantiene sin precio al decrementar una publicación que ya no tiene precio", async () => {
        fila.precio = null;

        expect(
            await incrementarPrecioPublicacion(10, 20, -10),
        ).toMatchObject({
            precio: null,
            version: 2,
        });

        expect(fila.precio).toBeNull();
    });

    it("suma desde sin precio después de un decremento que supera el precio anterior", async () => {
        fila.precio = "5.00";

        const resultados = await Promise.all([
            incrementarPrecioPublicacion(10, 20, -10),
            incrementarPrecioPublicacion(10, 20, 10),
        ]);

        expect(
            resultados.map(({ precio }) => precio),
        ).toEqual([null, 10]);

        expect(fila).toMatchObject({
            precio: "10.00",
            version: 3,
        });
    });

    it("rechaza incrementos cuyo resultado excede el precio máximo", async () => {
        fila.precio = "9999999999.00";

        await expect(
            incrementarPrecioPublicacion(10, 20, 1),
        ).rejects.toThrow("máximo");

        expect(mocks.publicacion.update).not.toHaveBeenCalled();
        expect(mocks.notificar).not.toHaveBeenCalled();
        expect(mocks.estadistica.create).not.toHaveBeenCalled();
    });

    it("no registra la estadística si falla la actualización del precio", async () => {
        mocks.publicacion.update.mockRejectedValue(
            new Error("Error al actualizar el precio"),
        );

        await expect(
            incrementarPrecioPublicacion(10, 20, 10),
        ).rejects.toThrow("Error al actualizar el precio");

        expect(mocks.estadistica.first).not.toHaveBeenCalled();
        expect(mocks.estadistica.create).not.toHaveBeenCalled();
    });

    it("propaga los errores al registrar la estadística", async () => {
        mocks.estadistica.create.mockRejectedValue(
            new Error("Error al registrar estadística"),
        );

        await expect(
            incrementarPrecioPublicacion(10, 20, 10),
        ).rejects.toThrow("Error al registrar estadística");
    });
});
