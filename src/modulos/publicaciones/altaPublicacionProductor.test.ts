import "temporal-polyfill/full/global";
import "temporal-polyfill/types/global";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    productor: vi.fn(),
    especie: vi.fn(),
    variedad: vi.fn(),
    envase: vi.fn(),
    kilos: vi.fn(),
    categoria: vi.fn(),
    calibre: vi.fn(),
    pais: vi.fn(),
    relaciones: vi.fn(),
    coincidencias: vi.fn(),
    crearPublicacion: vi.fn(),
    crearRelacion: vi.fn(),
    crearUbicacion: vi.fn(),
    actualizarPublicacion: vi.fn(),
    eliminarPublicacion: vi.fn(),
    ejecutar: vi.fn(),
    transaccion: vi.fn(),
    guardarImagen: vi.fn(),
    eliminarImagen: vi.fn(),
    reservarId: vi.fn(),
    leerPublicacion: vi.fn(),
    productorActual: vi.fn(),
    usuarioActual: vi.fn(),
    estadisticaExistente: vi.fn(),
    crearEstadistica: vi.fn(),
    actualizarEstadistica: vi.fn(),
    consultarConfig: vi.fn(),
}));

vi.mock("../../infraestructura/persistencia/prisma/db", () => ({
    db: {
        orm: {
            public: {
                Configuracion: {
                    where: (filtro: { nombreConfiguracion: string }) => ({
                        select: () => ({
                            first: () =>
                                mocks.consultarConfig(
                                    filtro.nombreConfiguracion,
                                ),
                        }),
                    }),
                },

                Productor: {
                    where: () => ({
                        first: mocks.productor,
                    }),
                },

                Especie: {
                    where: () => ({
                        first: mocks.especie,
                    }),
                },

                Variedad: {
                    where: () => ({
                        first: mocks.variedad,
                    }),
                },

                Envase: {
                    where: () => ({
                        first: mocks.envase,
                    }),
                },

                KilosEmpaquetado: {
                    where: () => ({
                        first: mocks.kilos,
                    }),
                },

                Categoria: {
                    where: () => ({
                        first: mocks.categoria,
                    }),
                },

                Calibre: {
                    where: () => ({
                        first: mocks.calibre,
                    }),
                },

                Pais: {
                    where: () => ({
                        first: mocks.pais,
                    }),
                },

                Publicacion: {
                    where: () => ({
                        update: mocks.actualizarPublicacion,
                        delete: mocks.eliminarPublicacion,
                    }),
                    select: () => ({
                        where: () => ({
                            first: mocks.leerPublicacion,
                        }),
                    }),
                },
            },
        },

        raw: {
            sql: () => ({
                returnsRow: () => ({
                    build: () => "bloqueo del productor",
                }),
            }),
        },

        transaction: mocks.transaccion,

        runtime: () => ({
            query: mocks.reservarId,
        }),
    },
}));

vi.mock("./imagenes-productor", async (importar) => ({
    ...await importar<typeof import("./imagenes-productor")>(),
    guardarImagenProductor: mocks.guardarImagen,
}));

vi.mock("./operadores/imagenes-publicacion", () => ({
    eliminarImagenPublicacionGestionada: mocks.eliminarImagen,
}));

import { altaPublicacionProductor } from "./altaPublicacionProductor";
import { ErrorImagenProductor } from "./imagenes-productor";

const datos = {
    productorId: 1,
    especieId: 2,
    variedadId: 3,
    envaseId: 4,
    kilosId: null,
    categoriaId: 5,
    calibreId: 6,
    paisId: 7,
    latitud: -34.9,
    longitud: -56.2,
    departamento: " Montevideo ",
    nombreLugar: null,
    disponibilidad: true,
};

const fotografia = "data:image/png;base64,YQ==";

const urlFoto =
    "/api/publicaciones/imagenes/42/12345678-1234-4234-8234-123456789abc.webp";

const tx = {
    execute: mocks.ejecutar,

    orm: {
        public: {
            Productor: {
                where: () => ({
                    first: mocks.productorActual,
                }),
            },

            Usuario: {
                where: () => ({
                    first: mocks.usuarioActual,
                }),
            },

            EstadisticaCantidadPublicacion: {
                where: (filtro: { id?: number }) =>
                    filtro.id !== undefined
                        ? {
                            update: mocks.actualizarEstadistica,
                        }
                        : {
                            first: mocks.estadisticaExistente,
                        },

                create: mocks.crearEstadistica,
            },

            PublicacionProductor: {
                where: () => ({
                    all: mocks.relaciones,
                }),

                create: mocks.crearRelacion,
            },

            Publicacion: {
                where: () => ({
                    select: () => ({
                        all: mocks.coincidencias,
                    }),
                }),

                create: mocks.crearPublicacion,
            },

            Ubicacion: {
                create: mocks.crearUbicacion,
            },
        },
    },
};

function configurarVigencia(
    habilitada: string | null = "false",
    dias: string | null = "30",
) {
    mocks.consultarConfig.mockImplementation(
        (nombreConfiguracion: string) => {
            const valor =
                nombreConfiguracion ===
                "vigencia_publicaciones_productor_habilitada"
                    ? habilitada
                    : dias;

            return Promise.resolve(
                valor === null
                    ? null
                    : { valorConfiguracion: valor },
            );
        },
    );
}

describe("altaPublicacionProductor", () => {
    beforeEach(() => {
        vi.resetAllMocks();

        configurarVigencia();

        mocks.productor.mockResolvedValue({
            id: 1,
            usuarioId: 101,
        });

        mocks.productorActual.mockResolvedValue({
            id: 1,
            usuarioId: 101,
        });

        mocks.usuarioActual.mockResolvedValue({
            id: 101,
            username: "productor1",
        });

        mocks.estadisticaExistente.mockResolvedValue(null);

        mocks.especie.mockResolvedValue({
            id: 2,
            especieActiva: true,
        });

        mocks.variedad.mockResolvedValue({
            id: 3,
            especieId: 2,
            variedadActiva: true,
        });

        mocks.envase.mockResolvedValue({
            id: 4,
            nombreEnvase: "Cajón",
        });

        mocks.kilos.mockResolvedValue({
            id: 8,
            valor: "20",
        });

        mocks.categoria.mockResolvedValue({
            id: 5,
            especieId: 2,
        });

        mocks.calibre.mockResolvedValue({
            id: 6,
        });

        mocks.pais.mockResolvedValue({
            id: 7,
        });

        mocks.relaciones
            .mockResolvedValueOnce([])
            .mockResolvedValue([
                {
                    publicacionId: 42,
                    productorId: 1,
                    paisId: 7,
                },
            ]);

        mocks.coincidencias.mockResolvedValue([]);

        mocks.crearPublicacion.mockResolvedValue({
            id: 42,
        });

        mocks.crearRelacion.mockResolvedValue({
            id: 74,
        });

        mocks.crearUbicacion.mockResolvedValue({
            id: 1,
        });

        mocks.reservarId.mockResolvedValue([
            { id: 42 },
        ]);

        mocks.leerPublicacion.mockResolvedValue(null);

        mocks.guardarImagen.mockResolvedValue(urlFoto);
        mocks.eliminarImagen.mockResolvedValue(undefined);

        mocks.transaccion.mockImplementation(
            async (
                operacion: (transaccion: typeof tx) => Promise<unknown>,
            ) => operacion(tx),
        );

        vi.spyOn(console, "error").mockImplementation(() => undefined);
    });

    afterEach(() => vi.restoreAllMocks());

    it("rechaza datos inválidos antes de consultar la base", async () => {
        expect(
            await altaPublicacionProductor(null),
        ).toMatchObject({
            esValido: false,
        });

        expect(mocks.consultarConfig).not.toHaveBeenCalled();
        expect(mocks.productor).not.toHaveBeenCalled();
        expect(mocks.transaccion).not.toHaveBeenCalled();
    });

    it.each([
        { consulta: "productor", valor: null },
        {
            consulta: "especie",
            valor: { id: 2, especieActiva: false },
        },
        {
            consulta: "variedad",
            valor: { id: 3, especieId: 9, variedadActiva: true },
        },
        {
            consulta: "variedad",
            valor: { id: 3, especieId: 2, variedadActiva: false },
        },
        { consulta: "envase", valor: null },
        { consulta: "kilos", valor: null },
        {
            consulta: "categoria",
            valor: { id: 5, especieId: 9 },
        },
        { consulta: "categoria", valor: null },
        { consulta: "calibre", valor: null },
        { consulta: "pais", valor: null },
    ] as const)(
        "rechaza una selección no disponible o incoherente: $consulta",
        async ({ consulta, valor }) => {
            mocks[consulta].mockResolvedValue(valor);

            expect(
                await altaPublicacionProductor({
                    ...datos,
                    kilosId: 8,
                }),
            ).toEqual({
                esValido: false,
                errores: [
                    "La selección contiene datos que ya no están disponibles. Actualizá el formulario.",
                ],
            });

            expect(mocks.transaccion).not.toHaveBeenCalled();
            expect(mocks.guardarImagen).not.toHaveBeenCalled();
        },
    );

    it.each([
        { envaseId: 4, kilosId: null },
        { envaseId: null, kilosId: 8 },
        { envaseId: 4, kilosId: 8 },
        { envaseId: null, kilosId: null },
    ])(
        "permite envase y kilos independientes sin variedad: %j",
        async (empaquetado) => {
            expect(
                await altaPublicacionProductor({
                    ...datos,
                    variedadId: null,
                    ...empaquetado,
                }),
            ).toMatchObject({
                esValido: true,
            });

            expect(mocks.crearPublicacion).toHaveBeenCalledWith(
                expect.objectContaining({
                    variedadId: null,
                    ...empaquetado,
                }),
            );

            expect(mocks.variedad).not.toHaveBeenCalled();
        },
    );

    it("guarda la publicación y su ubicación sin exigir precio ni fotografía", async () => {
        expect(
            await altaPublicacionProductor(datos),
        ).toEqual({
            esValido: true,
            id: 42,
            mensaje: "Publicación creada correctamente.",
        });

        expect(mocks.ejecutar).toHaveBeenCalledExactlyOnceWith(
            "bloqueo del productor",
        );

        expect(
            mocks.ejecutar.mock.invocationCallOrder[0],
        ).toBeLessThan(
            mocks.relaciones.mock.invocationCallOrder[0],
        );

        expect(mocks.crearPublicacion).toHaveBeenCalledExactlyOnceWith({
            tipoPublicacion: "PRODUCTOR",
            publicacionDisponible: true,
            precio: null,
            foto: null,
            cantidadUnidades: null,
            comentario: null,
            especieId: 2,
            variedadId: 3,
            envaseId: 4,
            kilosId: null,
            categoriaId: 5,
            calibreId: 6,
            fechaVigencia: null,
        });

        expect(mocks.crearRelacion).toHaveBeenCalledExactlyOnceWith({
            publicacionId: 42,
            productorId: 1,
            paisId: 7,
        });

        expect(mocks.crearUbicacion).toHaveBeenCalledExactlyOnceWith({
            publicacionId: 74,
            nombreUbicacion: "Montevideo",
            urlMaps: "https://www.google.com/maps?q=-34.9%2C-56.2",
            departamento: "Montevideo",
        });

        expect(mocks.guardarImagen).not.toHaveBeenCalled();
    });

    it("consulta ambas configuraciones de vigencia", async () => {
        await altaPublicacionProductor(datos);

        expect(mocks.consultarConfig).toHaveBeenCalledTimes(2);

        expect(mocks.consultarConfig).toHaveBeenCalledWith(
            "vigencia_publicaciones_productor_habilitada",
        );

        expect(mocks.consultarConfig).toHaveBeenCalledWith(
            "vigencia_publicaciones_productor",
        );
    });

    it("asigna la fecha máxima cuando la vigencia está habilitada y no se proporciona una fecha", async () => {
        configurarVigencia("true", "30");

        const fechaMaxima = Temporal.Now
            .plainDateISO("America/Montevideo")
            .add({ days: 30 })
            .toString();

        expect(
            await altaPublicacionProductor(datos),
        ).toMatchObject({
            esValido: true,
        });

        const fechaGuardada = mocks.crearPublicacion.mock.calls[0][0]
            .fechaVigencia as Temporal.Instant;

        const fechaLocalGuardada = fechaGuardada.toZonedDateTimeISO(
            "America/Montevideo",
        );

        expect(fechaLocalGuardada.toPlainDate().toString()).toBe(
            fechaMaxima,
        );

        expect(fechaLocalGuardada.toPlainTime().toString()).toBe(
            "23:59:59",
        );
    });

    it("acepta una fecha de vigencia dentro del límite configurado", async () => {
        configurarVigencia("true", "30");

        const fechaVigencia = Temporal.Now
            .plainDateISO("America/Montevideo")
            .add({ days: 10 })
            .toString();

        expect(
            await altaPublicacionProductor({
                ...datos,
                fechaVigencia,
            }),
        ).toMatchObject({
            esValido: true,
        });

        const fechaGuardada = mocks.crearPublicacion.mock.calls[0][0]
            .fechaVigencia as Temporal.Instant;

        const fechaLocalGuardada = fechaGuardada.toZonedDateTimeISO(
            "America/Montevideo",
        );

        expect(fechaLocalGuardada.toPlainDate().toString()).toBe(
            fechaVigencia,
        );

        expect(fechaLocalGuardada.toPlainTime().toString()).toBe(
            "23:59:59",
        );
    });

    it("rechaza una fecha de vigencia superior al límite configurado", async () => {
        configurarVigencia("true", "30");

        const fechaMaxima = Temporal.Now
            .plainDateISO("America/Montevideo")
            .add({ days: 30 })
            .toString();

        const fechaExcedida = Temporal.Now
            .plainDateISO("America/Montevideo")
            .add({ days: 31 })
            .toString();

        expect(
            await altaPublicacionProductor({
                ...datos,
                fechaVigencia: fechaExcedida,
            }),
        ).toEqual({
            esValido: false,
            errores: [
                `La fecha de vigencia no puede superar el ${fechaMaxima}.`,
            ],
        });

        expect(mocks.productor).not.toHaveBeenCalled();
        expect(mocks.transaccion).not.toHaveBeenCalled();
        expect(mocks.crearPublicacion).not.toHaveBeenCalled();
    });

    it("rechaza la configuración de vigencia cuando falta una de las opciones", async () => {
        configurarVigencia(null, "30");

        await expect(
            altaPublicacionProductor(datos),
        ).rejects.toThrow(
            "No se pudo consultar la configuración de vigencia de publicaciones.",
        );

        expect(mocks.productor).not.toHaveBeenCalled();
        expect(mocks.transaccion).not.toHaveBeenCalled();
    });

    it("rechaza una cantidad de días inválida cuando la vigencia está habilitada", async () => {
        configurarVigencia("true", "0");

        await expect(
            altaPublicacionProductor(datos),
        ).rejects.toThrow(
            "La configuración de vigencia de publicaciones no es válida.",
        );

        expect(mocks.productor).not.toHaveBeenCalled();
        expect(mocks.transaccion).not.toHaveBeenCalled();
    });

    it("guarda el comentario del publicador sin los espacios de los costados", async () => {
        await altaPublicacionProductor({
            ...datos,
            comentario: "  Cosecha de esta semana  ",
        });

        expect(mocks.crearPublicacion).toHaveBeenCalledWith(
            expect.objectContaining({
                comentario: "Cosecha de esta semana",
            }),
        );
    });

    it("guarda los departamentos normalizados y permite puntos anteriores sin departamento en la misma transacción", async () => {
        const ubicaciones = [
            {
                nombreUbicacion: " Chacra norte ",
                urlMaps: " https://www.google.com/maps?q=-34.7,-56.1 ",
                departamento: " Departamento de Canelones ",
            },
            {
                nombreUbicacion: " Puesto de retiro ",
                urlMaps: " https://maps.app.goo.gl/ejemplo ",
            },
        ];

        expect(
            await altaPublicacionProductor({
                ...datos,
                ubicaciones,
            }),
        ).toMatchObject({
            esValido: true,
            id: 42,
        });

        expect(mocks.transaccion).toHaveBeenCalledOnce();
        expect(mocks.crearRelacion).toHaveBeenCalledOnce();
        expect(mocks.crearUbicacion).toHaveBeenCalledTimes(2);

        expect(mocks.crearUbicacion).toHaveBeenNthCalledWith(1, {
            publicacionId: 74,
            nombreUbicacion: "Chacra norte",
            urlMaps: "https://www.google.com/maps?q=-34.7,-56.1",
            departamento: "Canelones",
        });

        expect(mocks.crearUbicacion).toHaveBeenNthCalledWith(2, {
            publicacionId: 74,
            nombreUbicacion: "Puesto de retiro",
            urlMaps: "https://maps.app.goo.gl/ejemplo",
        });
    });

    it("normaliza también el departamento de las coordenadas del formulario anterior", async () => {
        await expect(
            altaPublicacionProductor({
                ...datos,
                departamento: " SAN JOSE ",
                nombreLugar: " Quinta ",
            }),
        ).resolves.toMatchObject({
            esValido: true,
        });

        expect(mocks.crearUbicacion).toHaveBeenCalledExactlyOnceWith({
            publicacionId: 74,
            nombreUbicacion: "Quinta",
            departamento: "San José",
            urlMaps: "https://www.google.com/maps?q=-34.9%2C-56.2",
        });
    });

    it("rechaza un departamento inválido antes de guardar publicaciones o fotografías", async () => {
        const ubicaciones = [
            {
                nombreUbicacion: "Quinta",
                urlMaps: "https://maps.google.com/?q=-34,-56",
                departamento: "Buenos Aires",
            },
        ];

        await expect(
            altaPublicacionProductor({
                ...datos,
                ubicaciones,
                fotografia,
            }),
        ).resolves.toMatchObject({
            esValido: false,
        });

        expect(mocks.productor).not.toHaveBeenCalled();
        expect(mocks.transaccion).not.toHaveBeenCalled();
        expect(mocks.guardarImagen).not.toHaveBeenCalled();
    });

    it("permite una lista vacía explícita aunque se envíen las coordenadas anteriores", async () => {
        expect(
            await altaPublicacionProductor({
                ...datos,
                ubicaciones: [],
            }),
        ).toMatchObject({
            esValido: true,
            id: 42,
        });

        expect(mocks.crearPublicacion).toHaveBeenCalledOnce();
        expect(mocks.crearRelacion).toHaveBeenCalledOnce();
        expect(mocks.crearUbicacion).not.toHaveBeenCalled();
    });

    it("rechaza una ubicación inválida antes de consultar o escribir cualquier dato", async () => {
        const ubicaciones = [
            {
                nombreUbicacion: "Chacra",
                urlMaps: "https://www.google.com/maps?q=-34.7,-56.1",
            },
            {
                nombreUbicacion: "Retiro",
                urlMaps: "https://ejemplo.test",
            },
        ];

        expect(
            await altaPublicacionProductor({
                ...datos,
                ubicaciones,
                fotografia,
            }),
        ).toEqual({
            esValido: false,
            errores: [
                "Seleccioná cada punto de retiro en el mapa antes de guardar.",
            ],
        });

        expect(mocks.consultarConfig).not.toHaveBeenCalled();
        expect(mocks.productor).not.toHaveBeenCalled();
        expect(mocks.transaccion).not.toHaveBeenCalled();
        expect(mocks.crearPublicacion).not.toHaveBeenCalled();
        expect(mocks.crearRelacion).not.toHaveBeenCalled();
        expect(mocks.crearUbicacion).not.toHaveBeenCalled();
        expect(mocks.guardarImagen).not.toHaveBeenCalled();
    });

    it("propaga el fallo de un segundo punto para abortar la transacción completa y limpiar la foto", async () => {
        const error = new Error(
            "No se pudo guardar el segundo punto",
        );

        mocks.crearUbicacion
            .mockResolvedValueOnce({ id: 1 })
            .mockRejectedValueOnce(error);

        const ubicaciones = [
            {
                nombreUbicacion: "Chacra",
                urlMaps: "https://www.google.com/maps?q=-34.7,-56.1",
            },
            {
                nombreUbicacion: "Retiro",
                urlMaps: "https://maps.app.goo.gl/ejemplo",
            },
        ];

        await expect(
            altaPublicacionProductor({
                ...datos,
                ubicaciones,
                fotografia,
            }),
        ).rejects.toBe(error);

        expect(mocks.transaccion).toHaveBeenCalledOnce();
        expect(mocks.crearUbicacion).toHaveBeenCalledTimes(2);

        expect(mocks.eliminarImagen).toHaveBeenCalledExactlyOnceWith(
            urlFoto,
            42,
        );
    });

    it.each([null, "", "   "])(
        "persiste null cuando el precio es %j",
        async (precio) => {
            expect(
                (await altaPublicacionProductor({
                    ...datos,
                    precio,
                })).esValido,
            ).toBe(true);

            expect(mocks.crearPublicacion).toHaveBeenCalledWith(
                expect.objectContaining({
                    precio: null,
                }),
            );
        },
    );

    it("conserva precio, cantidad, disponibilidad y nombre de retiro", async () => {
        mocks.categoria.mockResolvedValue({
            id: 5,
            especieId: null,
        });

        await altaPublicacionProductor({
            ...datos,
            precio: " 1250 ",
            cantidadUnidades: 0,
            disponibilidad: false,
            nombreLugar: " Ruta 5 ",
        });

        expect(mocks.crearPublicacion).toHaveBeenCalledWith(
            expect.objectContaining({
                precio: "1250",
                cantidadUnidades: 0,
                publicacionDisponible: false,
            }),
        );

        expect(mocks.crearUbicacion).toHaveBeenCalledWith(
            expect.objectContaining({
                nombreUbicacion: "Ruta 5",
            }),
        );
    });

    it("avisa sobre un duplicado del mismo Productor antes de guardar", async () => {
        mocks.relaciones
            .mockReset()
            .mockResolvedValue([
                {
                    publicacionId: 20,
                    paisId: 7,
                },
            ]);

        mocks.coincidencias.mockResolvedValue([
            { id: 20 },
        ]);

        expect(
            await altaPublicacionProductor(datos),
        ).toEqual({
            esValido: false,
            errores: [
                "Este Productor ya tiene una publicación con la misma especie, variedad, empaquetado, kilos, categoría, calibre y país.",
            ],
        });

        expect(mocks.crearPublicacion).not.toHaveBeenCalled();
        expect(mocks.crearUbicacion).not.toHaveBeenCalled();
        expect(mocks.crearEstadistica).not.toHaveBeenCalled();
    });

    it("permite una combinación que pertenece a otro Productor", async () => {
        mocks.relaciones
            .mockReset()
            .mockResolvedValueOnce([
                {
                    publicacionId: 10,
                    paisId: 7,
                },
            ])
            .mockResolvedValue([
                {
                    publicacionId: 10,
                    productorId: 1,
                    paisId: 7,
                },
                {
                    publicacionId: 42,
                    productorId: 1,
                    paisId: 7,
                },
            ]);

        mocks.coincidencias.mockResolvedValue([
            { id: 20 },
        ]);

        expect(
            await altaPublicacionProductor(datos),
        ).toMatchObject({
            esValido: true,
        });
    });

    it("crea el registro estadístico cuando todavía no existe uno para el día", async () => {
        await expect(
            altaPublicacionProductor(datos),
        ).resolves.toEqual({
            esValido: true,
            id: 42,
            mensaje: "Publicación creada correctamente.",
        });

        expect(mocks.usuarioActual).toHaveBeenCalledOnce();

        expect(mocks.crearEstadistica).toHaveBeenCalledExactlyOnceWith({
            fecha: expect.anything(),
            username: "productor1",
            cantidad: 1,
        });

        expect(mocks.actualizarEstadistica).not.toHaveBeenCalled();
    });

    it("actualiza el registro estadístico existente del mismo día", async () => {
        mocks.estadisticaExistente.mockResolvedValue({
            id: 456,
            username: "productor1",
            cantidad: 3,
        });

        mocks.relaciones
            .mockReset()
            .mockResolvedValueOnce([])
            .mockResolvedValue([
                { publicacionId: 10, productorId: 1, paisId: 7 },
                { publicacionId: 20, productorId: 1, paisId: 7 },
                { publicacionId: 30, productorId: 1, paisId: 7 },
                { publicacionId: 42, productorId: 1, paisId: 7 },
            ]);

        await expect(
            altaPublicacionProductor(datos),
        ).resolves.toMatchObject({
            esValido: true,
            id: 42,
        });

        expect(mocks.actualizarEstadistica).toHaveBeenCalledExactlyOnceWith({
            cantidad: 4,
        });

        expect(mocks.crearEstadistica).not.toHaveBeenCalled();
    });

    it("cuenta las publicaciones aunque no estén disponibles", async () => {
        mocks.relaciones
            .mockReset()
            .mockResolvedValueOnce([])
            .mockResolvedValue([
                { publicacionId: 10, productorId: 1, paisId: 7 },
                { publicacionId: 20, productorId: 1, paisId: 7 },
                { publicacionId: 30, productorId: 1, paisId: 7 },
                { publicacionId: 42, productorId: 1, paisId: 7 },
            ]);

        await expect(
            altaPublicacionProductor({
                ...datos,
                disponibilidad: false,
            }),
        ).resolves.toMatchObject({
            esValido: true,
        });

        expect(mocks.crearEstadistica).toHaveBeenCalledWith(
            expect.objectContaining({
                username: "productor1",
                cantidad: 4,
            }),
        );
    });

    it("aborta la transacción si no puede guardar la estadística", async () => {
        const error = new Error(
            "No se pudo guardar la estadística",
        );

        mocks.crearEstadistica.mockRejectedValue(error);

        await expect(
            altaPublicacionProductor(datos),
        ).rejects.toBe(error);

        expect(mocks.crearPublicacion).toHaveBeenCalledOnce();
        expect(mocks.crearRelacion).toHaveBeenCalledOnce();
        expect(mocks.crearEstadistica).toHaveBeenCalledOnce();
    });

    it("propaga un fallo de la transacción sin intentar guardar la fotografía", async () => {
        const error = new Error("Base no disponible");

        mocks.crearRelacion.mockRejectedValue(error);

        await expect(
            altaPublicacionProductor(datos),
        ).rejects.toBe(error);

        expect(mocks.crearUbicacion).not.toHaveBeenCalled();
        expect(mocks.guardarImagen).not.toHaveBeenCalled();
    });

    it("prepara la fotografía antes de abrir la transacción y la guarda junto con la publicación y ubicación", async () => {
        const preparada = Promise.withResolvers<string>();

        mocks.guardarImagen.mockReturnValue(preparada.promise);

        const pendiente = altaPublicacionProductor({
            ...datos,
            fotografia,
        });

        await vi.waitFor(() =>
            expect(mocks.guardarImagen).toHaveBeenCalledExactlyOnceWith(
                42,
                fotografia,
            ),
        );

        expect(mocks.transaccion).not.toHaveBeenCalled();

        preparada.resolve(urlFoto);

        await expect(pendiente).resolves.toMatchObject({
            esValido: true,
            id: 42,
        });

        expect(mocks.crearPublicacion).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 42,
                foto: urlFoto,
            }),
        );

        expect(mocks.crearUbicacion).toHaveBeenCalledOnce();
        expect(mocks.actualizarPublicacion).not.toHaveBeenCalled();
        expect(mocks.eliminarImagen).not.toHaveBeenCalled();
    });

    it("rechaza una fotografía inválida sin crear ni eliminar publicaciones", async () => {
        mocks.guardarImagen.mockRejectedValue(
            new ErrorImagenProductor(
                "La imagen debe ser JPEG, PNG o WebP.",
            ),
        );

        expect(
            await altaPublicacionProductor({
                ...datos,
                fotografia,
            }),
        ).toEqual({
            esValido: false,
            errores: [
                "La imagen debe ser JPEG, PNG o WebP.",
            ],
        });

        expect(mocks.transaccion).not.toHaveBeenCalled();
        expect(mocks.crearPublicacion).not.toHaveBeenCalled();
        expect(mocks.eliminarPublicacion).not.toHaveBeenCalled();
        expect(mocks.eliminarImagen).not.toHaveBeenCalled();
    });

    it("limpia la foto preparada si la transacción falla al guardar la ubicación", async () => {
        const error = new Error(
            "No se pudo guardar la ubicación",
        );

        mocks.crearUbicacion.mockRejectedValue(error);

        await expect(
            altaPublicacionProductor({
                ...datos,
                fotografia,
            }),
        ).rejects.toBe(error);

        expect(mocks.leerPublicacion).toHaveBeenCalledOnce();

        expect(mocks.eliminarImagen).toHaveBeenCalledExactlyOnceWith(
            urlFoto,
            42,
        );

        expect(mocks.eliminarPublicacion).not.toHaveBeenCalled();
    });

    it("limpia la foto preparada cuando la combinación ya existe", async () => {
        mocks.relaciones
            .mockReset()
            .mockResolvedValue([
                {
                    publicacionId: 20,
                    paisId: 7,
                },
            ]);

        mocks.coincidencias.mockResolvedValue([
            { id: 20 },
        ]);

        await expect(
            altaPublicacionProductor({
                ...datos,
                fotografia,
            }),
        ).resolves.toMatchObject({
            esValido: false,
        });

        expect(mocks.crearPublicacion).not.toHaveBeenCalled();

        expect(mocks.eliminarImagen).toHaveBeenCalledExactlyOnceWith(
            urlFoto,
            42,
        );
    });

    it("revalida al Productor y limpia su foto si desaparece durante la preparación", async () => {
        mocks.productorActual.mockResolvedValue(null);

        await expect(
            altaPublicacionProductor({
                ...datos,
                fotografia,
            }),
        ).resolves.toEqual({
            esValido: false,
            errores: [
                "El Productor ya no existe. No se pudo guardar la publicación.",
            ],
        });

        expect(mocks.crearPublicacion).not.toHaveBeenCalled();

        expect(mocks.eliminarImagen).toHaveBeenCalledExactlyOnceWith(
            urlFoto,
            42,
        );
    });

    it("conserva foto y publicación si el commit se confirmó pero falló su respuesta", async () => {
        const error = new Error("Respuesta de commit perdida");

        mocks.transaccion.mockImplementation(
            async (
                operacion: (transaccion: typeof tx) => Promise<unknown>,
            ) => {
                await operacion(tx);
                mocks.leerPublicacion.mockResolvedValue({
                    foto: urlFoto,
                });
                throw error;
            },
        );

        await expect(
            altaPublicacionProductor({
                ...datos,
                fotografia,
            }),
        ).rejects.toBe(error);

        expect(mocks.leerPublicacion).toHaveBeenCalledOnce();
        expect(mocks.eliminarImagen).not.toHaveBeenCalled();
        expect(mocks.eliminarPublicacion).not.toHaveBeenCalled();
    });

    it("conserva la foto si no puede confirmar el resultado de la transacción", async () => {
        const error = new Error("Conexión perdida");

        mocks.transaccion.mockRejectedValue(error);
        mocks.leerPublicacion.mockRejectedValue(error);

        await expect(
            altaPublicacionProductor({
                ...datos,
                fotografia,
            }),
        ).rejects.toBe(error);

        expect(mocks.eliminarImagen).not.toHaveBeenCalled();
        expect(mocks.eliminarPublicacion).not.toHaveBeenCalled();
    });

    it("no prepara la imagen si no puede reservar un identificador", async () => {
        mocks.reservarId.mockResolvedValue([]);

        await expect(
            altaPublicacionProductor({
                ...datos,
                fotografia,
            }),
        ).rejects.toThrow("No se pudo reservar");

        expect(mocks.guardarImagen).not.toHaveBeenCalled();
        expect(mocks.transaccion).not.toHaveBeenCalled();
    });
});