import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PaginaInicioSesion, { metadata as metadatos } from "./page";

vi.mock("./acciones", () => ({ iniciarSesion: vi.fn(async () => ({})) }));

describe("PaginaInicioSesion", () => {
    afterEach(cleanup);

    it("presenta el titulo y el formulario para los tres tipos de usuario", () => {
        render(<PaginaInicioSesion />);

        expect(screen.getByRole("heading", { name: "Iniciar sesión", level: 1 }))
            .toBeInTheDocument();
        expect(screen.getByLabelText("Correo electrónico o nombre de usuario"))
            .toBeInTheDocument();
        expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
        expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
        expect(metadatos.title).toBe("Iniciar sesión | UAM");
    });
});
