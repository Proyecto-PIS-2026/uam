import { beforeEach, describe, expect, it, vi } from "vitest";
import { cerrarSesionYVolverAlInicio } from "./accionCerrarSesion";
 
const mocks = vi.hoisted(() => ({
    cerrarSesion: vi.fn(),
    redirect: vi.fn(),
}));
 
vi.mock("./sesiones", () => ({
    cerrarSesion: mocks.cerrarSesion,
}));
 
vi.mock("next/navigation", () => ({
    redirect: mocks.redirect,
}));

describe("cerrarSesionYVolverAlInicio", () => {
 
    beforeEach(() => {
        mocks.cerrarSesion.mockReset();
        mocks.redirect.mockReset();
    });
 
    it("cierra la sesión", async () => {
        await cerrarSesionYVolverAlInicio();
 
        expect(mocks.cerrarSesion).toHaveBeenCalledOnce();
    });
 
    it("redirige a la vista pública", async () => {
        await cerrarSesionYVolverAlInicio();
 
        expect(mocks.redirect).toHaveBeenCalledWith("/inicio");
    });

    it("cierra la sesión antes de redirigir", async () => {
        const orden: string[] = [];
        mocks.cerrarSesion.mockImplementation(async () => {
            orden.push("cerrar");
        });
        mocks.redirect.mockImplementation(() => {
            orden.push("redirigir");
        });
 
        await cerrarSesionYVolverAlInicio();
 
        expect(orden).toEqual(["cerrar", "redirigir"]);
    });

    it("no redirige si falla el cierre de la sesión", async () => {
        mocks.cerrarSesion.mockRejectedValue(new Error("Falló el cierre"));
 
        await expect(cerrarSesionYVolverAlInicio()).rejects.toThrow("Falló el cierre");
        expect(mocks.redirect).not.toHaveBeenCalled();
    });
 
});