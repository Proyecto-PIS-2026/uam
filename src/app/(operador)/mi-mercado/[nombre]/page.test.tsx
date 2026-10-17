import { beforeEach, describe, expect, it, vi } from "vitest";

const notFoundMock = vi.hoisted(() => vi.fn(() => { throw new Error("NOT_FOUND"); }));

vi.mock("next/navigation", () => ({ notFound: notFoundMock }));
vi.mock("../../../../modulos/publicaciones/mi-mercado/componentes/VistaMiMercado", () => ({
    default: vi.fn(() => null),
}));

import Page from "./page";

describe("/mi-mercado/[nombre]", () => {
    beforeEach(() => vi.clearAllMocks());

    it.each([
        ["Jorge%20Ferias", "Jorge Ferias"],
        ["Frutas%20%26%20M%C3%A1s", "Frutas & Más"],
        ["Frutas%20100%25", "Frutas 100%"],
        ["Frutas%20%2520", "Frutas %20"],
    ])("decodifica una sola vez el nombre de la URL %s", async (nombreCodificado, nombre) => {
        const contenido = await Page({ params: Promise.resolve({ nombre: nombreCodificado }) });
        expect(contenido.props.operadorNombre).toBe(nombre);
        expect(notFoundMock).not.toHaveBeenCalled();
    });

    it.each(["", "   ", "%20%20"])("rechaza el nombre vacío %s", async (nombre) => {
        await expect(Page({ params: Promise.resolve({ nombre }) })).rejects.toThrow("NOT_FOUND");
        expect(notFoundMock).toHaveBeenCalledOnce();
    });

    it.each(["%", "%ZZ", "%C3"])("rechaza la codificación inválida %s", async (nombre) => {
        await expect(Page({ params: Promise.resolve({ nombre }) })).rejects.toThrow("NOT_FOUND");
        expect(notFoundMock).toHaveBeenCalledOnce();
    });
});
