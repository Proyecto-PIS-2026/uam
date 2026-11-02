import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const obtenerSesion = vi.hoisted(() => vi.fn());
vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({ obtenerSesion }));

describe("comprobación de sesión", () => {
    beforeEach(() => { obtenerSesion.mockReset(); });
    afterEach(() => { vi.restoreAllMocks(); });

    it.each(["OPERADOR", "PRODUCTOR", "ADMINISTRADOR"])("responde sin datos personales cuando la sesión %s sigue vigente", async (rol) => {
        obtenerSesion.mockResolvedValue({ usuarioId: 10, rol, expiraEn: 2000000000 });

        const respuesta = await GET();

        expect(respuesta.status).toBe(204);
        expect(await respuesta.text()).toBe("");
        expect(respuesta.headers.get("Cache-Control")).toBe("no-store");
        expect(respuesta.headers.get("Vary")).toBe("Cookie");
        expect(respuesta.headers.has("Set-Cookie")).toBe(false);
        expect(obtenerSesion).toHaveBeenCalledOnce();
    });

    it("devuelve 401 cuando la sesión no es válida sin modificar cookies", async () => {
        obtenerSesion.mockResolvedValue(null);

        const respuesta = await GET();

        expect(respuesta.status).toBe(401);
        expect(await respuesta.json()).toEqual({ errores: ["Tu sesión finalizó. Volvé a iniciar sesión."] });
        expect(respuesta.headers.get("Cache-Control")).toBe("no-store");
        expect(respuesta.headers.has("Set-Cookie")).toBe(false);
    });

    it("distingue una falla temporal de una sesión inválida sin exponer el error interno", async () => {
        const error = new Error("postgres connection refused");
        obtenerSesion.mockRejectedValue(error);
        const registrarError = vi.spyOn(console, "error").mockImplementation(() => {});

        const respuesta = await GET();

        expect(respuesta.status).toBe(503);
        expect(await respuesta.json()).toEqual({ errores: ["No se pudo verificar tu sesión. Intentá nuevamente."] });
        expect(respuesta.headers.get("Cache-Control")).toBe("no-store");
        expect(respuesta.headers.has("Set-Cookie")).toBe(false);
        expect(registrarError).toHaveBeenCalledWith("No se pudo verificar la sesión:", error);
    });
});
