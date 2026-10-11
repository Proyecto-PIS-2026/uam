// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { actualizarPrecio, cargarPublicacionesMiMercado } from "./acciones";
import { PublicacionNoEncontradaError } from "./consultas-mi-mercado";
import { ErrorAutorizacion } from "@/modulos/identidad-acceso/autorizacion/controles";

const mocks = vi.hoisted(() => ({
    obtenerOperadorAutorizado: vi.fn(),
    actualizarPrecioPublicacion: vi.fn(),
    obtenerPublicacionesDeOperador: vi.fn(),
    mapearPublicacionesMiMercado: vi.fn(),
    revalidatePath: vi.fn(),
}));

vi.mock("../../usuarios/operadores/operador-actual", () => ({
    obtenerOperadorAutorizado: mocks.obtenerOperadorAutorizado,
}));

vi.mock("./consultas-mi-mercado", () => ({
    actualizarPrecioPublicacion: mocks.actualizarPrecioPublicacion,
    obtenerPublicacionesDeOperador: mocks.obtenerPublicacionesDeOperador,
    PublicacionNoEncontradaError: class extends Error {
        constructor() {
            super("La publicación no existe o no pertenece al operador.");
        }
    },
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
        mocks.actualizarPrecioPublicacion.mockResolvedValue("2026-10-10T16:30:00Z");
    });

    it.each([401, 403] as const)("impide guardar un precio con autorización %s", async (status) => {
        mocks.obtenerOperadorAutorizado.mockRejectedValue(new ErrorAutorizacion(status, "Acceso denegado."));
        await expect(actualizarPrecio(5, 110, 13)).rejects.toMatchObject({ status });
        expect(mocks.actualizarPrecioPublicacion).not.toHaveBeenCalled();
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("usa el operador autenticado cuando no se indica un ID", async () => {
        mocks.obtenerOperadorAutorizado.mockResolvedValue({ id: 13, nombreFantasia: "Frutas & Más" });

        await actualizarPrecio(5, 110);

        expect(mocks.obtenerOperadorAutorizado).toHaveBeenCalledOnce();
        expect(mocks.actualizarPrecioPublicacion).toHaveBeenCalledExactlyOnceWith(13, 5, 110);
        expect(mocks.revalidatePath).not.toHaveBeenCalledWith("/mi-mercado");
        expect(mocks.revalidatePath).not.toHaveBeenCalledWith("/mi-mercado/Frutas%20%26%20M%C3%A1s");
        expect(mocks.revalidatePath).toHaveBeenCalledWith("/operadores/Frutas%20%26%20M%C3%A1s");
    });

    it("usa el operador indicado y revalida las vistas públicas", async () => {
        mocks.obtenerOperadorAutorizado.mockResolvedValue({ id: 37, nombreFantasia: "Operador 37" });

        await actualizarPrecio(5, 110, 37);

        expect(mocks.obtenerOperadorAutorizado).toHaveBeenCalledExactlyOnceWith(37);
        expect(mocks.actualizarPrecioPublicacion).toHaveBeenCalledExactlyOnceWith(37, 5, 110);
        expect(mocks.revalidatePath).not.toHaveBeenCalledWith("/mi-mercado/Operador%2037");
        expect(mocks.revalidatePath).toHaveBeenCalledWith("/operadores/Operador%2037");
    });

    it("no informa un fallo de precio si falla la revalidación después de guardarlo", async () => {
        mocks.obtenerOperadorAutorizado.mockResolvedValue({ id: 37, nombreFantasia: "Operador 37" });
        mocks.revalidatePath.mockImplementationOnce(() => { throw new Error("Falló la caché"); });
        const registrarError = vi.spyOn(console, "error").mockImplementation(() => {});

        try {
            await expect(actualizarPrecio(5, 110, 37)).resolves.toEqual({ publicacionEliminada: false, fecha: "2026-10-10T16:30:00Z" });

            expect(mocks.actualizarPrecioPublicacion).toHaveBeenCalledExactlyOnceWith(37, 5, 110);
            expect(mocks.revalidatePath).toHaveBeenCalledTimes(4);
            expect(registrarError).toHaveBeenCalledOnce();
        } finally {
            registrarError.mockRestore();
        }
    });

    it("mantiene el error cuando el precio no llegó a guardarse", async () => {
        mocks.obtenerOperadorAutorizado.mockResolvedValue({ id: 37, nombreFantasia: "Operador 37" });
        mocks.actualizarPrecioPublicacion.mockRejectedValue(new Error("Error de base de datos"));

        await expect(actualizarPrecio(5, 110, 37)).rejects.toThrow("Error de base de datos");
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("informa la baja concurrente sin revalidar un precio no guardado", async () => {
        mocks.obtenerOperadorAutorizado.mockResolvedValue({ id: 37, nombreFantasia: "Operador 37" });
        mocks.actualizarPrecioPublicacion.mockRejectedValue(new PublicacionNoEncontradaError());

        await expect(actualizarPrecio(5, 110, 37)).resolves.toEqual({ publicacionEliminada: true });
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
        "rechaza el ID de operador inválido %s",
        async (operadorId) => {
            await expect(actualizarPrecio(5, 110, operadorId)).rejects.toThrow("El ID del operador");

            expect(mocks.obtenerOperadorAutorizado).not.toHaveBeenCalled();
            expect(mocks.actualizarPrecioPublicacion).not.toHaveBeenCalled();
            expect(mocks.revalidatePath).not.toHaveBeenCalled();
        },
    );

    it("rechaza un operador que no existe", async () => {
        mocks.obtenerOperadorAutorizado.mockRejectedValue(new Error("No se encontró el operador de Mi Mercado."));

        await expect(actualizarPrecio(5, 110, 99)).rejects.toThrow("No se encontró el operador");

        expect(mocks.obtenerOperadorAutorizado).toHaveBeenCalledExactlyOnceWith(99);
        expect(mocks.actualizarPrecioPublicacion).not.toHaveBeenCalled();
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });
});

describe("cargarPublicacionesMiMercado", () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it("no carga publicaciones de otro operador", async () => {
        mocks.obtenerOperadorAutorizado.mockRejectedValue(new ErrorAutorizacion(403, "Acceso denegado."));
        await expect(cargarPublicacionesMiMercado(37)).rejects.toMatchObject({ status: 403 });
        expect(mocks.obtenerPublicacionesDeOperador).not.toHaveBeenCalled();
    });

    it("consulta nuevamente las publicaciones del operador seleccionado", async () => {
        const relaciones = [{ id: 2, publicacion: { id: 8 } }];
        const publicaciones = [{ id: 8 }];
        mocks.obtenerOperadorAutorizado.mockResolvedValue({ id: 13 });
        mocks.obtenerPublicacionesDeOperador.mockResolvedValue(relaciones);
        mocks.mapearPublicacionesMiMercado.mockReturnValue(publicaciones);

        await expect(cargarPublicacionesMiMercado(13)).resolves.toEqual(publicaciones);

        expect(mocks.obtenerOperadorAutorizado).toHaveBeenCalledExactlyOnceWith(13);
        expect(mocks.obtenerPublicacionesDeOperador).toHaveBeenCalledExactlyOnceWith(13);
        expect(mocks.mapearPublicacionesMiMercado).toHaveBeenCalledExactlyOnceWith(relaciones);
    });

    it("no consulta publicaciones de un operador inexistente", async () => {
        mocks.obtenerOperadorAutorizado.mockRejectedValue(new Error("No se encontró el operador de Mi Mercado."));

        await expect(cargarPublicacionesMiMercado(99)).rejects.toThrow("No se encontró el operador");

        expect(mocks.obtenerPublicacionesDeOperador).not.toHaveBeenCalled();
    });
});