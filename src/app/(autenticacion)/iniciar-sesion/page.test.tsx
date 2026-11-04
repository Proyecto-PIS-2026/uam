import { cleanup, render, screen } from "@/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import PaginaInicioSesion, { metadata as metadatos } from "./page";

vi.mock("./acciones", () => ({ iniciarSesion: vi.fn(async () => ({})) }));

describe("PaginaInicioSesion", () => {
    afterEach(cleanup);

    it("presenta el titulo y el formulario para los tres tipos de usuario", async () => {
        render(await PaginaInicioSesion({ searchParams: Promise.resolve({}) }));

        expect(screen.getByRole("heading", { name: "Iniciar sesión", level: 1 }))
            .toBeInTheDocument();
        expect(screen.getByLabelText("Correo electrónico o nombre de usuario"))
            .toBeInTheDocument();
        expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
        expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
        expect(metadatos.title).toBe("Iniciar sesión | UAM");
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
