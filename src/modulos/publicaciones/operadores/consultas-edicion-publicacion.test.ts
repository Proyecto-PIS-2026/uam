import { beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerOpcionesEdicionPublicacion } from "./consultas-edicion-publicacion";

const mocks = vi.hoisted(() => {
    const consulta = () => ({
        select: vi.fn(),
        where: vi.fn(),
        orderBy: vi.fn(),
        all: vi.fn(),
    });
    return {
        especies: consulta(),
        variedades: consulta(),
        presentaciones: consulta(),
        categorias: consulta(),
        calibres: consulta(),
    };
});

vi.mock("../../../infraestructura/persistencia/prisma/db", () => ({
    db: { orm: { public: {
        Especie: mocks.especies,
        Variedad: mocks.variedades,
        Presentacion: mocks.presentaciones,
        Categoria: mocks.categorias,
        Calibre: mocks.calibres,
    } } },
}));

describe("obtenerOpcionesEdicionPublicacion", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        for (const consulta of Object.values(mocks)) {
            consulta.select.mockReturnThis();
            consulta.where.mockReturnThis();
            consulta.orderBy.mockReturnThis();
        }
        mocks.especies.all.mockResolvedValue([
            { id: 401, nombreEspecie: "Lechuga" },
            { id: 909, nombreEspecie: "Manzana" },
        ]);
        mocks.variedades.all.mockResolvedValue([
            { id: 7, nombreVariedad: "Crespa", especieId: 401 },
            { id: 22, nombreVariedad: "Gala", especieId: 909 },
            { id: 8, nombreVariedad: "Variedad de especie inactiva", especieId: 777 },
        ]);
        mocks.presentaciones.all.mockResolvedValue([
            { id: 424, nombrePresentacion: "Cajon", variedadId: 22 },
            { id: 321, nombrePresentacion: "Docena", variedadId: 7 },
            { id: 322, nombrePresentacion: "Presentación de especie inactiva", variedadId: 8 },
            { id: 323, nombrePresentacion: "Presentación de variedad inactiva", variedadId: 999 },
        ]);
        mocks.categorias.all.mockResolvedValue([
            { id: 3, nombreCategoria: "I", especieId: null },
            { id: 4, nombreCategoria: "Primera", especieId: 909 },
            { id: 5, nombreCategoria: "Categoría de especie inactiva", especieId: 777 },
        ]);
        mocks.calibres.all.mockResolvedValue([
            { id: 501, codigoCalibre: "EX", nombreCalibre: "EXTRA" },
            { id: 502, codigoCalibre: "SV", nombreCalibre: "SIN VARIACION" },
        ]);
    });

    it("mapea los IDs reales y conserva solo relaciones de especies y variedades activas", async () => {
        await expect(obtenerOpcionesEdicionPublicacion()).resolves.toEqual({
            especies: [{ id: 401, nombre: "Lechuga" }, { id: 909, nombre: "Manzana" }],
            variedades: [
                { id: 7, nombre: "Crespa", especieId: 401 },
                { id: 22, nombre: "Gala", especieId: 909 },
            ],
            presentaciones: [
                { id: 424, nombre: "Cajon", variedadId: 22 },
                { id: 321, nombre: "Docena", variedadId: 7 },
            ],
            categorias: [
                { id: 3, nombre: "I", especieId: null },
                { id: 4, nombre: "Primera", especieId: 909 },
            ],
            calibres: [
                { id: 501, nombre: "EX - EXTRA" },
                { id: 502, nombre: "SV - SIN VARIACION" },
            ],
        });
        expect(mocks.especies.where).toHaveBeenCalledWith({ especieActiva: true });
        expect(mocks.variedades.where).toHaveBeenCalledWith({ variedadActiva: true });
        expect(mocks.presentaciones.where).toHaveBeenCalledWith({ presentacionActiva: true });
        expect(mocks.categorias.where).not.toHaveBeenCalled();
        expect(mocks.calibres.where).not.toHaveBeenCalled();
    });

    it("consulta los cinco catálogos ordenados por nombre", async () => {
        await obtenerOpcionesEdicionPublicacion();

        const ordenamientos = [
            { consulta: mocks.especies, campo: "nombreEspecie" },
            { consulta: mocks.variedades, campo: "nombreVariedad" },
            { consulta: mocks.presentaciones, campo: "nombrePresentacion" },
            { consulta: mocks.categorias, campo: "nombreCategoria" },
            { consulta: mocks.calibres, campo: "nombreCalibre" },
        ];
        for (const { consulta, campo } of ordenamientos) {
            expect(consulta.all).toHaveBeenCalledOnce();
            expect(consulta.orderBy).toHaveBeenCalledOnce();
            const asc = vi.fn();
            consulta.orderBy.mock.calls[0][0]({ [campo]: { asc } });
            expect(asc).toHaveBeenCalledOnce();
        }
    });

    it("mantiene categorías generales y calibres aunque no haya especies activas", async () => {
        mocks.especies.all.mockResolvedValue([]);

        await expect(obtenerOpcionesEdicionPublicacion()).resolves.toEqual({
            especies: [], variedades: [], presentaciones: [],
            categorias: [{ id: 3, nombre: "I", especieId: null }],
            calibres: [
                { id: 501, nombre: "EX - EXTRA" },
                { id: 502, nombre: "SV - SIN VARIACION" },
            ],
        });
    });

    it("propaga el error de una consulta sin devolver un catálogo parcial", async () => {
        const error = new Error("No se pudo consultar las presentaciones.");
        mocks.presentaciones.all.mockRejectedValue(error);

        await expect(obtenerOpcionesEdicionPublicacion()).rejects.toBe(error);
    });
});
