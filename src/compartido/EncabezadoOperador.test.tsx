import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DatosSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { obtenerFotoPerfilOperadorPorUsuarioId, obtenerFotoPerfilProductorPorUsuarioId } from "@/modulos/identidad-acceso/autenticacion/consultasAutenticacion";
import EncabezadoOperador from "./EncabezadoOperador";

vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({ obtenerSesion: vi.fn() }));
vi.mock("@/modulos/identidad-acceso/autenticacion/consultasAutenticacion", () => ({
    obtenerFotoPerfilOperadorPorUsuarioId: vi.fn(),
    obtenerFotoPerfilProductorPorUsuarioId: vi.fn(),
}));
vi.mock("./HeaderPublico", () => ({
    default: ({ sesion, fotoPerfil }: { sesion: DatosSesion | null; fotoPerfil: string | null }) => (
        <header data-foto-perfil={fotoPerfil}>{sesion?.rol ?? "SIN_SESION"}</header>
    ),
}));

describe("EncabezadoOperador", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(obtenerFotoPerfilOperadorPorUsuarioId).mockResolvedValue("/api/imagenes/operador");
        vi.mocked(obtenerFotoPerfilProductorPorUsuarioId).mockResolvedValue("/api/imagenes/productor");
    });
    afterEach(cleanup);

    it.each(["OPERADOR", "PRODUCTOR", "ADMINISTRADOR"] as const)(
        "usa el rol %s de la sesion para configurar la navegacion",
        async (rol) => {
            vi.mocked(obtenerSesion).mockResolvedValue({ usuarioId: 1, rol, expiraEn: 2000000000 });

            render(await EncabezadoOperador());

            expect(screen.getByRole("banner")).toHaveTextContent(rol);
            if (rol === "OPERADOR") {
                expect(obtenerFotoPerfilOperadorPorUsuarioId).toHaveBeenCalledExactlyOnceWith(1);
                expect(screen.getByRole("banner")).toHaveAttribute("data-foto-perfil", "/api/imagenes/operador");
            } else {
                expect(obtenerFotoPerfilOperadorPorUsuarioId).not.toHaveBeenCalled();
            }
            if (rol === "PRODUCTOR") {
                expect(obtenerFotoPerfilProductorPorUsuarioId).toHaveBeenCalledExactlyOnceWith(1);
                expect(screen.getByRole("banner")).toHaveAttribute("data-foto-perfil", "/api/imagenes/productor");
            } else {
                expect(obtenerFotoPerfilProductorPorUsuarioId).not.toHaveBeenCalled();
            }
            if (rol === "ADMINISTRADOR") {
                expect(screen.getByRole("banner")).not.toHaveAttribute("data-foto-perfil");
            }
        },
    );

    it("muestra la navegacion publica cuando no existe sesion", async () => {
        vi.mocked(obtenerSesion).mockResolvedValue(null);

        render(await EncabezadoOperador());

        expect(screen.getByRole("banner")).toHaveTextContent("SIN_SESION");
        expect(screen.getByRole("banner")).not.toHaveAttribute("data-foto-perfil");
        expect(obtenerFotoPerfilOperadorPorUsuarioId).not.toHaveBeenCalled();
        expect(obtenerFotoPerfilProductorPorUsuarioId).not.toHaveBeenCalled();
    });
});
