import { describe, expect, it, vi } from "vitest";
import Page, { metadata } from "./page";
import Inicio from "../../../modulos/consulta-mercado/inicio/inicio";

const mockObtenerEspeciesInicio = vi.hoisted(() => vi.fn());
const mockObtenerUrlListaInteligente = vi.hoisted(() => vi.fn());

vi.mock("../../../modulos/consulta-mercado/inicio/consultas-inicio", () => ({
  obtenerEspeciesInicio: mockObtenerEspeciesInicio,
  obtenerUrlListaInteligente: mockObtenerUrlListaInteligente,
}))

vi.mock("../../../modulos/consulta-mercado/inicio/inicio", () => ({
    default: vi.fn(() => null),
}));

describe("Page (mercado de hoy)", () => {

    it("obtiene las especies y se las pasa al componente Inicio", async () => {
        const especiesMock = [
            { nombreEspecie: "Banana", cantidadOperadores: 3, fotoGenerica: null },
            { nombreEspecie: "Manzana", cantidadOperadores: 5, fotoGenerica: null },
        ];
        const urlMock = "https://uam.com.uy/wp-content/uploads/2026/09/MGAP_Lista_Inteligente_PDF-1.pdf";
        mockObtenerEspeciesInicio.mockResolvedValue(especiesMock);
        mockObtenerUrlListaInteligente.mockResolvedValue(urlMock);

        const elemento = await Page();

        expect(mockObtenerEspeciesInicio).toHaveBeenCalled();
        expect(mockObtenerUrlListaInteligente).toHaveBeenCalled();
        expect(elemento.type).toBe(Inicio);
        expect(elemento.props).toEqual({ especies: especiesMock, urlListaInteligente: urlMock });
    });

    it("propaga el array vacío si no hay especies con publicaciones activas", async () => {
        mockObtenerEspeciesInicio.mockResolvedValue([]);
        mockObtenerUrlListaInteligente.mockResolvedValue(null);

        const elemento = await Page();

        expect(elemento.props).toEqual({ especies: [] , urlListaInteligente: null });
    });

    it("define el título correcto en los metadatos", () => {
        expect(metadata.title).toBe("Mercado de hoy | UAM");
    });
});
