import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import Page from "./page";

const mocks = vi.hoisted(() => {
    const consulta = () => ({
        select: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        include: vi.fn().mockReturnThis(),
        first: vi.fn(),
        all: vi.fn(),
    });
    return {
        notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }),
        vinculos: consulta(),
        calibres: consulta(),
        presentaciones: consulta(),
        categorias: consulta(),
    };
});

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
    db: { orm: { public: {
        PublicacionOperador: mocks.vinculos,
        Calibre: mocks.calibres,
        Presentacion: mocks.presentaciones,
        Categoria: mocks.categorias,
    } } },
}));

const publicacion = {
    precio: "45.50",
    foto: null,
    categoriaId: 2,
    calibreId: 3,
    presentacionId: 11,
    publicacionDisponible: true,
    presentacion: {
        variedad: {
            nombreVariedad: "Golden",
            especieId: 5,
            variedadActiva: true,
            especie: { id: 5, nombreEspecie: "Manzana", especieActiva: true },
        },
    },
};

describe("página de edición de publicación", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv("NODE_ENV", "test");
    });

    it.each(["0", "-2", "1.5", "abc", "9007199254740992"])(
        "envía a notFound cuando el identificador %s no es válido",
        async (id) => {
            await expect(Page({ params: Promise.resolve({ id }) })).rejects.toThrow("NOT_FOUND");
            expect(mocks.notFound).toHaveBeenCalledOnce();
        },
    );

    it("prepara la publicación y limita sus catálogos a las opciones permitidas", async () => {
        mocks.vinculos.first.mockResolvedValue({ id: 7, publicacion });
        mocks.calibres.all.mockResolvedValue([
            { id: 1, codigoCalibre: "EG" },
            { id: 2, codigoCalibre: "G" },
            { id: 3, codigoCalibre: "M" },
            { id: 4, codigoCalibre: "C" },
            { id: 5, codigoCalibre: "SV" },
            { id: 6, codigoCalibre: "EX" },
        ]);
        mocks.presentaciones.where.mockImplementation(function (this: unknown, filtro: (query: unknown) => unknown) {
            filtro({ presentacionActiva: { eq: vi.fn() } });
            return mocks.presentaciones;
        });
        mocks.presentaciones.all.mockResolvedValue([
            { id: 11, nombrePresentacion: "Bandeja", presentacionActiva: true, variedad: { nombreVariedad: "Golden", variedadActiva: true, especie: { especieActiva: true } } },
            { id: 12, nombrePresentacion: "Caja Cartón", presentacionActiva: true, variedad: { nombreVariedad: "Gala", variedadActiva: true, especie: { especieActiva: true } } },
            { id: 13, nombrePresentacion: "Caja", presentacionActiva: true, variedad: { nombreVariedad: "Gala", variedadActiva: true, especie: { especieActiva: true } } },
            { id: 14, nombrePresentacion: "Bolsa", presentacionActiva: true, variedad: { nombreVariedad: "Gala", variedadActiva: true, especie: { especieActiva: true } } },
            { id: 15, nombrePresentacion: "Caja", presentacionActiva: true, variedad: { nombreVariedad: "Gala", variedadActiva: false, especie: { especieActiva: true } } },
        ]);
        mocks.categorias.all.mockResolvedValue([
            { id: 20, nombreCategoria: "E", especieId: null },
            { id: 21, nombreCategoria: "I", especieId: null },
            { id: 22, nombreCategoria: "II", especieId: null },
            { id: 23, nombreCategoria: "I", especieId: 99 },
        ]);

        const elemento = await Page({ params: Promise.resolve({ id: "7" }) });
        const props = (elemento as ReactElement<{ inicial: unknown; presentaciones: unknown[]; calibres: unknown[]; categorias: unknown[] }>).props;

        expect(props.inicial).toEqual({
            precio: "45.50",
            foto: null,
            categoriaId: 2,
            calibreId: 3,
            presentacionId: 11,
            disponible: true,
        });
        expect(props.presentaciones).toEqual([
            { id: 11, nombrePresentacion: "Bandeja", nombreVariedad: "Golden" },
            { id: 13, nombrePresentacion: "Caja", nombreVariedad: "Gala" },
        ]);
        expect(props.calibres).toEqual([
            { id: 1, nombreCalibre: "Extragrande - EG" },
            { id: 2, nombreCalibre: "Grande - G" },
            { id: 3, nombreCalibre: "Mediano - M" },
            { id: 4, nombreCalibre: "Chico - C" },
            { id: 5, nombreCalibre: "Sin Variación" },
        ]);
        expect(props.categorias).toEqual([
            { id: 20, nombreCategoria: "Especial - E" },
            { id: 21, nombreCategoria: "Primera - I" },
            { id: 22, nombreCategoria: "Segunda - II" },
        ]);
    });
});
