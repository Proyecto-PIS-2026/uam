import { act, cleanup, render, screen } from "@testing-library/react";

vi.mock("react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("react")>();
    return { ...actual, useLayoutEffect: vi.fn(actual.useLayoutEffect) };
});

import { useLayoutEffect } from "react";
import TextoAjustable from "./TextoAjustable";

class ObservadorDePrueba implements ResizeObserver {
    static instancias: ObservadorDePrueba[] = [];
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    constructor(private callback: ResizeObserverCallback) { ObservadorDePrueba.instancias.push(this) }
    cambiarAncho(ancho: number) {
        this.callback([{ contentRect: new DOMRect(0, 0, ancho, 20) } as ResizeObserverEntry], this)
    }
}

let anchoContenedor: number;
let factorFuente: number;
let fuentes: EventTarget;
let resolverFuentes: () => void;
let fuentesListas: Promise<void>;

const descriptorFuentes = Object.getOwnPropertyDescriptor(document, "fonts");

beforeEach(() => {
    anchoContenedor = 202;
    factorFuente = 1;
    ObservadorDePrueba.instancias = [];
    vi.stubGlobal("ResizeObserver", ObservadorDePrueba);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
        () => anchoContenedor,
    );
    vi.spyOn(HTMLSpanElement.prototype, "getBoundingClientRect")
        .mockImplementation(function (this: HTMLSpanElement) {
            const ancho = (this.textContent?.length ?? 0) * parseFloat(this.style.fontSize) * factorFuente;
            return new DOMRect(0, 0, ancho, 20);
        });
    fuentes = new EventTarget();
    fuentesListas = new Promise<void>((resolve) => { resolverFuentes = resolve });
    Object.defineProperty(fuentes, "ready", { value: fuentesListas, });
    Object.defineProperty(document, "fonts", { configurable: true, value: fuentes });
});

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (descriptorFuentes) {
        Object.defineProperty(document, "fonts", descriptorFuentes);
    } else {
        Reflect.deleteProperty(document, "fonts");
    }
});

describe("TextoAjustable", () => {
    it("muestra el texto completo y aplica la clase recibida", () => {
        render(<TextoAjustable minimo={10} maximo={30} className="especie">Tomate</TextoAjustable>);
        const texto = screen.getByText("Tomate");
        expect(texto).toBeInTheDocument();
        expect(texto.parentElement).toHaveClass("especie");
    });
    it("mantiene el tamaño máximo cuando el texto cabe", () => {
        render(<TextoAjustable minimo={10} maximo={30}>Tomate</TextoAjustable>);
        expect(screen.getByText("Tomate")).toHaveStyle({ fontSize: "30px" });
    });
    it("reduce el tamaño hasta que el texto cabe en el ancho disponible", () => {
        anchoContenedor = 92;
        render(<TextoAjustable minimo={10} maximo={30}>Tomate</TextoAjustable>);
        expect(screen.getByText("Tomate")).toHaveStyle({ fontSize: "15px" });
    });
    it.each([10, 10.3])(
        "respeta el mínimo %s aunque el texto no llegue a caber",
        (minimo) => {
            anchoContenedor = 12;
            render(<TextoAjustable minimo={minimo} maximo={30}>Tomate</TextoAjustable>,);
            expect(screen.getByText("Tomate")).toHaveStyle({ fontSize: `${minimo}px` });
        },
    );
    it.each([0, 2])(
        "no mide el texto si el contenedor tiene ancho %s",
        (ancho) => {
            anchoContenedor = ancho;
            render(<TextoAjustable minimo={10} maximo={30}>Tomate</TextoAjustable>);
            expect(HTMLSpanElement.prototype.getBoundingClientRect).not.toHaveBeenCalled();
        },
    );
    it("reduce y vuelve a ampliar el texto cuando cambia el ancho", () => {
        render(<TextoAjustable minimo={10} maximo={30}>Tomate</TextoAjustable>);
        const texto = screen.getByText("Tomate");
        const contenedor = texto.parentElement!;
        const observador = ObservadorDePrueba.instancias[0];
        expect(observador.observe).toHaveBeenCalledExactlyOnceWith(contenedor);
        anchoContenedor = 92;
        act(() => { observador.cambiarAncho(92); });
        expect(texto).toHaveStyle({ fontSize: "15px" });
        anchoContenedor = 202;
        act(() => { observador.cambiarAncho(202) });
        expect(texto).toHaveStyle({ fontSize: "30px" });
    });
    it("no vuelve a medir cuando el observer notifica el mismo ancho", () => {
        render(<TextoAjustable minimo={10} maximo={30}>Tomate</TextoAjustable>);
        const observador = ObservadorDePrueba.instancias[0];
        act(() => { observador.cambiarAncho(202); });
        vi.mocked(HTMLSpanElement.prototype.getBoundingClientRect,).mockClear();
        act(() => { observador.cambiarAncho(202) });
        expect(HTMLSpanElement.prototype.getBoundingClientRect).not.toHaveBeenCalled();
    });
    it("recalcula al cambiar el texto y los límites de tamaño", () => {
        anchoContenedor = 92;
        const { rerender } = render(<TextoAjustable minimo={10} maximo={30}>Tomate</TextoAjustable>);
        rerender(<TextoAjustable minimo={10} maximo={30}>Uva</TextoAjustable>);
        expect(screen.queryByText("Tomate")).not.toBeInTheDocument();
        expect(screen.getByText("Uva")).toHaveStyle({ fontSize: "30px" });
        rerender(<TextoAjustable minimo={10} maximo={20}>Uva</TextoAjustable>);
        expect(screen.getByText("Uva")).toHaveStyle({ fontSize: "20px" });

        anchoContenedor = 12;
        rerender(<TextoAjustable minimo={12} maximo={20}>Uva</TextoAjustable>);
        expect(screen.getByText("Uva")).toHaveStyle({ fontSize: "12px" });
        expect(ObservadorDePrueba.instancias[0].disconnect,).toHaveBeenCalledTimes(1);
    });
    it("reajusta el tamaño cuando las fuentes iniciales están listas", async () => {
        render(<TextoAjustable minimo={10} maximo={30}>Tomate</TextoAjustable>);
        factorFuente = 2;
        await act(async () => { resolverFuentes(); await fuentesListas });
        expect(screen.getByText("Tomate")).toHaveStyle({ fontSize: "16.5px" });
    });
    it("reajusta el tamaño al terminar de cargar nuevas fuentes", () => {
        render(<TextoAjustable minimo={10} maximo={30}>Tomate</TextoAjustable>);
        factorFuente = 2;
        act(() => { fuentes.dispatchEvent(new Event("loadingdone")); });
        expect(screen.getByText("Tomate")).toHaveStyle({ fontSize: "16.5px" });
    });

    it("desconecta el observer y deja de ajustar el texto después de desmontarse", async () => {
        const agregarListener = vi.spyOn(fuentes, "addEventListener");
        const quitarListener = vi.spyOn(fuentes, "removeEventListener");
        const { unmount } = render(<TextoAjustable minimo={10} maximo={30}>Tomate</TextoAjustable>);
        const observador = ObservadorDePrueba.instancias[0];
        const listener = agregarListener.mock.calls[0][1];
        unmount();
        expect(observador.disconnect).toHaveBeenCalledTimes(1);
        expect(quitarListener).toHaveBeenCalledExactlyOnceWith("loadingdone", listener,);
        vi.mocked(HTMLSpanElement.prototype.getBoundingClientRect).mockClear();
        await act(async () => { observador.cambiarAncho(92); fuentes.dispatchEvent(new Event("loadingdone")); resolverFuentes(); await fuentesListas });
        expect(HTMLSpanElement.prototype.getBoundingClientRect).not.toHaveBeenCalled();
    });
    it("termina el efecto si los refs todavía no existen", () => {
        vi.mocked(useLayoutEffect).mockImplementationOnce((efecto) => {
            const cleanup = efecto();
            cleanup?.();
        });
        render(<TextoAjustable minimo={10} maximo={30}>Tomate</TextoAjustable>);
        expect(ObservadorDePrueba.instancias).toHaveLength(0);
    });
});
