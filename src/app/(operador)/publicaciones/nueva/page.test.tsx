import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../../modulos/publicaciones/mi-mercado/componentes/VistaMiMercado", () => ({
    default: ({ abrirAltaInicial }: { abrirAltaInicial?: boolean }) => (
        <div data-testid="mi-mercado" data-alta-abierta={String(abrirAltaInicial)}>Mi Mercado</div>
    ),
}));

import Page from "./page";

describe("Ruta de nueva publicación", () => {
    it("muestra Mi Mercado con el drawer de alta abierto", () => {
        render(<Page />);
        expect(screen.getByTestId("mi-mercado")).toHaveAttribute("data-alta-abierta", "true");
    });
});
