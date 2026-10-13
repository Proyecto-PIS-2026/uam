import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import ContenedorConfiguracionPublicaciones from "./ContenedorConfiguracionPublicaciones";

vi.mock(
    "@/modulos/administracion/componentes/configuracion-publicaciones/ListadoConfiguracionesPublicaciones",
    () => ({
        default: ({
            configuracion,
        }: {
            configuracion: Record<string, string | null>;
        }) => (
            <div data-testid="listado-configuraciones-publicaciones">
                {JSON.stringify(configuracion)}
            </div>
        ),
    })
);

describe("ContenedorConfiguracionPublicaciones", () => {
    it("renderiza el listado de configuraciones de publicaciones", () => {
        render(<ContenedorConfiguracionPublicaciones configuracion={{ incremento_precio: "10" }}/>);
        expect(screen.getByTestId("listado-configuraciones-publicaciones")).toBeInTheDocument();
    });

    it("pasa las configuraciones recibidas al listado", () => {
        const configuracion = {incremento_precio: "25", vigencia_fotos: "30"};
        render(<ContenedorConfiguracionPublicaciones configuracion={configuracion}/>);
        expect(screen.getByTestId("listado-configuraciones-publicaciones")).toHaveTextContent(JSON.stringify(configuracion));
    });

    it("pasa un objeto vacío cuando no recibe configuraciones", () => {
        render(<ContenedorConfiguracionPublicaciones configuracion={{}}/>);
        expect(screen.getByTestId("listado-configuraciones-publicaciones")).toHaveTextContent("{}");
    });

    it("pasa correctamente configuraciones con valores null", () => {
        render(<ContenedorConfiguracionPublicaciones configuracion={{ incremento_precio: null }}/>);
        expect(screen.getByTestId("listado-configuraciones-publicaciones")).toHaveTextContent(JSON.stringify({ incremento_precio: null }));
    });
});
