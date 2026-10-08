import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RolUsuario } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import EncabezadoOperador from "./EncabezadoOperador";

vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({ obtenerSesion: vi.fn() }));
vi.mock("./HeaderPublico", () => ({
    default: ({ rolUsuario }: { rolUsuario: RolUsuario | null }) => (
        <header>{rolUsuario ?? "SIN_SESION"}</header>
    ),
}));

describe("EncabezadoOperador", () => {
    beforeEach(() => vi.resetAllMocks());
    afterEach(cleanup);

    it.each(["OPERADOR", "PRODUCTOR", "ADMINISTRADOR"] as const)(
        "usa el rol %s de la sesion para configurar la navegacion",
        async (rol) => {
            vi.mocked(obtenerSesion).mockResolvedValue({ usuarioId: 1, rol, expiraEn: 2000000000 });

            render(await EncabezadoOperador());

            expect(screen.getByRole("banner")).toHaveTextContent(rol);
        },
    );

    it("muestra la navegacion publica cuando no existe sesion", async () => {
        vi.mocked(obtenerSesion).mockResolvedValue(null);

        render(await EncabezadoOperador());

        expect(screen.getByRole("banner")).toHaveTextContent("SIN_SESION");
    });
});
