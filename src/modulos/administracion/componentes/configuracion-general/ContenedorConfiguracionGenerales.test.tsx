import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import PaginaAdministracionGeneral from "./ContenedorConfiguracionGenerales";
import obtenerConfiguraciones from "@/modulos/administracion/Consulta-Configuracion";

vi.mock("@/modulos/administracion/consulta-configuracion", () => ({
    default: vi.fn(),
}));

vi.mock(
    "@/modulos/administracion/componentes/configuracion-general/ListadoConfiguracionesGenerales",
    () => ({
        default: ({
            configuracion,
        }: {
            configuracion: Record<string, string | null>;
        }) => (
            <div data-testid="listado-configuraciones-generales">
                {JSON.stringify(configuracion)}
            </div>
        ),
    })
);

const obtenerConfiguracionesMock = vi.mocked(obtenerConfiguraciones);

describe("PaginaAdministracionGeneral", () => {
    beforeEach(() => { vi.clearAllMocks()});

    it("consulta las configuraciones al cargar la página", async () => {
        obtenerConfiguracionesMock.mockResolvedValue([]);
        const contenido = await PaginaAdministracionGeneral();
        render(contenido);
        expect(obtenerConfiguracionesMock).toHaveBeenCalledOnce();
        expect(screen.getByTestId("listado-configuraciones-generales")).toBeInTheDocument();
    });

    it("transforma las configuraciones obtenidas y las pasa al listado", async () => {
        obtenerConfiguracionesMock.mockResolvedValue([{nombreConfiguracion: "url_lista_inteligente", valorConfiguracion: "https://uam.com.uy/lista.pdf",}, {nombreConfiguracion: "configuracion_prueba", valorConfiguracion: "30",},]);
        const contenido = await PaginaAdministracionGeneral();
        render(contenido);
        expect(screen.getByTestId("listado-configuraciones-generales")).toHaveTextContent(JSON.stringify({url_lista_inteligente: "https://uam.com.uy/lista.pdf", configuracion_prueba: "30",}));
    });

    it("envía un objeto vacío cuando no existen configuraciones", async () => {
        obtenerConfiguracionesMock.mockResolvedValue([]);
        const contenido = await PaginaAdministracionGeneral();
        render(contenido);
        expect(screen.getByTestId("listado-configuraciones-generales")).toHaveTextContent("{}");
    });

    it("propaga el error cuando falla la consulta de configuraciones", async () => {
        obtenerConfiguracionesMock.mockRejectedValue(new Error("Error al obtener configuraciones"));
        await expect(PaginaAdministracionGeneral()).rejects.toThrow("Error al obtener configuraciones");
    });
});
