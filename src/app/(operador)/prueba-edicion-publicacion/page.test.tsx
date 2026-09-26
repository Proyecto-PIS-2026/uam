import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OpcionesEdicionPublicacion } from "../../../modulos/publicaciones/operadores/consultas-edicion-publicacion";
import Page from "./page";

const mocks = vi.hoisted(() => ({
    obtenerOpciones: vi.fn<() => Promise<OpcionesEdicionPublicacion>>(),
    demo: vi.fn(),
}));

vi.mock("../../../modulos/publicaciones/operadores/consultas-edicion-publicacion", () => ({
    obtenerOpcionesEdicionPublicacion: mocks.obtenerOpciones,
}));

vi.mock("../../../modulos/publicaciones/operadores/componentes/PruebaEdicionPublicacion", () => ({
    default: mocks.demo,
}));

describe("Page de prueba de edición de publicaciones", () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it("consulta las opciones y se las entrega a la vista de prueba", async () => {
        const opciones: OpcionesEdicionPublicacion = {
            especies: [{ id: 501, nombre: "Manzana" }],
            variedades: [{ id: 601, nombre: "Gala", especieId: 501 }],
            presentaciones: [{ id: 701, nombre: "Cajon", variedadId: 601 }],
            categorias: [{ id: 801, nombre: "I", especieId: null }],
            calibres: [{ id: 901, nombre: "G - GRANDE" }],
        };
        mocks.obtenerOpciones.mockResolvedValue(opciones);

        const contenido = await Page();

        expect(mocks.obtenerOpciones).toHaveBeenCalledExactlyOnceWith();
        expect(contenido.type).toBe(mocks.demo);
        expect(contenido.props.opciones).toBe(opciones);
    });

    it("delega el catálogo vacío a la vista sin agregar datos ficticios", async () => {
        const opciones: OpcionesEdicionPublicacion = {
            especies: [], variedades: [], presentaciones: [], categorias: [], calibres: [],
        };
        mocks.obtenerOpciones.mockResolvedValue(opciones);

        const contenido = await Page();

        expect(contenido.props.opciones).toBe(opciones);
    });

    it("propaga el error de la consulta sin sustituirla por un catálogo fijo", async () => {
        const error = new Error("No se pudo consultar el catálogo");
        mocks.obtenerOpciones.mockRejectedValue(error);

        await expect(Page()).rejects.toBe(error);
        expect(mocks.obtenerOpciones).toHaveBeenCalledOnce();
    });
});
