import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import PaginaMiMercadoProductor from "./page";

const redireccionSimulada = vi.hoisted(() => vi.fn(() => {
    throw new Error("REDIRECCION");
}));

vi.mock("next/navigation", () => ({ redirect: redireccionSimulada }));
vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({ obtenerSesion: vi.fn() }));

describe("/mi-mercado/productor", () => {
    beforeEach(() => vi.clearAllMocks());
    afterEach(cleanup);

    it("informa al productor que su mercado no esta implementado", async () => {
        vi.mocked(obtenerSesion).mockResolvedValue({ usuarioId: 1, rol: "PRODUCTOR", expiraEn: 2000000000 });

        render(await PaginaMiMercadoProductor());

        expect(screen.getByRole("heading", { name: "Mi mercado" })).toBeInTheDocument();
        expect(screen.getByText("Mi mercado de productor aún no está implementado."))
            .toBeInTheDocument();
        expect(redireccionSimulada).not.toHaveBeenCalled();
    });

    it("redirige a iniciar sesion si no hay usuario autenticado", async () => {
        vi.mocked(obtenerSesion).mockResolvedValue(null);

        await expect(PaginaMiMercadoProductor()).rejects.toThrow("REDIRECCION");
        expect(redireccionSimulada).toHaveBeenCalledExactlyOnceWith("/iniciar-sesion");
    });

    it.each(["OPERADOR", "ADMINISTRADOR"] as const)(
        "no muestra el mercado de productor al rol %s",
        async (rol) => {
            vi.mocked(obtenerSesion).mockResolvedValue({ usuarioId: 1, rol, expiraEn: 2000000000 });

            await expect(PaginaMiMercadoProductor()).rejects.toThrow("REDIRECCION");
            expect(redireccionSimulada).toHaveBeenCalledExactlyOnceWith("/inicio");
        },
    );
});
