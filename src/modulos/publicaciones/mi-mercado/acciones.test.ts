// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { actualizarPrecio, incrementarPrecio, cargarPublicacionesMiMercado } from "./acciones";
import { PublicacionNoEncontradaError } from "./consultas-mi-mercado";
import { ErrorAutorizacion } from "@/modulos/identidad-acceso/autorizacion/controles";
import { redirect } from "next/navigation";
import { RUTA_INICIO_SESION } from "@/modulos/identidad-acceso/autenticacion/rutas-sesion";

const sesionMock = vi.hoisted(() => vi.fn());
const cerrarSesionMock = vi.hoisted(() => vi.fn());
vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({ obtenerSesion: sesionMock, cerrarSesion: cerrarSesionMock }));
vi.mock("next/navigation", () => ({
    redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT"); }),
}));

const mocks = vi.hoisted(() => ({
    obtenerOperadorAutorizado: vi.fn(),
    actualizarPrecioPublicacion: vi.fn(),
    incrementarPrecioPublicacion: vi.fn(),
    obtenerPublicacionesDeOperador: vi.fn(),
    mapearPublicacionesMiMercado: vi.fn(),
    revalidatePath: vi.fn(),
}));

vi.mock("../../usuarios/operadores/operador-actual", () => ({
    obtenerOperadorAutorizado: mocks.obtenerOperadorAutorizado,
}));

vi.mock("./consultas-mi-mercado", () => ({
    actualizarPrecioPublicacion: mocks.actualizarPrecioPublicacion,
    incrementarPrecioPublicacion: mocks.incrementarPrecioPublicacion,
    ConflictoPublicacionError: class extends Error {},
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
        mocks.actualizarPrecioPublicacion.mockResolvedValue({ fecha: "2026-10-10T16:30:00Z", precio: 110, version: 2 });
    });

    it("impide guardar un precio sin permiso y conserva la sesión válida", async () => {
        mocks.obtenerOperadorAutorizado.mockRejectedValue(new ErrorAutorizacion(403, "Acceso denegado."));
        await expect(actualizarPrecio(5, 110, 13)).rejects.toMatchObject({ status: 403 });
        expect(mocks.actualizarPrecioPublicacion).not.toHaveBeenCalled();
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
        expect(redirect).not.toHaveBeenCalled();
    });

    it("conserva el precio ausente al guardar desde la edición rápida", async () => {
        mocks.obtenerOperadorAutorizado.mockResolvedValue({ id: 13, usuarioId: 10, nombreFantasia: "Frutas & Más" });
        mocks.actualizarPrecioPublicacion.mockResolvedValue({ fecha: "2026-10-10T16:30:00Z", precio: null, version: 2 });
        expect(await actualizarPrecio(5, null, 13, 1)).toEqual({ publicacionEliminada: false, fecha: "2026-10-10T16:30:00Z", precio: null, version: 2 });
        expect(mocks.actualizarPrecioPublicacion).toHaveBeenCalledExactlyOnceWith(13, 5, null, 1);
    });

    it("usa el operador autenticado cuando no se indica un ID", async () => {
        mocks.obtenerOperadorAutorizado.mockResolvedValue({ id: 13, usuarioId: 10, nombreFantasia: "Frutas & Más" });

        await actualizarPrecio(5, 110);

        expect(mocks.obtenerOperadorAutorizado).toHaveBeenCalledOnce();
        expect(mocks.actualizarPrecioPublicacion).toHaveBeenCalledExactlyOnceWith(13, 5, 110, undefined);
        expect(mocks.revalidatePath).not.toHaveBeenCalledWith("/mi-mercado");
        expect(mocks.revalidatePath).not.toHaveBeenCalledWith("/mi-mercado/Frutas%20%26%20M%C3%A1s");
        expect(mocks.revalidatePath).toHaveBeenCalledWith("/operadores/Frutas%20%26%20M%C3%A1s");
    });

    it("usa el operador indicado y revalida las vistas públicas", async () => {
        mocks.obtenerOperadorAutorizado.mockResolvedValue({ id: 37, usuarioId: 10, nombreFantasia: "Operador 37" });

        await actualizarPrecio(5, 110, 37);

        expect(mocks.obtenerOperadorAutorizado).toHaveBeenCalledExactlyOnceWith(37);
        expect(mocks.actualizarPrecioPublicacion).toHaveBeenCalledExactlyOnceWith(37, 5, 110, undefined);
        expect(mocks.revalidatePath).not.toHaveBeenCalledWith("/mi-mercado/Operador%2037");
        expect(mocks.revalidatePath).toHaveBeenCalledWith("/operadores/Operador%2037");
    });

    it("no informa un fallo de precio si falla la revalidación después de guardarlo", async () => {
        mocks.obtenerOperadorAutorizado.mockResolvedValue({ id: 37, usuarioId: 10, nombreFantasia: "Operador 37" });
        mocks.revalidatePath.mockImplementationOnce(() => { throw new Error("Falló la caché"); });
        const registrarError = vi.spyOn(console, "error").mockImplementation(() => {});

        try {
            await expect(actualizarPrecio(5, 110, 37)).resolves.toEqual({ publicacionEliminada: false, precio: 110, version: 2, fecha: "2026-10-10T16:30:00Z" });

            expect(mocks.actualizarPrecioPublicacion).toHaveBeenCalledExactlyOnceWith(37, 5, 110, undefined);
            expect(mocks.revalidatePath).toHaveBeenCalledTimes(4);
            expect(registrarError).toHaveBeenCalledOnce();
        } finally {
            registrarError.mockRestore();
        }
    });

    it("mantiene el error cuando el precio no llegó a guardarse", async () => {
        mocks.obtenerOperadorAutorizado.mockResolvedValue({ id: 37, usuarioId: 10, nombreFantasia: "Operador 37" });
        mocks.actualizarPrecioPublicacion.mockRejectedValue(new Error("Error de base de datos"));

        await expect(actualizarPrecio(5, 110, 37)).rejects.toThrow("Error de base de datos");
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("informa la baja concurrente sin revalidar un precio no guardado", async () => {
        mocks.obtenerOperadorAutorizado.mockResolvedValue({ id: 37, usuarioId: 10, nombreFantasia: "Operador 37" });
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
        sesionMock.mockResolvedValue({ usuarioId: 10, rol: "OPERADOR", expiraEn: 2000000000 });
    });

    it("no carga publicaciones de otro operador", async () => {
        mocks.obtenerOperadorAutorizado.mockRejectedValue(new ErrorAutorizacion(403, "Acceso denegado."));
        await expect(cargarPublicacionesMiMercado(37)).rejects.toMatchObject({ status: 403 });
        expect(mocks.obtenerPublicacionesDeOperador).not.toHaveBeenCalled();
    });

    it("consulta nuevamente las publicaciones del operador seleccionado", async () => {
        const relaciones = [{ id: 2, publicacion: { id: 8 } }];
        const publicaciones = [{ id: 8 }];
        mocks.obtenerOperadorAutorizado.mockResolvedValue({ id: 13, usuarioId: 10 });
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

describe("autorización de acciones de Mi Mercado", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mocks.obtenerOperadorAutorizado.mockResolvedValue({ id: 13, usuarioId: 10, nombreFantasia: "Propio" });
    });

    it.each(["PRODUCTOR", "ADMINISTRADOR"] as const)("impide actualizar el precio con sesión %s", async (rol) => {
        sesionMock.mockResolvedValue({ usuarioId: 10, rol, expiraEn: 2000000000 });
        await expect(actualizarPrecio(5, 110, 13)).rejects.toMatchObject({ status: 403 });
        expect(mocks.actualizarPrecioPublicacion).not.toHaveBeenCalled();
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
        expect(redirect).not.toHaveBeenCalled();
    });

    it.each([
        ["consulta", () => cargarPublicacionesMiMercado(13)],
        ["precio", () => actualizarPrecio(5, 110, 13)],
        ["incremento", () => incrementarPrecio(5, 10, 13)],
    ] as const)("redirige la %s cuando la sesión ya no es válida", async (_, accion) => {
        sesionMock.mockResolvedValue(null);

        await expect(accion()).rejects.toThrow("NEXT_REDIRECT");
        expect(redirect).toHaveBeenCalledExactlyOnceWith(RUTA_INICIO_SESION);
        expect(cerrarSesionMock).toHaveBeenCalledExactlyOnceWith();
        expect(mocks.obtenerOperadorAutorizado).not.toHaveBeenCalled();
        expect(mocks.obtenerPublicacionesDeOperador).not.toHaveBeenCalled();
        expect(mocks.actualizarPrecioPublicacion).not.toHaveBeenCalled();
        expect(mocks.incrementarPrecioPublicacion).not.toHaveBeenCalled();
    });

    it.each([
        ["consulta", () => cargarPublicacionesMiMercado(13)],
        ["precio", () => actualizarPrecio(5, 110, 13)],
        ["incremento", () => incrementarPrecio(5, 10, 13)],
    ] as const)("redirige la %s si el usuario se elimina entre las dos validaciones", async (_, accion) => {
        sesionMock.mockResolvedValue({ usuarioId: 10, rol: "OPERADOR", expiraEn: 2000000000 });
        mocks.obtenerOperadorAutorizado.mockRejectedValue(new ErrorAutorizacion(401, "Iniciá sesión."));

        await expect(accion()).rejects.toThrow("NEXT_REDIRECT");
        expect(redirect).toHaveBeenCalledExactlyOnceWith(RUTA_INICIO_SESION);
        expect(cerrarSesionMock).toHaveBeenCalledExactlyOnceWith();
        expect(mocks.obtenerPublicacionesDeOperador).not.toHaveBeenCalled();
        expect(mocks.actualizarPrecioPublicacion).not.toHaveBeenCalled();
        expect(mocks.incrementarPrecioPublicacion).not.toHaveBeenCalled();
    });

    it("comprueba el permiso de consulta antes de leer publicaciones", async () => {
        sesionMock.mockResolvedValue({ usuarioId: 70, rol: "OPERADOR", expiraEn: 2000000000 });
        await expect(cargarPublicacionesMiMercado(13)).rejects.toMatchObject({ status: 403 });
        expect(mocks.obtenerPublicacionesDeOperador).not.toHaveBeenCalled();
    });

    it("comprueba el permiso de modificación antes de cambiar precios", async () => {
        sesionMock.mockResolvedValue({ usuarioId: 70, rol: "OPERADOR", expiraEn: 2000000000 });
        await expect(actualizarPrecio(5, 110, 13)).rejects.toMatchObject({ status: 403 });
        expect(mocks.actualizarPrecioPublicacion).not.toHaveBeenCalled();
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });
});
