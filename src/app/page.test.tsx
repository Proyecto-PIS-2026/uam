// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { redirect } from "next/navigation";
import Home from "./page";

vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({ obtenerSesion: vi.fn() }));
vi.mock("next/navigation", () => ({
    redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT"); }),
}));

describe("entrada principal", () => {
    beforeEach(() => vi.clearAllMocks());

    it.each([null, "ADMINISTRADOR", "PRODUCTOR", "OPERADOR"] as const)(
        "envía %s a su página principal",
        async (rol) => {
            vi.mocked(obtenerSesion).mockResolvedValue(rol === null ? null : {
                usuarioId: 10, rol, expiraEn: 2000000000,
            });

            await expect(Home()).rejects.toThrow("NEXT_REDIRECT");
            expect(redirect).toHaveBeenCalledExactlyOnceWith(rol === "OPERADOR" ? "/mi-mercado" : "/inicio");
        },
    );

    it("propaga un error de sesión sin enviarlo al mercado público", async () => {
        vi.mocked(obtenerSesion).mockRejectedValue(new Error("Sesión no disponible"));

        await expect(Home()).rejects.toThrow("Sesión no disponible");
        expect(redirect).not.toHaveBeenCalled();
    });
});