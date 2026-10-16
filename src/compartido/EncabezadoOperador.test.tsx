import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DatosSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { obtenerFotoPerfilOperadorPorUsuarioId } from "@/modulos/identidad-acceso/autenticacion/consultasAutenticacion";
import EncabezadoOperador from "./EncabezadoOperador";

vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({ obtenerSesion: vi.fn() }));
vi.mock("@/modulos/identidad-acceso/autenticacion/consultasAutenticacion", () => ({ obtenerFotoPerfilOperadorPorUsuarioId: vi.fn() }));
vi.mock("./HeaderPublico", () => ({
    default: ({ sesion }: { sesion: DatosSesion | null }) => (
        <header>{sesion?.rol ?? "SIN_SESION"}</header>
    ),
}));

describe("EncabezadoOperador", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(obtenerFotoPerfilOperadorPorUsuarioId).mockResolvedValue(null);
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
            } else {
                expect(obtenerFotoPerfilOperadorPorUsuarioId).not.toHaveBeenCalled();
            }
        },
    );

    it("muestra la navegacion publica cuando no existe sesion", async () => {
        vi.mocked(obtenerSesion).mockResolvedValue(null);

        render(await EncabezadoOperador());

        expect(screen.getByRole("banner")).toHaveTextContent("SIN_SESION");
    });
});
