import { readdir } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerEspeciesConPublicacionesActivas, obtenerEspeciesInicio } from "./consultas-inicio";

// Mocks hoisteados: se declaran antes de que vi.mock los referencie internamente
const mockDb = vi.hoisted(() => ({
    query: vi.fn(),
}));

const mockFs = vi.hoisted(() => ({
    readdir: vi.fn(),
}));

// En el archivo original se hace un import de db con ruta relativa
// (el alias "@/..." no resuelve en el entorno de test, así que en
// consultas-inicio.ts el import también debe usar la ruta relativa)
vi.mock("../../../infraestructura/persistencia/prisma/db", () => ({
    db: {
        runtime: () => ({
            query: mockDb.query,
        }),
        sql: {
            public: {
                especie: {
                    columns: {
                        id: "id",
                        nombreEspecie: "nombreEspecie",
                        fotoEspecie: "fotoEspecie",
                    },
                },
            },
        },
        raw: {
            sql: () => ({
                returnsRow: () => ({
                    build: () => ({}),
                }),
            }),
        },
    },
}));

vi.mock("node:fs/promises", () => ({
    readdir: mockFs.readdir,
    default: {
        readdir: mockFs.readdir,
    },
}));

describe("consultas-inicio", () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("obtenerEspeciesConPublicacionesActivas", () => {

        it("obtiene las especies con publicaciones activas", async () => {
            const especiesMock = [
                { idEspecie: 1, nombreEspecie: "Banana", fotoEspecie: null, cantidadOperadores: 3 },
                { idEspecie: 2, nombreEspecie: "Manzana", fotoEspecie: null, cantidadOperadores: 5 },
            ];

            mockDb.query.mockResolvedValue(especiesMock);

            const resultado = await obtenerEspeciesConPublicacionesActivas();

            expect(resultado).toEqual(especiesMock);
            expect(mockDb.query).toHaveBeenCalled();
        });

    });

    describe("obtenerEspeciesInicio", () => {

        it("devuelve las especies con su foto genérica", async () => {
            mockDb.query.mockResolvedValue([
                { idEspecie: 1, nombreEspecie: "Banana", fotoEspecie: null, cantidadOperadores: 3 },
            ]);
            mockFs.readdir.mockResolvedValue(["banana.webp"]);

            const resultado = await obtenerEspeciesInicio();

            expect(resultado).toEqual([
                { idEspecie: 1, nombreEspecie: "Banana", cantidadOperadores: 3, fotoGenerica: "/generico/banana.webp" },
            ]);
        });

        it("devuelve null cuando la especie no tiene foto genérica", async () => {
            mockDb.query.mockResolvedValue([
                { idEspecie: 1, nombreEspecie: "Banana", fotoEspecie: null, cantidadOperadores: 3 },
            ]);
            mockFs.readdir.mockResolvedValue([]);

            const resultado = await obtenerEspeciesInicio();

            expect(resultado).toEqual([
                { idEspecie: 1, nombreEspecie: "Banana", cantidadOperadores: 3, fotoGenerica: null },
            ]);
        });

        it("usa una foto PNG cuando no existe WEBP", async () => {
            mockDb.query.mockResolvedValue([
                { idEspecie: 1, nombreEspecie: "Manzana", fotoEspecie: null, cantidadOperadores: 5 },
            ]);
            mockFs.readdir.mockResolvedValue(["manzana.png"]);

            const resultado = await obtenerEspeciesInicio();

            expect(resultado[0].fotoGenerica).toBe("/generico/manzana.png");
        });

        it("usa una foto JPG cuando no existe WEBP ni PNG", async () => {
            mockDb.query.mockResolvedValue([
                { idEspecie: 1, nombreEspecie: "Sandía", fotoEspecie: null, cantidadOperadores: 1 },
            ]);
            mockFs.readdir.mockResolvedValue(["sandia.jpg"]);

            const resultado = await obtenerEspeciesInicio();

            expect(resultado[0].fotoGenerica).toBe("/generico/sandia.jpg");
        });

        it("ignora tildes y mayúsculas al buscar el archivo genérico", async () => {
            mockDb.query.mockResolvedValue([
                { idEspecie: 1, nombreEspecie: "Sandía", fotoEspecie: null, cantidadOperadores: 1 },
            ]);
            mockFs.readdir.mockResolvedValue(["sandia.webp"]);

            const resultado = await obtenerEspeciesInicio();

            expect(resultado[0].fotoGenerica).toBe("/generico/sandia.webp");
        });

        it("devuelve fotoGenerica null si la carpeta /public/generico no existe (ENOENT)", async () => {
            mockDb.query.mockResolvedValue([
                { idEspecie: 1, nombreEspecie: "Kiwi", fotoEspecie: null, cantidadOperadores: 1 },
            ]);

            const error = Object.assign(new Error("no existe"), { code: "ENOENT" });
            mockFs.readdir.mockRejectedValue(error);

            const resultado = await obtenerEspeciesInicio();

            expect(resultado[0].fotoGenerica).toBeNull();
        });

        it("propaga otros errores de filesystem distintos de ENOENT", async () => {
            mockDb.query.mockResolvedValue([]);

            const error = Object.assign(new Error("permiso denegado"), { code: "EACCES" });
            mockFs.readdir.mockRejectedValue(error);

            await expect(obtenerEspeciesInicio()).rejects.toThrow("permiso denegado");
        });

    });

});