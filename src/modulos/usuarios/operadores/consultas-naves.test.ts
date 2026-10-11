import { beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerNaves } from "./consultas-naves";

const mockDb = vi.hoisted(() => ({
    nave: {
        all: vi.fn(),
    },
}));

vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
    db: {
        orm: {
            public: {
                Nave: mockDb.nave,
            },
        },
    },
}));

describe("obtenerNaves", () => {

    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.nave.all.mockResolvedValue([]);
    });

    it("devuelve una lista vacía cuando no hay naves", async () => {
        const resultado = await obtenerNaves();

        expect(resultado).toEqual([]);
        expect(mockDb.nave.all).toHaveBeenCalledOnce();
    });

    // Cada nave sale solo con id y nombre, que es lo que usa el desplegable del formulario
    it("devuelve cada nave con su id y su nombre", async () => {
        mockDb.nave.all.mockResolvedValue([
            { id: 2, nombreNave: "B", otraColumna: "no se usa" },
        ]);

        const resultado = await obtenerNaves();

        expect(resultado).toEqual([{ id: 2, nombre: "B" }]);
    });

    // Las naves se ordenan por nombre, sin importar el orden en que las devuelva la base
    it("ordena las naves por nombre", async () => {
        mockDb.nave.all.mockResolvedValue([
            { id: 3, nombreNave: "C" },
            { id: 1, nombreNave: "A" },
            { id: 2, nombreNave: "B" },
        ]);

        const resultado = await obtenerNaves();

        expect(resultado).toEqual([
            { id: 1, nombre: "A" },
            { id: 2, nombre: "B" },
            { id: 3, nombre: "C" },
        ]);
    });

    it("ordena los nombres con eñe entre la ene y la o", async () => {
        mockDb.nave.all.mockResolvedValue([
            { id: 3, nombreNave: "Oeste" },
            { id: 2, nombreNave: "Ñandú" },
            { id: 1, nombreNave: "Norte" },
        ]);

        expect(await obtenerNaves()).toEqual([
            { id: 1, nombre: "Norte" },
            { id: 2, nombre: "Ñandú" },
            { id: 3, nombre: "Oeste" },
        ]);
    });

    it("propaga un error de la consulta", async () => {
        mockDb.nave.all.mockRejectedValue(new Error("Falló la base de datos"));

        await expect(obtenerNaves()).rejects.toThrow("Falló la base de datos");
    });

});