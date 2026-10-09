import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import PaginaAdministracionPublicaciones from "./ContenedorConfiguracionPublicaciones";
import obtenerConfiguraciones from "@/modulos/administracion/consulta-configuracion";

vi.mock("@/modulos/administracion/consulta-configuracion", () => ({
    default: vi.fn(),
}));

vi.mock("@/modulos/administracion/componentes/ListadoConfiguracionesPublicaciones", () => ({
    default: ({ configuracion }: { configuracion: Record<string, string> }) => (
        <div data-testid="contenedor-configuracion">
            {JSON.stringify(configuracion)}
        </div>
    ),
}));

const obtenerConfiguracionesMock = vi.mocked(obtenerConfiguraciones);

describe("PaginaAdministracionPublicaciones", () => {
    beforeEach(() => {vi.clearAllMocks()});

    it("consulta las configuraciones al cargar la página", async () => {
        obtenerConfiguracionesMock.mockResolvedValue([]);
        const contenido = await PaginaAdministracionPublicaciones();
        render(contenido);
        expect(obtenerConfiguracionesMock).toHaveBeenCalledOnce();
        expect(screen.getByTestId("contenedor-configuracion")).toBeInTheDocument();
    });

    it("transforma las configuraciones obtenidas y las pasa al contenedor", async () => {
        obtenerConfiguracionesMock.mockResolvedValue([{nombreConfiguracion: "url_lista_inteligente", valorConfiguracion: "https://uam.com.uy/lista.pdf"}, {nombreConfiguracion: "vigencia_fotos", valorConfiguracion: "30"},]);
        const contenido = await PaginaAdministracionPublicaciones();
        render(contenido);
        expect(screen.getByTestId("contenedor-configuracion")).toHaveTextContent(JSON.stringify({ url_lista_inteligente: "https://uam.com.uy/lista.pdf", vigencia_fotos: "30"}));
    });

    it("envía un objeto vacío cuando no existen configuraciones", async () => {
        obtenerConfiguracionesMock.mockResolvedValue([]);
        const contenido = await PaginaAdministracionPublicaciones();
        render(contenido);
        expect(screen.getByTestId("contenedor-configuracion")).toHaveTextContent("{}");
    });

    it("propaga el error cuando falla la consulta de configuraciones", async () => {
        obtenerConfiguracionesMock.mockRejectedValue(new Error("Error al obtener configuraciones"));
        await expect(PaginaAdministracionPublicaciones()).rejects.toThrow("Error al obtener configuraciones");
    });
});