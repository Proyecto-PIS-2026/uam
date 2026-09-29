// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { actualizarPrecio, cargarPublicacionesMiMercado } from "./acciones";

const mocks = vi.hoisted(() => ({
    obtenerOperadorActual: vi.fn(),
    obtenerOperadorPorId: vi.fn(),
    actualizarPrecioPublicacion: vi.fn(),
    obtenerPublicacionesDeOperador: vi.fn(),
    mapearPublicacionesMiMercado: vi.fn(),
    revalidatePath: vi.fn(),
}));

vi.mock("../../usuarios/operadores/operador-actual", () => ({
    obtenerOperadorActual: mocks.obtenerOperadorActual,
    obtenerOperadorPorId: mocks.obtenerOperadorPorId,
}));

vi.mock("./consultas-mi-mercado", () => ({
    actualizarPrecioPublicacion: mocks.actualizarPrecioPublicacion,
    obtenerPublicacionesDeOperador: mocks.obtenerPublicacionesDeOperador,
}));

vi.mock("./mapear-publicaciones", () => ({
    mapearPublicacionesMiMercado: mocks.mapearPublicacionesMiMercado,
}));

vi.mock("next/cache", () => ({
    revalidatePath: mocks.revalidatePath,
}));

describe("actualizarPrecio", () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it("usa el primer operador cuando no se indica un ID", async () => {
        mocks.obtenerOperadorActual.mockResolvedValue({ id: 13, nombreFantasia: "Frutas & Más" });

        await actualizarPrecio(5, 110);

        expect(mocks.obtenerOperadorActual).toHaveBeenCalledOnce();
        expect(mocks.obtenerOperadorPorId).not.toHaveBeenCalled();
        expect(mocks.actualizarPrecioPublicacion).toHaveBeenCalledExactlyOnceWith(13, 5, 110);
        expect(mocks.revalidatePath).toHaveBeenCalledWith("/mi-mercado");
        expect(mocks.revalidatePath).toHaveBeenCalledWith("/mi-mercado/Frutas%20%26%20M%C3%A1s");
        expect(mocks.revalidatePath).toHaveBeenCalledWith("/operadores/Frutas%20%26%20M%C3%A1s");
    });

    it("usa el operador indicado y revalida su mercado", async () => {
        mocks.obtenerOperadorPorId.mockResolvedValue({ id: 37, nombreFantasia: "Operador 37" });

        await actualizarPrecio(5, 110, 37);

        expect(mocks.obtenerOperadorPorId).toHaveBeenCalledExactlyOnceWith(37);
        expect(mocks.obtenerOperadorActual).not.toHaveBeenCalled();
        expect(mocks.actualizarPrecioPublicacion).toHaveBeenCalledExactlyOnceWith(37, 5, 110);
        expect(mocks.revalidatePath).toHaveBeenCalledWith("/mi-mercado/Operador%2037");
        expect(mocks.revalidatePath).toHaveBeenCalledWith("/operadores/Operador%2037");
    });

    it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
        "rechaza el ID de operador inválido %s",
        async (operadorId) => {
            await expect(actualizarPrecio(5, 110, operadorId)).rejects.toThrow("El ID del operador");

            expect(mocks.obtenerOperadorActual).not.toHaveBeenCalled();
            expect(mocks.obtenerOperadorPorId).not.toHaveBeenCalled();
            expect(mocks.actualizarPrecioPublicacion).not.toHaveBeenCalled();
            expect(mocks.revalidatePath).not.toHaveBeenCalled();
        },
    );

    it("rechaza un operador que no existe", async () => {
        mocks.obtenerOperadorPorId.mockResolvedValue(null);

        await expect(actualizarPrecio(5, 110, 99)).rejects.toThrow("No se encontró el operador");

        expect(mocks.obtenerOperadorPorId).toHaveBeenCalledExactlyOnceWith(99);
        expect(mocks.actualizarPrecioPublicacion).not.toHaveBeenCalled();
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });
});

describe("cargarPublicacionesMiMercado", () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it("consulta nuevamente las publicaciones del operador seleccionado", async () => {
        const relaciones = [{ id: 2, publicacion: { id: 8 } }];
        const publicaciones = [{ id: 8 }];
        mocks.obtenerOperadorPorId.mockResolvedValue({ id: 13 });
        mocks.obtenerPublicacionesDeOperador.mockResolvedValue(relaciones);
        mocks.mapearPublicacionesMiMercado.mockReturnValue(publicaciones);

        await expect(cargarPublicacionesMiMercado(13)).resolves.toEqual(publicaciones);

        expect(mocks.obtenerOperadorPorId).toHaveBeenCalledExactlyOnceWith(13);
        expect(mocks.obtenerPublicacionesDeOperador).toHaveBeenCalledExactlyOnceWith(13);
        expect(mocks.mapearPublicacionesMiMercado).toHaveBeenCalledExactlyOnceWith(relaciones);
    });

    it("no consulta publicaciones de un operador inexistente", async () => {
        mocks.obtenerOperadorPorId.mockResolvedValue(null);

        await expect(cargarPublicacionesMiMercado(99)).rejects.toThrow("No se encontró el operador");

        expect(mocks.obtenerPublicacionesDeOperador).not.toHaveBeenCalled();
    });
});
