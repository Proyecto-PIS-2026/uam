import { beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerEstadisticas } from "./consultas-estadisticas";

const mocks = vi.hoisted(() => ({
    visitasAll: vi.fn(),
    contactosAll: vi.fn(),
    publicacionesAll: vi.fn(),
    contactosPorPublicacionAll: vi.fn(),
    cantidadPublicacionesAll: vi.fn(),
}));

vi.mock("../../../infraestructura/persistencia/prisma/db", () => ({
    db: {
        orm: {
            public: {
                EstadisticaVisita: { all: mocks.visitasAll },
                EstadisticaContacto: { all: mocks.contactosAll },
                EstadisticaPublicacion: { all: mocks.publicacionesAll },
                EstadisticaContactoPublicacion: { all: mocks.contactosPorPublicacionAll },
                EstadisticaCantidadPublicacion: { all: mocks.cantidadPublicacionesAll },
            },
        },
    },
}));

beforeEach(() => {
    vi.resetAllMocks();
    mocks.visitasAll.mockResolvedValue([]);
    mocks.contactosAll.mockResolvedValue([]);
    mocks.publicacionesAll.mockResolvedValue([]);
    mocks.contactosPorPublicacionAll.mockResolvedValue([]);
    mocks.cantidadPublicacionesAll.mockResolvedValue([]);
});

describe("obtenerEstadisticas", () => {
    it("consulta los cinco modelos de estadísticas", async () => {
        await obtenerEstadisticas();

        expect(mocks.visitasAll).toHaveBeenCalledOnce();
        expect(mocks.contactosAll).toHaveBeenCalledOnce();
        expect(mocks.publicacionesAll).toHaveBeenCalledOnce();
        expect(mocks.contactosPorPublicacionAll).toHaveBeenCalledOnce();
        expect(mocks.cantidadPublicacionesAll).toHaveBeenCalledOnce();
    });

    it("envía días calendario sin convertirlos a la zona horaria del navegador", async () => {
        const fecha = { toString: () => "2026-11-06T00:00:00Z" };

        mocks.visitasAll.mockResolvedValue([
            { id: 1, fecha, tipoVisitante: "comprador", cantidad: 2 },
        ]);

        mocks.contactosAll.mockResolvedValue([
            { id: 2, fecha, username: "operador", cantidad: 3 },
        ]);

        mocks.publicacionesAll.mockResolvedValue([
            { id: 3, fecha, username: "productor", cantidad: 4 },
        ]);

        mocks.contactosPorPublicacionAll.mockResolvedValue([
            { id: 4, fecha, username: "productor", especie: "Tomate", cantidad: 5 },
        ]);

        mocks.cantidadPublicacionesAll.mockResolvedValue([
            { id: 5, fecha, username: "operador", cantidad: 6 },
        ]);

        const resultado = await obtenerEstadisticas();

        expect(resultado.visitas[0]).toMatchObject({
            fecha: "2026-11-06",
            cantidad: 2,
        });

        expect(resultado.contactos[0]).toMatchObject({
            fecha: "2026-11-06",
            cantidad: 3,
        });

        expect(resultado.publicaciones[0]).toMatchObject({
            fecha: "2026-11-06",
            cantidad: 4,
        });

        expect(resultado.contactosPorPublicacion[0]).toMatchObject({
            fecha: "2026-11-06",
            cantidad: 5,
        });

        expect(resultado.cantidadPublicaciones[0]).toMatchObject({
            fecha: "2026-11-06",
            cantidad: 6,
        });
    });

    it("devuelve las cinco colecciones con sus respectivos datos", async () => {
        const fecha = new Date("2026-03-15T00:00:00.000Z");

        const visitas = [
            { id: 1, fecha, tipoVisitante: "OPERADOR", cantidad: 10 },
        ];

        const contactos = [
            { id: 2, fecha, username: "operador1", cantidad: 5 },
        ];

        const publicaciones = [
            { id: 3, fecha, username: "operador1", cantidad: 4 },
        ];

        const contactosPorPublicacion = [
            { id: 4, fecha, username: "operador1", especie: "Tomate", cantidad: 3 },
        ];

        const cantidadPublicaciones = [
            { id: 5, fecha, username: "operador1", cantidad: 12 },
        ];

        mocks.visitasAll.mockResolvedValue(visitas);
        mocks.contactosAll.mockResolvedValue(contactos);
        mocks.publicacionesAll.mockResolvedValue(publicaciones);
        mocks.contactosPorPublicacionAll.mockResolvedValue(contactosPorPublicacion);
        mocks.cantidadPublicacionesAll.mockResolvedValue(cantidadPublicaciones);

        const resultado = await obtenerEstadisticas();

        const fechaCalendario = "2026-03-15";

        expect(resultado).toEqual({
            visitas: [
                { ...visitas[0], fecha: fechaCalendario },
            ],
            contactos: [
                { ...contactos[0], fecha: fechaCalendario },
            ],
            publicaciones: [
                { ...publicaciones[0], fecha: fechaCalendario },
            ],
            contactosPorPublicacion: [
                { ...contactosPorPublicacion[0], fecha: fechaCalendario },
            ],
            cantidadPublicaciones: [
                { ...cantidadPublicaciones[0], fecha: fechaCalendario },
            ],
        });
    });

    it("conserva los datos originales de cada estadística", async () => {
        const fecha = new Date("2026-03-15T00:00:00.000Z");

        mocks.visitasAll.mockResolvedValue([
            { id: 1, fecha, tipoVisitante: "PRODUCTOR", cantidad: 8 },
        ]);

        mocks.contactosAll.mockResolvedValue([
            { id: 2, fecha, username: "productor1", cantidad: 6 },
        ]);

        mocks.publicacionesAll.mockResolvedValue([
            { id: 3, fecha, username: "operador1", cantidad: 2 },
        ]);

        mocks.contactosPorPublicacionAll.mockResolvedValue([
            { id: 4, fecha, username: "productor1", especie: "Manzana", cantidad: 3 },
        ]);

        mocks.cantidadPublicacionesAll.mockResolvedValue([
            { id: 5, fecha, username: "operador1", cantidad: 15 },
        ]);

        const resultado = await obtenerEstadisticas();

        expect(resultado.visitas[0]).toMatchObject({
            id: 1,
            tipoVisitante: "PRODUCTOR",
            cantidad: 8,
            fecha: "2026-03-15",
        });

        expect(resultado.contactos[0]).toMatchObject({
            id: 2,
            username: "productor1",
            cantidad: 6,
            fecha: "2026-03-15",
        });

        expect(resultado.publicaciones[0]).toMatchObject({
            id: 3,
            username: "operador1",
            cantidad: 2,
            fecha: "2026-03-15",
        });

        expect(resultado.contactosPorPublicacion[0]).toMatchObject({
            id: 4,
            username: "productor1",
            especie: "Manzana",
            cantidad: 3,
            fecha: "2026-03-15",
        });

        expect(resultado.cantidadPublicaciones[0]).toMatchObject({
            id: 5,
            username: "operador1",
            cantidad: 15,
            fecha: "2026-03-15",
        });
    });

    it("devuelve colecciones vacías cuando no existen registros", async () => {
        await expect(obtenerEstadisticas()).resolves.toEqual({
            visitas: [],
            contactos: [],
            publicaciones: [],
            contactosPorPublicacion: [],
            cantidadPublicaciones: [],
        });
    });

    it("propaga los errores al consultar las estadísticas", async () => {
        const error = new Error("Error al consultar estadísticas");
        mocks.contactosPorPublicacionAll.mockRejectedValue(error);

        await expect(obtenerEstadisticas()).rejects.toBe(error);
    });
});
