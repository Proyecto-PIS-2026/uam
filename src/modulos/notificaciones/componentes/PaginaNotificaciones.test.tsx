import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PaginaNotificaciones from "@/app/(autenticado)/notificaciones/page";
import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { redirect } from "next/navigation";

vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({ obtenerSesion: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(() => { throw new Error("Redirección"); }) }));
vi.mock("./VistaNotificaciones", () => ({ default: ({ usuarioId }: { usuarioId: number }) => <div>Notificaciones del usuario {usuarioId}</div> }));

describe("Página de notificaciones", () => {
    beforeEach(() => vi.clearAllMocks());

    it.each(["ADMINISTRADOR", "OPERADOR", "PRODUCTOR"] as const)("permite consultar los avisos propios al rol %s", async (rol) => {
        vi.mocked(obtenerSesion).mockResolvedValue({ usuarioId: 7, rol, expiraEn: 1900000000 });
        render(await PaginaNotificaciones());
        expect(screen.getByText("Notificaciones del usuario 7")).toBeVisible();
        expect(redirect).not.toHaveBeenCalled();
    });

    it("redirige al inicio de sesión a una visita sin autenticar", async () => {
        vi.mocked(obtenerSesion).mockResolvedValue(null);
        await expect(PaginaNotificaciones()).rejects.toThrow("Redirección");
        expect(redirect).toHaveBeenCalledWith("/iniciar-sesion");
    });
});
