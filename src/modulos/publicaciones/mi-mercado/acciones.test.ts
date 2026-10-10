// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { actualizarPrecio, cargarPublicacionesMiMercado } from "./acciones";
import { PublicacionNoEncontradaError } from "./consultas-mi-mercado";

const sesionMock = vi.hoisted(() => vi.fn());
vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({ obtenerSesion: sesionMock }));

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
        sesionMock.mockResolvedValue({ usuarioId: 10, rol: "OPERADOR", expiraEn: 2000000000 });
    });

    it("usa el primer operador cuando no se indica un ID", async () => {
        mocks.obtenerOperadorActual.mockResolvedValue({ id: 13, usuarioId: 10, nombreFantasia: "Frutas & Más" });

        await actualizarPrecio(5, 110);

        expect(mocks.obtenerOperadorActual).toHaveBeenCalledOnce();
        expect(mocks.obtenerOperadorPorId).not.toHaveBeenCalled();
        expect(mocks.actualizarPrecioPublicacion).toHaveBeenCalledExactlyOnceWith(13, 5, 110);
        expect(mocks.revalidatePath).not.toHaveBeenCalledWith("/mi-mercado");
        expect(mocks.revalidatePath).not.toHaveBeenCalledWith("/mi-mercado/Frutas%20%26%20M%C3%A1s");
        expect(mocks.revalidatePath).toHaveBeenCalledWith("/operadores/Frutas%20%26%20M%C3%A1s");
    });

    it("usa el operador indicado y revalida las vistas públicas", async () => {
        mocks.obtenerOperadorPorId.mockResolvedValue({ id: 37, usuarioId: 10, nombreFantasia: "Operador 37" });

        await actualizarPrecio(5, 110, 37);

        expect(mocks.obtenerOperadorPorId).toHaveBeenCalledExactlyOnceWith(37);
        expect(mocks.obtenerOperadorActual).not.toHaveBeenCalled();
        expect(mocks.actualizarPrecioPublicacion).toHaveBeenCalledExactlyOnceWith(37, 5, 110);
        expect(mocks.revalidatePath).not.toHaveBeenCalledWith("/mi-mercado/Operador%2037");
        expect(mocks.revalidatePath).toHaveBeenCalledWith("/operadores/Operador%2037");
    });

    it("no informa un fallo de precio si falla la revalidación después de guardarlo", async () => {
        mocks.obtenerOperadorPorId.mockResolvedValue({ id: 37, usuarioId: 10, nombreFantasia: "Operador 37" });
        mocks.revalidatePath.mockImplementationOnce(() => { throw new Error("Falló la caché"); });
        const registrarError = vi.spyOn(console, "error").mockImplementation(() => {});

        try {
            await expect(actualizarPrecio(5, 110, 37)).resolves.toEqual({ publicacionEliminada: false });

            expect(mocks.actualizarPrecioPublicacion).toHaveBeenCalledExactlyOnceWith(37, 5, 110);
            expect(mocks.revalidatePath).toHaveBeenCalledTimes(4);
            expect(registrarError).toHaveBeenCalledOnce();
        } finally {
            registrarError.mockRestore();
        }
    });

    it("mantiene el error cuando el precio no llegó a guardarse", async () => {
        mocks.obtenerOperadorPorId.mockResolvedValue({ id: 37, usuarioId: 10, nombreFantasia: "Operador 37" });
        mocks.actualizarPrecioPublicacion.mockRejectedValue(new Error("Error de base de datos"));

        await expect(actualizarPrecio(5, 110, 37)).rejects.toThrow("Error de base de datos");
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("informa la baja concurrente sin revalidar un precio no guardado", async () => {
        mocks.obtenerOperadorPorId.mockResolvedValue({ id: 37, usuarioId: 10, nombreFantasia: "Operador 37" });
        mocks.actualizarPrecioPublicacion.mockRejectedValue(new PublicacionNoEncontradaError());

        await expect(actualizarPrecio(5, 110, 37)).resolves.toEqual({ publicacionEliminada: true });
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
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
        sesionMock.mockResolvedValue({ usuarioId: 10, rol: "OPERADOR", expiraEn: 2000000000 });
    });

    it("consulta nuevamente las publicaciones del operador seleccionado", async () => {
        const relaciones = [{ id: 2, publicacion: { id: 8 } }];
        const publicaciones = [{ id: 8 }];
        mocks.obtenerOperadorPorId.mockResolvedValue({ id: 13, usuarioId: 10 });
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

describe("autorización de acciones de Mi Mercado", () => {
    beforeEach(() => vi.clearAllMocks());

    it.each([null, "PRODUCTOR", "ADMINISTRADOR"] as const)("impide actualizar el precio con sesión %s", async (rol) => {
        sesionMock.mockResolvedValue(rol ? { usuarioId: 10, rol, expiraEn: 2000000000 } : null);
        mocks.obtenerOperadorPorId.mockResolvedValue({ id: 13, usuarioId: 10, nombreFantasia: "Propio" });
        await expect(actualizarPrecio(5, 110, 13)).rejects.toThrow(rol ? "No tiene permisos" : "Debe iniciar sesión.");
        expect(mocks.actualizarPrecioPublicacion).not.toHaveBeenCalled();
    });

    it("impide leer la gestión y cambiar precios de otro operador", async () => {
        sesionMock.mockResolvedValue({ usuarioId: 10, rol: "OPERADOR", expiraEn: 2000000000 });
        mocks.obtenerOperadorPorId.mockResolvedValue({ id: 37, usuarioId: 70, nombreFantasia: "Ajeno" });
        await expect(cargarPublicacionesMiMercado(37)).rejects.toThrow("No tiene permisos");
        await expect(actualizarPrecio(5, 110, 37)).rejects.toThrow("No tiene permisos");
        expect(mocks.obtenerPublicacionesDeOperador).not.toHaveBeenCalled();
        expect(mocks.actualizarPrecioPublicacion).not.toHaveBeenCalled();
    });
});
