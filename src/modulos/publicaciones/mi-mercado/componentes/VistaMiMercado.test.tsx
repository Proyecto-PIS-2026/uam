// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import VistaMiMercado from "./VistaMiMercado";

const mocks = vi.hoisted(() => ({
    obtenerOperadorActual: vi.fn(),
    obtenerOperadorPorId: vi.fn(),
    obtenerPublicaciones: vi.fn(),
    obtenerOpcionesEdicion: vi.fn(),
    miMercado: vi.fn(() => null),
    notFound: vi.fn(() => { throw new Error("NEXT_HTTP_ERROR_FALLBACK;404"); }),
}));

vi.mock("../../../usuarios/operadores/operador-actual", () => ({
    obtenerOperadorActual: mocks.obtenerOperadorActual,
    obtenerOperadorPorId: mocks.obtenerOperadorPorId,
}));

vi.mock("../consultas-mi-mercado", () => ({
    obtenerPublicacionesDeOperador: mocks.obtenerPublicaciones,
}));

vi.mock("../../operadores/consultas-edicion-publicacion", () => ({
    obtenerOpcionesEdicionPublicacion: mocks.obtenerOpcionesEdicion,
}));

vi.mock("./MiMercado", () => ({ default: mocks.miMercado }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));

const opcionesEdicion = {
    especies: [], variedades: [], presentaciones: [], categorias: [], calibres: [], paises: [],
};

describe("VistaMiMercado", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.obtenerOperadorActual.mockResolvedValue({ id: 13, usuarioId: 10, nombreFantasia: "Operador 13" });
        mocks.obtenerPublicaciones.mockResolvedValue([]);
        mocks.obtenerOpcionesEdicion.mockResolvedValue(opcionesEdicion);
    });

    it("usa el operador actual cuando no llega un ID", async () => {
        const vista = await VistaMiMercado({});

        expect(mocks.obtenerOperadorActual).toHaveBeenCalledOnce();
        expect(mocks.obtenerOperadorPorId).not.toHaveBeenCalled();
        expect(mocks.obtenerPublicaciones).toHaveBeenCalledExactlyOnceWith(13);
        expect(vista.type).toBe(mocks.miMercado);
        expect(vista.props.operadorId).toBe(13);
    });

    it("usa el operador indicado en la ruta", async () => {
        mocks.obtenerOperadorPorId.mockResolvedValue({ id: 37, usuarioId: 11, nombreFantasia: "Operador 37" });

        const vista = await VistaMiMercado({ operadorId: 37 });

        expect(mocks.obtenerOperadorPorId).toHaveBeenCalledExactlyOnceWith(37);
        expect(mocks.obtenerOperadorActual).not.toHaveBeenCalled();
        expect(mocks.obtenerPublicaciones).toHaveBeenCalledExactlyOnceWith(37);
        expect(vista.type).toBe(mocks.miMercado);
        expect(vista.props.operadorId).toBe(37);
    });

    it("responde 404 si el operador indicado no existe", async () => {
        mocks.obtenerOperadorPorId.mockResolvedValue(null);

        await expect(VistaMiMercado({ operadorId: 99 })).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
        expect(mocks.notFound).toHaveBeenCalledOnce();
        expect(mocks.obtenerPublicaciones).not.toHaveBeenCalled();
        expect(mocks.obtenerOpcionesEdicion).not.toHaveBeenCalled();
    });
});
