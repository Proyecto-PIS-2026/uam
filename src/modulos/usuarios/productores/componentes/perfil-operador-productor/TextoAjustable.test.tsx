import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TextoAjustable from "./TextoAjustable";

let anchoContenedor = 100;
let callbackResize: ResizeObserverCallback | undefined;
let callbackLoadingDone: (() => void) | undefined;
let resolverFontsReady: (() => void) | undefined;

const observar = vi.fn();
const desconectar = vi.fn();
const agregarEvento = vi.fn();
const eliminarEvento = vi.fn();

class ResizeObserverMock {
    constructor(callback: ResizeObserverCallback) {
        callbackResize = callback;
    }

    observe = observar;
    disconnect = desconectar;
    unobserve = vi.fn();
}

function dispararResize(ancho: number) {
    act(() => {
        callbackResize?.(
            [
                {
                    contentRect: {
                        width: ancho,
                    },
                } as ResizeObserverEntry,
            ],
            {} as ResizeObserver
        );
    });
}

describe("TextoAjustable", () => {
    beforeEach(() => {
        anchoContenedor = 100;
        callbackResize = undefined;
        callbackLoadingDone = undefined;
        resolverFontsReady = undefined;

        vi.clearAllMocks();

        vi.stubGlobal("ResizeObserver", ResizeObserverMock);

        Object.defineProperty(HTMLElement.prototype, "clientWidth", {
            configurable: true,
            get() {
                return anchoContenedor;
            },
        });

        vi.spyOn(
            HTMLElement.prototype,
            "getBoundingClientRect"
        ).mockImplementation(function (this: HTMLElement) {
            const tamaño = parseFloat(this.style.fontSize || "0");
            const ancho = tamaño * 6;

            return {
                width: ancho,
                height: 0,
                top: 0,
                right: ancho,
                bottom: 0,
                left: 0,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            } as DOMRect;
        });

        const fontsReady = new Promise<void>((resolve) => {
            resolverFontsReady = resolve;
        });

        agregarEvento.mockImplementation(
            (evento: string, callback: () => void) => {
                if (evento === "loadingdone") {
                    callbackLoadingDone = callback;
                }
            }
        );

        Object.defineProperty(document, "fonts", {
            configurable: true,
            value: {
                ready: fontsReady,
                addEventListener: agregarEvento,
                removeEventListener: eliminarEvento,
            },
        });
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    // Verifica que renderice el texto y sus atributos
    it("muestra el texto recibido", () => {
        render(<TextoAjustable texto="Tomate" minimo={10} maximo={20}/>);
        expect(screen.getByText("Tomate")).toBeInTheDocument();
        expect(screen.getByTitle("Tomate")).toBeInTheDocument();
    });

    it("mantiene el tamaño máximo cuando el texto entra", () => {
        anchoContenedor = 200;
        render(<TextoAjustable texto="Tomate" minimo={10} maximo={20}/>);
        expect(screen.getByText("Tomate")).toHaveStyle({fontSize: "20px"});
    });

    it("reduce el tamaño cuando el texto no entra", () => {
        anchoContenedor = 100;
        render(<TextoAjustable texto="Tomate" minimo={10} maximo={20}/>);
        expect(screen.getByText("Tomate")).toHaveStyle({fontSize: "16px"});
    });

    it("no baja del tamaño mínimo", () => {
        anchoContenedor = 20;
        render(<TextoAjustable texto="Tomate" minimo={10} maximo={20}/>);
        expect(screen.getByText("Tomate")).toHaveStyle({fontSize: "10px"});
    });

    it("no intenta ajustar cuando el ancho disponible es cero", () => {
        anchoContenedor = 2;
        const medir = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect");
        render(<TextoAjustable texto="Tomate" minimo={10} maximo={20}/>);
        expect(medir).not.toHaveBeenCalled();
        expect(screen.getByText("Tomate")).toHaveStyle({fontSize: "20px"});
    });

    it("recalcula el tamaño cuando cambia el ancho del contenedor", () => {
        anchoContenedor = 100;
        render(<TextoAjustable texto="Tomate" minimo={10} maximo={20}/>);
        expect(screen.getByText("Tomate")).toHaveStyle({fontSize: "16px"});
        anchoContenedor = 80;
        dispararResize(80);
        expect(screen.getByText("Tomate")).toHaveStyle({fontSize: "13px"});
    });

    it("no recalcula si ResizeObserver informa el mismo ancho", () => {
        anchoContenedor = 100;
        const medir = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect");
        render(<TextoAjustable texto="Tomate" minimo={10} maximo={20}/>);
        dispararResize(100);
        const llamadasLuegoPrimerResize = medir.mock.calls.length;
        dispararResize(100);
        expect(medir.mock.calls.length).toBe(llamadasLuegoPrimerResize);
    });

    it("recalcula cuando terminan de cargar las fuentes", () => {
        anchoContenedor = 100;
        render(<TextoAjustable texto="Tomate" minimo={10} maximo={20}/>);
        expect(screen.getByText("Tomate")).toHaveStyle({fontSize: "16px"});
        anchoContenedor = 80;
        act(() => {callbackLoadingDone?.();});
        expect(screen.getByText("Tomate")).toHaveStyle({fontSize: "13px"});
        expect(agregarEvento).toHaveBeenCalledWith("loadingdone", expect.any(Function));
    });

    it("recalcula cuando las fuentes quedan listas", async () => {
        anchoContenedor = 100;
        render(<TextoAjustable texto="Tomate" minimo={10} maximo={20}/>);
        anchoContenedor = 80;
        await act(async () => {
            resolverFontsReady?.();
            await Promise.resolve();
        });
        expect(screen.getByText("Tomate")).toHaveStyle({fontSize: "13px"});
    });

    it("desconecta el observer y elimina el evento al desmontarse", async () => {
        const { unmount } = render(<TextoAjustable texto="Tomate" minimo={10} maximo={20}/>);

        expect(observar).toHaveBeenCalledTimes(1);
        unmount();
        expect(desconectar).toHaveBeenCalledTimes(1);
        expect(eliminarEvento).toHaveBeenCalledWith("loadingdone", expect.any(Function));

        await act(async () => {
            resolverFontsReady?.();
            await Promise.resolve();
        });
    });
});
