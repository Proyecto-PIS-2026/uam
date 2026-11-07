import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { altaPublicacionOperador } from "./altaPublicacionOperador";
import { ErrorImagenPublicacion } from "./operadores/imagenes-publicacion";

const mocks = vi.hoisted(() => ({
    validar: vi.fn(),
    validarCatalogosSeleccion: vi.fn(),
    operador: vi.fn(),
    operadorActual: vi.fn(),
    usuarioActual: vi.fn(),
    relaciones: vi.fn(),
    coincidencias: vi.fn(),
    publicacionWhere: vi.fn(),
    crear: vi.fn(),
    crearRelacion: vi.fn(),
    crearEstadistica: vi.fn(),
    estadisticaExistente: vi.fn(),
    actualizarEstadistica: vi.fn(),
    guardar: vi.fn(),
    eliminar: vi.fn(),
    transaccion: vi.fn(),
    notificar: vi.fn(),
    bloquear: vi.fn(),
    reservar: vi.fn(),
}));

vi.mock("./validarAltaPublicacionOperador", () => ({
    validarAltaPublicacionOperador: mocks.validar,
}));

vi.mock("./seleccion-publicacion", () => ({
    validarCatalogosSeleccion: mocks.validarCatalogosSeleccion,
}));

vi.mock("./operadores/imagenes-publicacion", () => ({
    guardarImagenPublicacion: mocks.guardar,
    eliminarImagenPublicacionGestionada: mocks.eliminar,
    ErrorImagenPublicacion: class extends Error {},
}));

vi.mock("@/infraestructura/tiempo-real/publicaciones", () => ({
    notificarCambioPublicacion: mocks.notificar,
}));

vi.mock("./operadores/limpiar-imagen-publicacion", () => ({
    limpiarImagenPublicacionNoReferenciada: mocks.eliminar,
}));

vi.mock("../../infraestructura/persistencia/prisma/db", () => {
    const entidad = (first: ReturnType<typeof vi.fn>) => ({
        where: vi.fn(() => ({ first })),
    });

    const tx = {
        execute: mocks.bloquear,
        orm: {
            public: {
                Operador: entidad(mocks.operadorActual),

                Usuario: entidad(mocks.usuarioActual),

                PublicacionOperador: {
                    where: vi.fn(() => ({
                        all: mocks.relaciones,
                    })),
                    create: mocks.crearRelacion,
                },

                Publicacion: {
                    create: mocks.crear,
                    where: mocks.publicacionWhere,
                },

                EstadisticaCantidadPublicacion: {
                    where: (filtro: { id?: number }) => {
                        if (filtro.id !== undefined) {
                            return {
                                update: mocks.actualizarEstadistica,
                            };
                        }

                        return {
                            first: mocks.estadisticaExistente,
                        };
                    },
                    create: mocks.crearEstadistica,
                },
            },
        },
    };

    return {
        db: {
            transaction: (callback: (tx: unknown) => Promise<unknown>) =>
                mocks.transaccion(() => callback(tx)),

            runtime: () => ({
                query: mocks.reservar,
            }),

            orm: {
                public: {
                    Operador: entidad(mocks.operador),
                },
            },

            raw: {
                sql: (partes: TemplateStringsArray, ...valores: unknown[]) => ({
                    returnsRow: () => ({
                        build: () => ({
                            texto: partes.join("?"),
                            valores,
                        }),
                    }),
                }),
            },
        },
    };
});

const DATOS = {
    operadorId: 1,
    especieId: 10,
    variedadId: 20,
    envaseId: 30,
    kilosId: null,
    categoriaId: 40,
    calibreId: 50,
    paisId: 60,
    disponibilidad: true,
    precio: "1500",
    cantidadUnidades: 5,
    comentario: null,
    fechaVigencia: "2026-11-20",
    fotografia: "data:image/png;base64,YWJj",
};

const URL =
    "/api/publicaciones/imagenes/777/12345678-1234-4234-8234-123456789abc.webp";

const USUARIO_OPERADOR = {
    id: 101,
    username: "operador1",
};

const RELACION_CREADA = {
    publicacionId: 777,
    operadorId: 1,
    paisId: 60,
};

beforeEach(() => {
    vi.clearAllMocks();

    mocks.validar.mockReturnValue({
        esValido: true,
        datos: DATOS,
    });

    mocks.validarCatalogosSeleccion.mockResolvedValue(true);

    mocks.operador.mockResolvedValue({
        id: 1,
        usuarioId: 101,
    });

    mocks.operadorActual.mockResolvedValue({
        id: 1,
        usuarioId: 101,
    });

    mocks.usuarioActual.mockResolvedValue(USUARIO_OPERADOR);

    mocks.relaciones
        .mockReset()
        .mockResolvedValueOnce([])
        .mockResolvedValue([RELACION_CREADA]);

    mocks.coincidencias.mockResolvedValue([]);

    mocks.publicacionWhere.mockImplementation(() => ({
        select: () => ({
            all: mocks.coincidencias,
        }),
    }));

    mocks.crear.mockResolvedValue({
        id: 777,
    });

    mocks.crearRelacion.mockResolvedValue({
        id: 888,
    });

    mocks.estadisticaExistente.mockResolvedValue(null);

    mocks.crearEstadistica.mockResolvedValue({
        id: 999,
    });

    mocks.actualizarEstadistica.mockResolvedValue(undefined);

    mocks.guardar.mockResolvedValue(URL);
    mocks.eliminar.mockResolvedValue(undefined);

    mocks.reservar.mockResolvedValue([
        { id: 777 },
    ]);

    mocks.bloquear.mockResolvedValue(undefined);
    mocks.notificar.mockResolvedValue(undefined);

    mocks.transaccion.mockImplementation((callback) => callback());
});

afterEach(() => vi.restoreAllMocks());

describe("altaPublicacionOperador", () => {
    it("devuelve los errores del validador sin consultar la base", async () => {
        mocks.validar.mockReturnValue({
            esValido: false,
            errores: ["Inválida"],
        });

        expect(await altaPublicacionOperador(null)).toEqual({
            esValido: false,
            errores: ["Inválida"],
        });

        expect(mocks.operador).not.toHaveBeenCalled();
        expect(mocks.validarCatalogosSeleccion).not.toHaveBeenCalled();
    });

    it("rechaza una selección de catálogos que ya no está disponible", async () => {
        mocks.validarCatalogosSeleccion.mockResolvedValue(false);

        expect(await altaPublicacionOperador(DATOS)).toEqual({
            esValido: false,
            errores: [
                "La selección contiene datos que ya no están disponibles. Actualizá el formulario.",
            ],
        });

        expect(mocks.guardar).not.toHaveBeenCalled();
        expect(mocks.reservar).not.toHaveBeenCalled();
        expect(mocks.transaccion).not.toHaveBeenCalled();
    });

    it("rechaza el alta si el operador no existe", async () => {
        mocks.operador.mockResolvedValue(null);

        expect(await altaPublicacionOperador(DATOS)).toEqual({
            esValido: false,
            errores: [
                "La selección contiene datos que ya no están disponibles. Actualizá el formulario.",
            ],
        });

        expect(mocks.validarCatalogosSeleccion).toHaveBeenCalled();
        expect(mocks.guardar).not.toHaveBeenCalled();
        expect(mocks.transaccion).not.toHaveBeenCalled();
    });

    it.each([undefined, null, "", "   "])(
        "persiste null cuando el precio es %j",
        async (precio) => {
            const datos = { ...DATOS, precio };

            mocks.validar.mockReturnValue({
                esValido: true,
                datos,
            });

            expect((await altaPublicacionOperador(datos)).esValido).toBe(true);

            expect(mocks.crear).toHaveBeenCalledWith(
                expect.objectContaining({
                    precio: null,
                }),
            );
        },
    );

    it("guarda el comentario del publicador", async () => {
        const datos = {
            ...DATOS,
            comentario: "Cosecha de esta semana",
        };

        mocks.validar.mockReturnValue({
            esValido: true,
            datos,
        });

        expect((await altaPublicacionOperador(datos)).esValido).toBe(true);

        expect(mocks.crear).toHaveBeenCalledWith(
            expect.objectContaining({
                comentario: "Cosecha de esta semana",
            }),
        );
    });

    it("guarda null cuando la publicación no tiene comentario", async () => {
        const datos = {
            ...DATOS,
            comentario: undefined,
        };

        mocks.validar.mockReturnValue({
            esValido: true,
            datos,
        });

        expect((await altaPublicacionOperador(datos)).esValido).toBe(true);

        expect(mocks.crear).toHaveBeenCalledWith(
            expect.objectContaining({
                comentario: null,
            }),
        );
    });

    it("convierte y guarda la fecha de vigencia", async () => {
        expect((await altaPublicacionOperador(DATOS)).esValido).toBe(true);

        const datosCreacion = mocks.crear.mock.calls[0][0];

        expect(datosCreacion.fechaVigencia).toBeDefined();
        expect(datosCreacion.fechaVigencia).not.toBeNull();
    });

    it("guarda null cuando la publicación no tiene fecha de vigencia", async () => {
        const datos = {
            ...DATOS,
            fechaVigencia: null,
        };

        mocks.validar.mockReturnValue({
            esValido: true,
            datos,
        });

        expect((await altaPublicacionOperador(datos)).esValido).toBe(true);

        expect(mocks.crear).toHaveBeenCalledWith(
            expect.objectContaining({
                fechaVigencia: null,
            }),
        );
    });

    it("rechaza guardar si los catálogos seleccionados no están disponibles", async () => {
        mocks.validarCatalogosSeleccion.mockResolvedValue(false);

        expect((await altaPublicacionOperador(DATOS)).esValido).toBe(false);

        expect(mocks.guardar).not.toHaveBeenCalled();
        expect(mocks.reservar).not.toHaveBeenCalled();
        expect(mocks.crear).not.toHaveBeenCalled();
    });

    it("guarda la fotografía mediante el servicio y persiste solamente su URL", async () => {
        expect(await altaPublicacionOperador(DATOS)).toEqual({
            esValido: true,
            id: 777,
            mensaje: "Publicación creada correctamente.",
        });

        expect(mocks.crear).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 777,
                foto: URL,
                precio: "1500",
                cantidadUnidades: 5,
                envaseId: 30,
                kilosId: null,
                comentario: null,
            }),
        );

        expect(mocks.crear).toHaveBeenCalledWith(
            expect.not.objectContaining({
                presentacionId: expect.anything(),
            }),
        );

        expect(mocks.guardar).toHaveBeenCalledWith(
            777,
            DATOS.fotografia,
        );

        expect(mocks.actualizarEstadistica).not.toHaveBeenCalled();
        expect(mocks.eliminar).not.toHaveBeenCalled();

        expect(mocks.notificar).toHaveBeenCalledWith(
            expect.anything(),
            {
                operadorId: 1,
                publicacionId: 777,
            },
        );
    });

    it("crea el registro estadístico cuando todavía no existe uno para el día", async () => {
        expect((await altaPublicacionOperador(DATOS)).esValido).toBe(true);

        expect(mocks.usuarioActual).toHaveBeenCalled();
        expect(mocks.estadisticaExistente).toHaveBeenCalled();

        expect(mocks.crearEstadistica).toHaveBeenCalledWith(
            expect.objectContaining({
                username: "operador1",
                cantidad: 1,
                fecha: expect.anything(),
            }),
        );

        expect(mocks.actualizarEstadistica).not.toHaveBeenCalled();
    });

    it("actualiza el registro estadístico existente para el mismo día", async () => {
        mocks.estadisticaExistente.mockResolvedValue({
            id: 456,
            username: "operador1",
            cantidad: 3,
        });

        mocks.relaciones
            .mockReset()
            .mockResolvedValueOnce([])
            .mockResolvedValue([
                { publicacionId: 101, operadorId: 1, paisId: 60 },
                { publicacionId: 202, operadorId: 1, paisId: 60 },
                { publicacionId: 303, operadorId: 1, paisId: 60 },
                RELACION_CREADA,
            ]);

        expect((await altaPublicacionOperador(DATOS)).esValido).toBe(true);

        expect(mocks.actualizarEstadistica).toHaveBeenCalledWith({
            cantidad: 4,
        });

        expect(mocks.crearEstadistica).not.toHaveBeenCalled();
    });

    it("calcula la cantidad incluyendo publicaciones no disponibles", async () => {
        const datos = {
            ...DATOS,
            disponibilidad: false,
        };

        mocks.validar.mockReturnValue({
            esValido: true,
            datos,
        });

        mocks.relaciones
            .mockReset()
            .mockResolvedValueOnce([])
            .mockResolvedValue([
                { publicacionId: 101, operadorId: 1, paisId: 60 },
                { publicacionId: 202, operadorId: 1, paisId: 60 },
                { publicacionId: 303, operadorId: 1, paisId: 60 },
                RELACION_CREADA,
            ]);

        expect((await altaPublicacionOperador(datos)).esValido).toBe(true);

        expect(mocks.crear).toHaveBeenCalledWith(
            expect.objectContaining({
                publicacionDisponible: false,
            }),
        );

        expect(mocks.crearEstadistica).toHaveBeenCalledWith(
            expect.objectContaining({
                username: "operador1",
                cantidad: 4,
            }),
        );
    });

    it("rechaza duplicados según especie, variedad, empaquetado, kilos, categoría, calibre y país", async () => {
        mocks.relaciones
            .mockReset()
            .mockResolvedValueOnce([
                {
                    publicacionId: 444,
                    paisId: 60,
                },
            ]);

        mocks.coincidencias.mockResolvedValue([
            { id: 444 },
        ]);

        expect(await altaPublicacionOperador(DATOS)).toEqual({
            esValido: false,
            errores: [
                "Este operador ya tiene una publicación con la misma especie, variedad, empaquetado, kilos, categoría, calibre y país.",
            ],
        });

        expect(mocks.publicacionWhere).toHaveBeenCalledWith({
            especieId: 10,
            variedadId: 20,
            envaseId: 30,
            kilosId: null,
            categoriaId: 40,
            calibreId: 50,
        });

        expect(mocks.crear).not.toHaveBeenCalled();
        expect(mocks.crearRelacion).not.toHaveBeenCalled();
        expect(mocks.crearEstadistica).not.toHaveBeenCalled();
        expect(mocks.notificar).not.toHaveBeenCalled();

        expect(mocks.eliminar).toHaveBeenCalledExactlyOnceWith(
            URL,
            777,
        );
    });

    it("permite una publicación con la misma selección en otro país", async () => {
        mocks.relaciones
            .mockReset()
            .mockResolvedValueOnce([
                {
                    publicacionId: 444,
                    paisId: 99,
                },
            ])
            .mockResolvedValue([
                RELACION_CREADA,
            ]);

        mocks.coincidencias.mockResolvedValue([
            { id: 444 },
        ]);

        expect((await altaPublicacionOperador(DATOS)).esValido).toBe(true);

        expect(mocks.crear).toHaveBeenCalledOnce();
        expect(mocks.crearRelacion).toHaveBeenCalledOnce();
    });

    it("rechaza guardar si se eliminó el operador mientras esperaba el bloqueo", async () => {
        let liberar!: () => void;
        let avisarEspera!: () => void;

        const bloqueo = new Promise<void>((resolve) => {
            liberar = resolve;
        });

        const esperando = new Promise<void>((resolve) => {
            avisarEspera = resolve;
        });

        mocks.bloquear.mockImplementation(async () => {
            avisarEspera();
            await bloqueo;
        });

        const guardado = altaPublicacionOperador(DATOS);

        await esperando;

        expect(mocks.operadorActual).not.toHaveBeenCalled();
        expect(mocks.crear).not.toHaveBeenCalled();

        mocks.operadorActual.mockResolvedValue(null);

        liberar();

        expect(await guardado).toEqual({
            esValido: false,
            errores: [
                "El operador ya no existe. No se pudo guardar la publicación.",
            ],
        });

        expect(mocks.bloquear).toHaveBeenCalledWith({
            texto: "SELECT 1::int AS locked FROM pg_advisory_xact_lock(1719, ?)",
            valores: [1],
        });

        expect(mocks.relaciones).not.toHaveBeenCalled();
        expect(mocks.crear).not.toHaveBeenCalled();
        expect(mocks.crearRelacion).not.toHaveBeenCalled();
        expect(mocks.usuarioActual).not.toHaveBeenCalled();

        expect(mocks.eliminar).toHaveBeenCalledExactlyOnceWith(
            URL,
            777,
        );

        expect(mocks.notificar).not.toHaveBeenCalled();
        expect(mocks.crearEstadistica).not.toHaveBeenCalled();
    });

    it("permite crear sin fotografía", async () => {
        const datos = {
            ...DATOS,
            fotografia: "",
        };

        mocks.validar.mockReturnValue({
            esValido: true,
            datos,
        });

        expect((await altaPublicacionOperador(datos)).esValido).toBe(true);

        expect(mocks.guardar).not.toHaveBeenCalled();
        expect(mocks.reservar).not.toHaveBeenCalled();

        expect(mocks.crear).toHaveBeenCalledWith(
            expect.objectContaining({
                foto: null,
            }),
        );

        expect(mocks.crear.mock.calls[0][0]).not.toHaveProperty("id");

        expect(mocks.crearEstadistica).toHaveBeenCalledWith(
            expect.objectContaining({
                username: "operador1",
                cantidad: 1,
            }),
        );
    });

    it("convierte el rechazo del contenido de la imagen en un error de formulario", async () => {
        mocks.guardar.mockRejectedValue(
            new ErrorImagenPublicacion("Imagen inválida"),
        );

        expect(await altaPublicacionOperador(DATOS)).toEqual({
            esValido: false,
            errores: ["Imagen inválida"],
        });

        expect(mocks.transaccion).not.toHaveBeenCalled();
        expect(mocks.notificar).not.toHaveBeenCalled();
        expect(mocks.crearEstadistica).not.toHaveBeenCalled();
    });

    it("limpia la fotografía si falla la reserva del identificador", async () => {
        const error = new Error("No se pudo reservar el ID");

        mocks.reservar.mockRejectedValue(error);

        await expect(
            altaPublicacionOperador(DATOS),
        ).rejects.toBe(error);

        expect(mocks.transaccion).not.toHaveBeenCalled();
        expect(mocks.guardar).not.toHaveBeenCalled();
        expect(mocks.eliminar).not.toHaveBeenCalled();
    });

    it.each([
        "creación",
        "vínculo",
        "estadística",
    ])(
        "limpia la fotografía cuando falla la %s",
        async (momento) => {
            const error = new Error("Fallo de base de datos");

            if (momento === "creación") {
                mocks.crear.mockRejectedValue(error);
            } else if (momento === "vínculo") {
                mocks.crearRelacion.mockRejectedValue(error);
            } else {
                mocks.crearEstadistica.mockRejectedValue(error);
            }

            await expect(
                altaPublicacionOperador(DATOS),
            ).rejects.toBe(error);

            expect(mocks.eliminar).toHaveBeenCalledExactlyOnceWith(
                URL,
                777,
            );

            if (momento === "estadística") {
                expect(mocks.notificar).not.toHaveBeenCalled();
            }
        },
    );

    it("propaga el error original después de solicitar la limpieza", async () => {
        const error = new Error("Fallo original");

        mocks.crear.mockRejectedValue(error);
        mocks.eliminar.mockResolvedValue(undefined);

        await expect(
            altaPublicacionOperador(DATOS),
        ).rejects.toBe(error);

        expect(mocks.eliminar).toHaveBeenCalledExactlyOnceWith(
            URL,
            777,
        );
    });

    it("espera a que la imagen esté lista antes de abrir una transacción", async () => {
        let terminarImagen!: (url: string) => void;
        let avisarInicio!: () => void;

        const iniciada = new Promise<void>((resolve) => {
            avisarInicio = resolve;
        });

        mocks.guardar.mockImplementation(() => {
            avisarInicio();

            return new Promise<string>((resolve) => {
                terminarImagen = resolve;
            });
        });

        const guardado = altaPublicacionOperador(DATOS);

        await iniciada;

        expect(mocks.transaccion).not.toHaveBeenCalled();
        expect(mocks.crear).not.toHaveBeenCalled();

        terminarImagen(URL);

        expect((await guardado).esValido).toBe(true);
        expect(mocks.transaccion).toHaveBeenCalledOnce();
        expect(mocks.crearEstadistica).toHaveBeenCalledOnce();
    });

    it("notifica el cambio de publicación después de crearla", async () => {
        await altaPublicacionOperador(DATOS);

        expect(mocks.notificar).toHaveBeenCalledOnce();

        expect(mocks.notificar).toHaveBeenCalledWith(
            expect.anything(),
            {
                operadorId: 1,
                publicacionId: 777,
            },
        );
    });

    it("no registra estadísticas ni notifica si el usuario del operador no existe", async () => {
        mocks.usuarioActual.mockResolvedValue(null);

        await expect(
            altaPublicacionOperador(DATOS),
        ).rejects.toThrow(
            "No se encontró el usuario asociado al operador.",
        );

        expect(mocks.crearEstadistica).not.toHaveBeenCalled();
        expect(mocks.notificar).not.toHaveBeenCalled();

        expect(mocks.eliminar).toHaveBeenCalledExactlyOnceWith(
            URL,
            777,
        );
    });
});