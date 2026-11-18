import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Temporal } from "temporal-polyfill";
import { obtenerPublicacionesDeOperador } from "./consultas-mi-mercado";
import { mapearPublicacionesMiMercado } from "./mapear-publicaciones";

const configuracion = vi.hoisted(() => ({
    habilitado: false,
    diasVigencia: 30,
    avisosHabilitados: true,
    diasAnticipacionAviso: 3,
}));

vi.mock("../imagenes/vigencia/configuracion-aging-fotos", () => ({
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
        imagen: consulta(),
        configuracionVigencia: consulta(),
    };
});

vi.mock("../../../infraestructura/persistencia/prisma/db", () => ({
    db: {
        orm: {
            public: {
                PublicacionOperador: mocks.relacion,
                Imagen: mocks.imagen,
                Configuracion: mocks.configuracionVigencia,
            },
        },
    },
}));

describe("consulta de publicaciones de Mi Mercado", () => {
    let fila: {
        id: number;
        precio: string | null;
        version: number;
        fecha: string;
    };

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
        mocks.configuracionVigencia.first.mockReset().mockResolvedValue(null);

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
                    estadoVigencia: null,
                },
            },
        ]);

        expect(mocks.relacion.where).toHaveBeenCalledWith({
            operadorId: 10,
        });
    });

    it("incluye la vigencia de la publicación junto al estado independiente de su foto", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-11-04T15:00:00Z"));
        const fechaVigencia = Temporal.Instant.from("2026-11-06T02:59:59Z");
        mocks.relacion.all.mockResolvedValue([{
            id: 1,
            publicacionId: 20,
            publicacion: { ...fila, fechaVigencia, foto: null, fotoEliminadaPorVencimientoEn: "2026-11-03T12:00:00Z" },
        }]);
        mocks.configuracionVigencia.first.mockResolvedValueOnce({ valorConfiguracion: "true" })
            .mockResolvedValueOnce({ valorConfiguracion: "2" });

        const [relacion] = await obtenerPublicacionesDeOperador(10);

        expect(relacion.publicacion).toMatchObject({ id: 20, estadoVigencia: "por-vencer", estadoFoto: "eliminada", version: 1 });
        expect(mocks.configuracionVigencia.where).toHaveBeenCalledWith({ nombreConfiguracion: "aviso_vencimiento_publicaciones_operador_habilitado" });
        expect(mocks.configuracionVigencia.where).toHaveBeenCalledWith({ nombreConfiguracion: "anticipacion_aviso_publicaciones_operador" });
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
                    estadoVigencia: null,
                },
            },
            {
                ...relaciones[1],
                publicacion: {
                    ...relaciones[1].publicacion,
                    estadoFoto: null,
                    estadoVigencia: null,
                },
            },
        ]);

        expect(relaciones[0].publicacion.foto).toBe(
            `/api/publicaciones/imagenes/20/${archivo}`,
        );
    });

});
