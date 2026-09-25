import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TextoAjustable from "./TextoAjustable";

const descriptorFonts = Object.getOwnPropertyDescriptor(document, "fonts");

beforeEach(() => {
    vi.stubGlobal(
        "ResizeObserver",
        class {observe = vi.fn(); disconnect = vi.fn(); unobserve = vi.fn()}
    );
    Object.defineProperty(document, "fonts", {
        configurable: true,
        value: {ready: Promise.resolve(), addEventListener: vi.fn(), removeEventListener: vi.fn()}
    });
});

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (descriptorFonts)
        Object.defineProperty(document, "fonts", descriptorFonts);
    else 
        Reflect.deleteProperty(document, "fonts");
});

describe("TextoAjustable", () => {
    it("mantiene el tamaño máximo cuando el texto entra", () => {
        vi.spyOn(HTMLElement.prototype, "clientWidth", "get")
            .mockReturnValue(200);
        vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").
            mockReturnValue({width: 100, height: 30, top: 0, left: 0, right: 100, bottom: 30, x: 0, y: 0, toJSON: () => ({})});
        render(<TextoAjustable texto="Manzana" minimo={10} maximo={30}/>);
        expect(screen.getByText("Manzana")).toHaveStyle({fontSize: "30px"});
        expect(screen.getByTitle("Manzana")).toBeInTheDocument();
    });

    it("reduce la fuente hasta que el texto entra en el contenedor", () => {
        vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(200);
        vi.spyOn(HTMLElement.prototype, "getBoundingClientRect")
            .mockImplementation(function (this: HTMLElement) {
                const tamaño = parseFloat(this.style.fontSize);
                const ancho = tamaño * 10;
                return {width: ancho, height: tamaño, top: 0, left: 0, right: ancho, bottom: tamaño, x: 0, y: 0, toJSON: () => ({})};
            });
        render(<TextoAjustable texto="Manzana" minimo={10} maximo={30}/>);
        expect(screen.getByText("Manzana")).toHaveStyle({fontSize: "19.5px"});
    });

    it("recalcula al cambiar el ancho e ignora notificaciones con el mismo ancho", () => {
        let anchoContenedor = 200;
        let notificarCambio!: (ancho: number) => void;
        vi.stubGlobal(
            "ResizeObserver",
            class {
                constructor(
                    callback: (entradas: { contentRect: { width: number } }[]) => void) {
                        notificarCambio = (ancho) => {callback([{ contentRect: { width: ancho } }])};
                    }
                observe = vi.fn();
                disconnect = vi.fn();
                unobserve = vi.fn();
            },
        );
        vi.spyOn(HTMLElement.prototype, "clientWidth", "get")
            .mockImplementation(() => anchoContenedor);
        const medirTexto = vi.spyOn(HTMLElement.prototype,"getBoundingClientRect")
            .mockImplementation(function (this: HTMLElement) {
                const tamaño = parseFloat(this.style.fontSize);
                const ancho = tamaño * 10;
                return {width: ancho, height: tamaño, top: 0, left: 0, right: ancho, bottom: tamaño, x: 0, y: 0, toJSON: () => ({})}
            });
        render(<TextoAjustable texto="Manzana" minimo={10} maximo={30} />);
        expect(screen.getByText("Manzana")).toHaveStyle({fontSize: "19.5px"});
        act(() => {anchoContenedor = 400; notificarCambio(400)});
        expect(screen.getByText("Manzana")).toHaveStyle({fontSize: "30px"});
        medirTexto.mockClear();
        act(() => { notificarCambio(400)});
        expect(medirTexto).not.toHaveBeenCalled();
        expect(screen.getByText("Manzana")).toHaveStyle({fontSize: "30px"});
    });

    it("no mide ni ajusta el texto cuando el contenedor no tiene ancho", () => {
        vi.spyOn(HTMLElement.prototype, "clientWidth", "get")
            .mockReturnValue(0);
        const medirTexto = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect");
        render(<TextoAjustable texto="Manzana" minimo={10} maximo={30}/>);
        expect(medirTexto).not.toHaveBeenCalled();
        expect(screen.getByText("Manzana")).toHaveStyle({fontSize: "30px"});
    });
});