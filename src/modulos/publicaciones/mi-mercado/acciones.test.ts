// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { actualizarPrecio } from "./acciones";

const mocks = vi.hoisted(() => ({
    obtenerOperadorActual: vi.fn(),
    obtenerOperadorPorId: vi.fn(),
    actualizarPrecioPublicacion: vi.fn(),
    revalidatePath: vi.fn(),
}));

vi.mock("../../usuarios/operadores/operador-actual", () => ({
    obtenerOperadorActual: mocks.obtenerOperadorActual,
    obtenerOperadorPorId: mocks.obtenerOperadorPorId,
}));

vi.mock("./consultas-mi-mercado", () => ({
    actualizarPrecioPublicacion: mocks.actualizarPrecioPublicacion,
}));

vi.mock("next/cache", () => ({
    revalidatePath: mocks.revalidatePath,
}));

describe("actualizarPrecio", () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it("usa el primer operador cuando no se indica un ID", async () => {
        mocks.obtenerOperadorActual.mockResolvedValue({ id: 13 });

        await actualizarPrecio(5, 110);

        expect(mocks.obtenerOperadorActual).toHaveBeenCalledOnce();
        expect(mocks.obtenerOperadorPorId).not.toHaveBeenCalled();
        expect(mocks.actualizarPrecioPublicacion).toHaveBeenCalledExactlyOnceWith(13, 5, 110);
        expect(mocks.revalidatePath).toHaveBeenCalledWith("/mi-mercado");
        expect(mocks.revalidatePath).toHaveBeenCalledWith("/mi-mercado/13");
    });

    it("usa el operador indicado y revalida su mercado", async () => {
        mocks.obtenerOperadorPorId.mockResolvedValue({ id: 37 });

        await actualizarPrecio(5, 110, 37);

        expect(mocks.obtenerOperadorPorId).toHaveBeenCalledExactlyOnceWith(37);
        expect(mocks.obtenerOperadorActual).not.toHaveBeenCalled();
        expect(mocks.actualizarPrecioPublicacion).toHaveBeenCalledExactlyOnceWith(37, 5, 110);
        expect(mocks.revalidatePath).toHaveBeenCalledWith("/mi-mercado/37");
        expect(mocks.revalidatePath).toHaveBeenCalledWith("/operadores/37");
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
