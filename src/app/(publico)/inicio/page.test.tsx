import { beforeEach, describe, expect, it, vi } from "vitest";
import Page, { metadata } from "./page";
import Inicio from "../../../modulos/consulta-mercado/inicio/inicio";

const mockObtenerEspeciesInicio = vi.hoisted(() => vi.fn());
const mockObtenerUrlListaInteligente = vi.hoisted(() => vi.fn());
const obtenerSesionMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() => vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
}));

vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({
    obtenerSesion: obtenerSesionMock,
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));

vi.mock("../../../modulos/consulta-mercado/inicio/consultas-inicio", () => ({
  obtenerEspeciesInicio: mockObtenerEspeciesInicio,
  obtenerUrlListaInteligente: mockObtenerUrlListaInteligente,
}))

vi.mock("../../../modulos/consulta-mercado/inicio/inicio", () => ({
    default: vi.fn(() => null),
}));

describe("Page (mercado de hoy)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        obtenerSesionMock.mockResolvedValue(null);
    });

    it("permite al operador consultar el inicio sin redirigir a Mi Mercado", async () => {
        obtenerSesionMock.mockResolvedValue({ usuarioId: 10, rol: "OPERADOR", expiraEn: 2000000000 });
        mockObtenerEspeciesInicio.mockResolvedValue([]);
        mockObtenerUrlListaInteligente.mockResolvedValue(null);

        const elemento = await Page();

        expect(redirectMock).not.toHaveBeenCalled();
        expect(mockObtenerEspeciesInicio).toHaveBeenCalledOnce();
        expect(mockObtenerUrlListaInteligente).toHaveBeenCalledOnce();
        expect(elemento.type).toBe(Inicio);
    });

    it("redirige al productor a su mercado antes de consultar especies o la lista inteligente", async () => {
        obtenerSesionMock.mockResolvedValue({ usuarioId: 10, rol: "PRODUCTOR", expiraEn: 2000000000 });

        await expect(Page()).rejects.toThrow("NEXT_REDIRECT");

        expect(redirectMock).toHaveBeenCalledExactlyOnceWith("/mi-mercado/productor");
        expect(obtenerSesionMock).toHaveBeenCalledOnce();
        expect(mockObtenerEspeciesInicio).not.toHaveBeenCalled();
        expect(mockObtenerUrlListaInteligente).not.toHaveBeenCalled();
    });

    it.each([null, "ADMINISTRADOR"] as const)("conserva el inicio público para la sesión %s", async (rol) => {
        obtenerSesionMock.mockResolvedValue(rol ? { usuarioId: 20, rol, expiraEn: 2000000000 } : null);
        mockObtenerEspeciesInicio.mockResolvedValue([]);
        mockObtenerUrlListaInteligente.mockResolvedValue(null);

        const elemento = await Page();

        expect(redirectMock).not.toHaveBeenCalled();
        expect(mockObtenerEspeciesInicio).toHaveBeenCalledOnce();
        expect(mockObtenerUrlListaInteligente).toHaveBeenCalledOnce();
        expect(elemento.type).toBe(Inicio);
        expect(elemento.props).toEqual({ especies: [], urlListaInteligente: null });
    });

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
