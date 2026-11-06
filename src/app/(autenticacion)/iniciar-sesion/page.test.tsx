import { cleanup, render, screen } from "@/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import PaginaInicioSesion, { metadata as metadatos } from "./page";

vi.mock("./acciones", () => ({ iniciarSesion: vi.fn(async () => ({})) }));
vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({ obtenerSesion: vi.fn() }));
vi.mock("next/navigation", () => ({
    redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT"); }),
}));

describe("PaginaInicioSesion", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(obtenerSesion).mockResolvedValue(null);
    });
    afterEach(cleanup);

    it("presenta el titulo y el formulario cuando no hay sesión", async () => {
        render(await PaginaInicioSesion({ searchParams: Promise.resolve({}) }));

        expect(screen.getByRole("heading", { name: "Iniciar sesión", level: 1 }))
            .toBeInTheDocument();
        expect(screen.getByLabelText("Correo electrónico o nombre de usuario"))
            .toBeInTheDocument();
        expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
        expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
        expect(metadatos.title).toBe("Iniciar sesión | UAM");
        expect(redirect).not.toHaveBeenCalled();
    });

    it.each([
        { rol: "OPERADOR", destino: "/mi-mercado" },
        { rol: "PRODUCTOR", destino: "/mi-mercado/productor" },
        { rol: "ADMINISTRADOR", destino: "/inicio" },
    ] as const)("impide que $rol vuelva al formulario con su sesión vigente", async ({ rol, destino }) => {
        vi.mocked(obtenerSesion).mockResolvedValue({ usuarioId: 10, rol, expiraEn: 2_000_000_000 });

        await expect(PaginaInicioSesion({ searchParams: Promise.resolve({ segundoFactor: "vencido" }) }))
            .rejects.toThrow("NEXT_REDIRECT");

        expect(redirect).toHaveBeenCalledExactlyOnceWith(destino);
        expect(screen.queryByRole("heading", { name: "Iniciar sesión" })).not.toBeInTheDocument();
    });

    it("propaga el error de sesión sin mostrar el formulario", async () => {
        const error = new Error("No pudimos verificar tu sesión.");
        vi.mocked(obtenerSesion).mockRejectedValue(error);

        await expect(PaginaInicioSesion({ searchParams: Promise.resolve({}) })).rejects.toBe(error);

        expect(redirect).not.toHaveBeenCalled();
        expect(screen.queryByLabelText("Contraseña")).not.toBeInTheDocument();
    });

    it.each(["cancelado", "vencido", "bloqueado"])("muestra el motivo de retorno del segundo factor: %s", async (segundoFactor) => {
        render(await PaginaInicioSesion({ searchParams: Promise.resolve({ segundoFactor }) }));
        expect(screen.getAllByRole("status").some((elemento) => elemento.textContent?.trim())).toBe(true);
    });

    it("no muestra mensajes arbitrarios enviados en la URL", async () => {
        render(await PaginaInicioSesion({ searchParams: Promise.resolve({ segundoFactor: "mensaje-no-permitido" }) }));
        expect(screen.queryByText("mensaje-no-permitido")).not.toBeInTheDocument();
    });
});
