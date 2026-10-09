// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import VistaMiMercado from "./VistaMiMercado";

const mocks = vi.hoisted(() => ({
    obtenerOperadorActual: vi.fn(),
    obtenerOperadorPorNombre: vi.fn(),
    obtenerPublicaciones: vi.fn(),
    obtenerOpcionesEdicion: vi.fn(),
    obtenerConfiguracion: vi.fn(),
    miMercado: vi.fn(() => null),
    notFound: vi.fn(() => { throw new Error("NEXT_HTTP_ERROR_FALLBACK;404"); }),
}));

vi.mock("../../../usuarios/operadores/operador-actual", () => ({
    obtenerOperadorActual: mocks.obtenerOperadorActual,
    obtenerOperadorPorNombre: mocks.obtenerOperadorPorNombre,
}));

vi.mock("../consultas-mi-mercado", () => ({
    obtenerPublicacionesDeOperador: mocks.obtenerPublicaciones,
}));

vi.mock("../../operadores/consultas-edicion-publicacion", () => ({
    obtenerOpcionesEdicionPublicacion: mocks.obtenerOpcionesEdicion,
}));

vi.mock("./MiMercado", () => ({ default: mocks.miMercado }));
vi.mock("@/modulos/administracion/consulta-configuracion", () => ({
    obtenerConfiguracion: mocks.obtenerConfiguracion,
}));
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
        mocks.obtenerConfiguracion.mockResolvedValue("25");
    });

    it("usa el operador actual cuando no llega un nombre", async () => {
        const vista = await VistaMiMercado({});

        expect(mocks.obtenerOperadorActual).toHaveBeenCalledOnce();
        expect(mocks.obtenerOperadorPorNombre).not.toHaveBeenCalled();
        expect(mocks.obtenerPublicaciones).toHaveBeenCalledExactlyOnceWith(13);
        expect(vista.type).toBe(mocks.miMercado);
        expect(vista.props.operadorId).toBe(13);
        expect(vista.props.nombreOperador).toBe("Operador 13");
        expect(vista.props.incrementoPrecio).toBe(25);
    });

    it("usa el operador indicado en la ruta", async () => {
        mocks.obtenerOperadorPorNombre.mockResolvedValue({ id: 37, usuarioId: 11, nombreFantasia: "Frutas & Más" });

        const vista = await VistaMiMercado({ operadorNombre: "Frutas & Más" });

        expect(mocks.obtenerOperadorPorNombre).toHaveBeenCalledExactlyOnceWith("Frutas & Más");
        expect(mocks.obtenerOperadorActual).not.toHaveBeenCalled();
        expect(mocks.obtenerPublicaciones).toHaveBeenCalledExactlyOnceWith(37);
        expect(vista.type).toBe(mocks.miMercado);
        expect(vista.props.operadorId).toBe(37);
        expect(vista.props.nombreOperador).toBe("Frutas & Más");
        expect(vista.props.incrementoPrecio).toBe(25);
    });

    it("responde 404 si el operador indicado no existe", async () => {
        mocks.obtenerOperadorPorNombre.mockResolvedValue(null);

        await expect(VistaMiMercado({ operadorNombre: "No existe" })).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
        expect(mocks.obtenerOperadorPorNombre).toHaveBeenCalledExactlyOnceWith("No existe");
        expect(mocks.notFound).toHaveBeenCalledOnce();
        expect(mocks.obtenerPublicaciones).not.toHaveBeenCalled();
        expect(mocks.obtenerOpcionesEdicion).not.toHaveBeenCalled();
    });
});
