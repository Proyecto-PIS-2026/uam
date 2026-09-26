import { describe, expect, it, vi } from "vitest";
import Page, { metadata } from "./page";
import Inicio from "../../../modulos/consulta-mercado/inicio/inicio";

const mockObtenerEspeciesInicio = vi.hoisted(() => vi.fn());

vi.mock("../../../modulos/consulta-mercado/inicio/consultas-inicio", () => ({
    obtenerEspeciesInicio: mockObtenerEspeciesInicio,
}));

vi.mock("../../../modulos/consulta-mercado/inicio/inicio", () => ({
    default: vi.fn(() => null),
}));

describe("Page (mercado de hoy)", () => {

    it("obtiene las especies y se las pasa al componente Inicio", async () => {
        const especiesMock = [
            { idEspecie: 1, nombreEspecie: "Banana", cantidadOperadores: 3, fotoGenerica: null },
            { idEspecie: 2, nombreEspecie: "Manzana", cantidadOperadores: 5, fotoGenerica: null },
        ];
        mockObtenerEspeciesInicio.mockResolvedValue(especiesMock);

        const elemento = await Page();

        expect(mockObtenerEspeciesInicio).toHaveBeenCalled();
        expect(elemento.type).toBe(Inicio);
        expect(elemento.props).toEqual({ especies: especiesMock });
    });

    it("propaga el array vacío si no hay especies con publicaciones activas", async () => {
        mockObtenerEspeciesInicio.mockResolvedValue([]);

        const elemento = await Page();

        expect(elemento.props).toEqual({ especies: [] });
    });

    it("define el título correcto en los metadatos", () => {
        expect(metadata.title).toBe("Mercado de hoy | UAM");
    });

});