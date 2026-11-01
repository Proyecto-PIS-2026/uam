import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";
import { cerrarSesion, obtenerSesion } from "../autenticacion/sesiones";
import { RUTA_INICIO_SESION } from "../autenticacion/rutas-sesion";
import { ErrorAutorizacion } from "./controles";
import { controlarSesionEnAccion, exigirSesionEnAccion } from "./control-acciones";

vi.mock("../autenticacion/sesiones", () => ({ obtenerSesion: vi.fn(), cerrarSesion: vi.fn() }));
vi.mock("next/navigation", () => ({
    redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT"); }),
}));

beforeEach(() => {
    vi.clearAllMocks();
});

it.each([
    ["control de permisos", () => controlarSesionEnAccion(vi.fn().mockRejectedValue(new ErrorAutorizacion(401, "Iniciá sesión.")))],
    ["control de sesión", () => exigirSesionEnAccion()],
] as const)("espera a eliminar la cookie antes de redirigir el %s", async (_, accion) => {
    vi.mocked(obtenerSesion).mockResolvedValue(null);
    let completarCierre!: () => void;
    vi.mocked(cerrarSesion).mockImplementationOnce(() => new Promise<void>((resolve) => {
        completarCierre = resolve;
    }));

    const resultado = accion();
    await vi.waitFor(() => expect(cerrarSesion).toHaveBeenCalledOnce());
    expect(redirect).not.toHaveBeenCalled();
    completarCierre();

    await expect(resultado).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledExactlyOnceWith(RUTA_INICIO_SESION);
});

describe("controlarSesionEnAccion", () => {
    it("conserva el resultado de una autorización válida", async () => {
        const sesion = { usuarioId: 4, rol: "ADMINISTRADOR", expiraEn: 2000000000 };
        const control = vi.fn().mockResolvedValue(sesion);

        await expect(controlarSesionEnAccion(control)).resolves.toBe(sesion);
        expect(control).toHaveBeenCalledExactlyOnceWith();
        expect(redirect).not.toHaveBeenCalled();
        expect(cerrarSesion).not.toHaveBeenCalled();
    });

    it("redirige una sesión inválida antes de serializar el error de la acción", async () => {
        const control = vi.fn().mockRejectedValue(new ErrorAutorizacion(401, "Iniciá sesión para continuar."));

        await expect(controlarSesionEnAccion(control)).rejects.toThrow("NEXT_REDIRECT");
        expect(redirect).toHaveBeenCalledExactlyOnceWith(RUTA_INICIO_SESION);
        expect(cerrarSesion).toHaveBeenCalledExactlyOnceWith();
        expect(vi.mocked(cerrarSesion).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(redirect).mock.invocationCallOrder[0]);
    });

    it.each([
        new ErrorAutorizacion(403, "No tenés permiso."),
        new Error("No pudimos verificar tu sesión. Intentá nuevamente."),
        Object.assign(new Error("Error de otro servicio"), { status: 401 }),
    ])("conserva los demás errores sin cerrar la sesión: %s", async (error) => {
        await expect(controlarSesionEnAccion(vi.fn().mockRejectedValue(error))).rejects.toBe(error);
        expect(redirect).not.toHaveBeenCalled();
        expect(cerrarSesion).not.toHaveBeenCalled();
    });
});

describe("exigirSesionEnAccion", () => {
    it("devuelve la sesión autenticada", async () => {
        const sesion = { usuarioId: 4, rol: "OPERADOR" as const, expiraEn: 2000000000 };
        vi.mocked(obtenerSesion).mockResolvedValue(sesion);

        await expect(exigirSesionEnAccion()).resolves.toBe(sesion);
        expect(redirect).not.toHaveBeenCalled();
        expect(cerrarSesion).not.toHaveBeenCalled();
    });

    it("redirige cuando el usuario ya no tiene una sesión válida", async () => {
        vi.mocked(obtenerSesion).mockResolvedValue(null);

        await expect(exigirSesionEnAccion()).rejects.toThrow("NEXT_REDIRECT");
        expect(redirect).toHaveBeenCalledExactlyOnceWith(RUTA_INICIO_SESION);
        expect(cerrarSesion).toHaveBeenCalledExactlyOnceWith();
        expect(vi.mocked(cerrarSesion).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(redirect).mock.invocationCallOrder[0]);
    });

    it("propaga una falla de la base de datos sin cerrar la sesión", async () => {
        const error = new Error("No pudimos verificar tu sesión. Intentá nuevamente.");
        vi.mocked(obtenerSesion).mockRejectedValue(error);

        await expect(exigirSesionEnAccion()).rejects.toBe(error);
        expect(redirect).not.toHaveBeenCalled();
        expect(cerrarSesion).not.toHaveBeenCalled();
    });
});
