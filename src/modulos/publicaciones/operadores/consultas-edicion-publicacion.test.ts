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
        envases: consulta(),
        kilos: consulta(),
        categorias: consulta(),
        calibres: consulta(),
        paises: consulta(),
    };
});

vi.mock("../../../infraestructura/persistencia/prisma/db", () => ({
    db: { orm: { public: {
        Especie: mocks.especies,
        Variedad: mocks.variedades,
        Envase: mocks.envases,
        KilosEmpaquetado: mocks.kilos,
        Categoria: mocks.categorias,
        Calibre: mocks.calibres,
        Pais: mocks.paises,
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
        mocks.envases.all.mockResolvedValue([{ id: 424, nombreEnvase: "Cajon" }, { id: 321, nombreEnvase: "Bolsa" }]);
        mocks.kilos.all.mockResolvedValue([{ id: 1, valor: "2" }, { id: 11, valor: "10-12" }]);
        mocks.categorias.all.mockResolvedValue([
            { id: 3, nombreCategoria: "I", especieId: null },
            { id: 4, nombreCategoria: "Primera", especieId: 909 },
            { id: 5, nombreCategoria: "Categoría de especie inactiva", especieId: 777 },
        ]);
        mocks.calibres.all.mockResolvedValue([
            { id: 501, codigoCalibre: "EX", nombreCalibre: "EXTRA" },
            { id: 502, codigoCalibre: "SV", nombreCalibre: "SIN VARIACION" },
        ]);
        mocks.paises.all.mockResolvedValue([
            { id: 117, nombrePais: "Argentina" },
            { id: 218, nombrePais: "Uruguay" },
        ]);
    });

    it("filtra especies y variedades activas y ofrece todos los atributos globales", async () => {
        await expect(obtenerOpcionesEdicionPublicacion()).resolves.toEqual({
            especies: [{ id: 401, nombre: "Lechuga" }, { id: 909, nombre: "Manzana" }],
            variedades: [
                { id: 7, nombre: "Crespa", especieId: 401 },
                { id: 22, nombre: "Gala", especieId: 909 },
            ],
            envases: [{ id: 424, nombre: "Cajon" }, { id: 321, nombre: "Bolsa" }],
            kilos: [{ id: 1, nombre: "2" }, { id: 11, nombre: "10-12" }],
            categorias: [
                { id: 5, nombre: "Categoría de especie inactiva", especieId: 777 },
                { id: 3, nombre: "I", especieId: null },
                { id: 4, nombre: "Primera", especieId: 909 },
            ],
            calibres: [
                { id: 501, nombre: "EX - EXTRA" },
                { id: 502, nombre: "SV - SIN VARIACION" },
            ],
            paises: [{ id: 117, nombre: "Argentina" }, { id: 218, nombre: "Uruguay" }],
        });
        expect(mocks.especies.where).toHaveBeenCalledWith({ especieActiva: true });
        expect(mocks.variedades.where).toHaveBeenCalledWith({ variedadActiva: true });
        expect(mocks.envases.where).not.toHaveBeenCalled();
        expect(mocks.kilos.where).not.toHaveBeenCalled();
        expect(mocks.categorias.where).not.toHaveBeenCalled();
        expect(mocks.calibres.where).not.toHaveBeenCalled();
        expect(mocks.paises.where).not.toHaveBeenCalled();
        expect(mocks.paises.select).toHaveBeenCalledWith("id", "nombrePais");
    });

    it("consulta los siete catálogos con el orden adecuado", async () => {
        await obtenerOpcionesEdicionPublicacion();

        const ordenamientos = [
            { consulta: mocks.especies, campo: "nombreEspecie" },
            { consulta: mocks.variedades, campo: "nombreVariedad" },
            { consulta: mocks.envases, campo: "id" },
            { consulta: mocks.kilos, campo: "id" },
            { consulta: mocks.categorias, campo: "nombreCategoria" },
            { consulta: mocks.calibres, campo: "nombreCalibre" },
            { consulta: mocks.paises, campo: "nombrePais" },
        ];
        for (const { consulta, campo } of ordenamientos) {
            expect(consulta.all).toHaveBeenCalledOnce();
            expect(consulta.orderBy).toHaveBeenCalledOnce();
            const asc = vi.fn();
            consulta.orderBy.mock.calls[0][0]({ [campo]: { asc } });
            expect(asc).toHaveBeenCalledOnce();
        }
    });

    it("ordena los nombres visibles sin perder relaciones ni el orden de los nuevos catálogos", async () => {
        mocks.especies.all.mockResolvedValue([
            { id: 909, nombreEspecie: "Ñame" },
            { id: 401, nombreEspecie: "Ácelga" },
        ]);
        mocks.variedades.all.mockResolvedValue([
            { id: 22, nombreVariedad: "Zeta", especieId: 401 },
            { id: 7, nombreVariedad: "Ámbar", especieId: 401 },
        ]);
        mocks.envases.all.mockResolvedValue([
            { id: 424, nombreEnvase: "Cajon" },
            { id: 321, nombreEnvase: "Bolsa" },
        ]);
        mocks.categorias.all.mockResolvedValue([
            { id: 4, nombreCategoria: "Zeta", especieId: 401 },
            { id: 3, nombreCategoria: "Álfa", especieId: null },
        ]);
        mocks.calibres.all.mockResolvedValue([
            { id: 501, codigoCalibre: "Z", nombreCalibre: "ALTO" },
            { id: 502, codigoCalibre: "A", nombreCalibre: "BAJO" },
        ]);
        mocks.paises.all.mockResolvedValue([
            { id: 218, nombrePais: "Uruguay" },
            { id: 117, nombrePais: "Argentina" },
        ]);

        const opciones = await obtenerOpcionesEdicionPublicacion();

        expect(opciones.especies.map((opcion) => opcion.id)).toEqual([401, 909]);
        expect(opciones.variedades.map((opcion) => opcion.id)).toEqual([7, 22]);
        expect(opciones.variedades[0].especieId).toBe(401);
        expect(opciones.envases.map((opcion) => opcion.id)).toEqual([424, 321]);
        expect(opciones.kilos.map((opcion) => opcion.nombre)).toEqual(["2", "10-12"]);
        expect(opciones.categorias.map((opcion) => opcion.id)).toEqual([3, 4]);
        expect(opciones.calibres.map((opcion) => opcion.nombre)).toEqual(["A - BAJO", "Z - ALTO"]);
        expect(opciones.paises.map((opcion) => opcion.id)).toEqual([117, 218]);
    });

    it("mantiene todas las categorías, calibres y países aunque no haya especies activas", async () => {
        mocks.especies.all.mockResolvedValue([]);

        await expect(obtenerOpcionesEdicionPublicacion()).resolves.toEqual({
            especies: [], variedades: [],
            envases: [{ id: 424, nombre: "Cajon" }, { id: 321, nombre: "Bolsa" }],
            kilos: [{ id: 1, nombre: "2" }, { id: 11, nombre: "10-12" }],
            categorias: [
                { id: 5, nombre: "Categoría de especie inactiva", especieId: 777 },
                { id: 3, nombre: "I", especieId: null },
                { id: 4, nombre: "Primera", especieId: 909 },
            ],
            calibres: [
                { id: 501, nombre: "EX - EXTRA" },
                { id: 502, nombre: "SV - SIN VARIACION" },
            ],
            paises: [{ id: 117, nombre: "Argentina" }, { id: 218, nombre: "Uruguay" }],
        });
    });

    it("preserva calibres generales, incluidos cero y doble cero, sin repetir el nombre", async () => {
        mocks.calibres.all.mockResolvedValue([
            { id: 601, codigoCalibre: "0", nombreCalibre: "0" },
            { id: 602, codigoCalibre: "00", nombreCalibre: "00" },
            { id: 603, codigoCalibre: "Primera", nombreCalibre: "Primera" },
        ]);
        const opciones = await obtenerOpcionesEdicionPublicacion();
        expect(opciones.calibres).toEqual([
            { id: 601, nombre: "0" }, { id: 602, nombre: "00" }, { id: 603, nombre: "Primera" },
        ]);
    });

    it("propaga el error de una consulta sin devolver un catálogo parcial", async () => {
        const error = new Error("No se pudieron consultar los envases.");
        mocks.envases.all.mockRejectedValue(error);

        await expect(obtenerOpcionesEdicionPublicacion()).rejects.toBe(error);
    });

    it("propaga un fallo al consultar los países sin devolver opciones parciales", async () => {
        const error = new Error("No se pudo consultar los países.");
        mocks.paises.all.mockRejectedValue(error);

        await expect(obtenerOpcionesEdicionPublicacion()).rejects.toBe(error);
    });
});
