import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { obtenerPublicacionesMiMercadoProductor } from "@/modulos/publicaciones/mi-mercado/consultas-mi-mercado-productor";
import MiMercadoProductor from "@/modulos/publicaciones/mi-mercado/componentes/MiMercadoProductor";
import PaginaMiMercadoProductor from "./page";

const redireccionSimulada = vi.hoisted(() => vi.fn(() => {
    throw new Error("REDIRECCION");
}));

vi.mock("next/navigation", () => ({ redirect: redireccionSimulada }));
vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({ obtenerSesion: vi.fn() }));
vi.mock("@/modulos/publicaciones/mi-mercado/consultas-mi-mercado-productor", () => ({ obtenerPublicacionesMiMercadoProductor: vi.fn() }));
vi.mock("@/modulos/publicaciones/mi-mercado/componentes/MiMercadoProductor", () => ({
    default: vi.fn(({ nombreProductor }: { nombreProductor: string }) => <main><h1>Mi Mercado</h1><p>{nombreProductor}</p></main>),
}));

describe("/mi-mercado/productor", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(obtenerPublicacionesMiMercadoProductor).mockResolvedValue({
            productor: { id: 21, usuarioId: 1, nombreFantasia: "Mi huerta" },
            publicaciones: [],
        });
    });
    afterEach(cleanup);

    it("muestra el mercado del productor autenticado", async () => {
        vi.mocked(obtenerSesion).mockResolvedValue({ usuarioId: 1, rol: "PRODUCTOR", expiraEn: 2000000000 });

        render(await PaginaMiMercadoProductor());

        expect(screen.getByRole("heading", { name: "Mi Mercado" })).toBeInTheDocument();
        expect(screen.getByText("Mi huerta")).toBeInTheDocument();
        expect(obtenerPublicacionesMiMercadoProductor).toHaveBeenCalledExactlyOnceWith();
        expect(vi.mocked(MiMercadoProductor).mock.calls[0][0]).toEqual({ publicaciones: [], nombreProductor: "Mi huerta" });
        expect(redireccionSimulada).not.toHaveBeenCalled();
    });

    it("redirige a iniciar sesion si no hay usuario autenticado", async () => {
        vi.mocked(obtenerSesion).mockResolvedValue(null);

        await expect(PaginaMiMercadoProductor()).rejects.toThrow("REDIRECCION");
        expect(redireccionSimulada).toHaveBeenCalledExactlyOnceWith("/iniciar-sesion");
        expect(obtenerPublicacionesMiMercadoProductor).not.toHaveBeenCalled();
        expect(MiMercadoProductor).not.toHaveBeenCalled();
    });

    it.each(["OPERADOR", "ADMINISTRADOR"] as const)(
        "no muestra el mercado de productor al rol %s",
        async (rol) => {
            vi.mocked(obtenerSesion).mockResolvedValue({ usuarioId: 1, rol, expiraEn: 2000000000 });

            await expect(PaginaMiMercadoProductor()).rejects.toThrow("REDIRECCION");
            expect(redireccionSimulada).toHaveBeenCalledExactlyOnceWith("/inicio");
            expect(obtenerPublicacionesMiMercadoProductor).not.toHaveBeenCalled();
            expect(MiMercadoProductor).not.toHaveBeenCalled();
        },
    );

    it("propaga un fallo de carga sin mostrar datos de otro mercado", async () => {
        vi.mocked(obtenerSesion).mockResolvedValue({ usuarioId: 1, rol: "PRODUCTOR", expiraEn: 2000000000 });
        vi.mocked(obtenerPublicacionesMiMercadoProductor).mockRejectedValue(new Error("No disponible"));

        await expect(PaginaMiMercadoProductor()).rejects.toThrow("No disponible");
        expect(MiMercadoProductor).not.toHaveBeenCalled();
    });
});
