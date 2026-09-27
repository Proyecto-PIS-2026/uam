import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HojasDecorativas from "./HojasDecorativas";
import styles from "./HojasDecorativas.module.css";

let altoDecoracion = 1000;
let altoPatron = 300;
const observadores: ResizeObserverMock[] = [];

class ResizeObserverMock implements ResizeObserver {
    readonly callback: ResizeObserverCallback;
    observe = vi.fn<(target: Element, options?: ResizeObserverOptions) => void>();
    unobserve = vi.fn<(target: Element) => void>();
    disconnect = vi.fn<() => void>();
    constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
        observadores.push(this);
    }
    notificar() {
        this.callback([], this);
    }
}

function obtenerObservador() {
    const observador = observadores[observadores.length - 1];
    if (!observador) throw new Error("No se creó el ResizeObserver");
    return observador;
}

function cantidadPatrones(contenedor: HTMLElement) {
    return contenedor.querySelectorAll(`.${styles.patron}`).length;
}

describe("HojasDecorativas", () => {
    beforeEach(() => {
        altoDecoracion = 1000;
        altoPatron = 300;
        observadores.length = 0;
        vi.stubGlobal("ResizeObserver", ResizeObserverMock);
        vi.spyOn(Element.prototype, "clientHeight", "get").mockImplementation(() => altoDecoracion);
        vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(() => ({
            x: 0,
            y: 0,
            width: 100,
            height: altoPatron,
            top: 0,
            right: 100,
            bottom: altoPatron,
            left: 0,
            toJSON: () => ({}),
        }));
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it("usa la variante fondo por defecto y acepta una clase adicional", () => {
        const { container } = render(<HojasDecorativas className="hojas-extra" />);
        const decoracion = container.firstElementChild;
        expect(decoracion).toHaveClass(styles.decoracion, styles.fondo, "hojas-extra");
        expect(decoracion).toHaveAttribute("aria-hidden", "true");
    });

    it("muestra el separador sin repetir patrones ni crear un observador", () => {
        const { container } = render(<HojasDecorativas variante="separador" />);
        const decoracion = container.firstElementChild;
        expect(decoracion).toHaveClass(styles.separador);
        expect(decoracion?.children).toHaveLength(6);
        expect(cantidadPatrones(container)).toBe(0);
        expect(observadores).toHaveLength(0);
    });

    it("redondea hacia arriba las repeticiones y observa los dos contenedores", () => {
        const { container } = render(<HojasDecorativas />);
        const decoracion = container.firstElementChild;
        const primerPatron = container.querySelector(`.${styles.patron}`);
        const actual = obtenerObservador();
        expect(cantidadPatrones(container)).toBe(4);
        expect(actual.observe).toHaveBeenCalledTimes(2);
        expect(actual.observe).toHaveBeenCalledWith(decoracion);
        expect(actual.observe).toHaveBeenCalledWith(primerPatron);
    });

    it("mantiene al menos un patrón aunque la altura disponible sea cero", () => {
        altoDecoracion = 0;
        const { container } = render(<HojasDecorativas />);
        expect(cantidadPatrones(container)).toBe(1);
    });

    it("recalcula las repeticiones cuando cambian las dimensiones", () => {
        const { container } = render(<HojasDecorativas />);
        const actual = obtenerObservador();
        altoDecoracion = 1800;
        act(() => actual.notificar());
        expect(cantidadPatrones(container)).toBe(6);
        altoPatron = 600;
        act(() => actual.notificar());
        expect(cantidadPatrones(container)).toBe(3);
        altoDecoracion = 100;
        act(() => actual.notificar());
        expect(cantidadPatrones(container)).toBe(1);
    });

    it("conserva las repeticiones si todavía no se puede medir el patrón", () => {
        const { container } = render(<HojasDecorativas />);
        const actual = obtenerObservador();
        expect(cantidadPatrones(container)).toBe(4);
        altoDecoracion = 1800;
        altoPatron = 0;
        act(() => actual.notificar());
        expect(cantidadPatrones(container)).toBe(4);
        altoPatron = 300;
        act(() => actual.notificar());
        expect(cantidadPatrones(container)).toBe(6);
    });

    it("desconecta el observador al desmontar el componente", () => {
        const { unmount } = render(<HojasDecorativas />);
        const actual = obtenerObservador();
        unmount();
        expect(actual.disconnect).toHaveBeenCalledOnce();
    });

    it("desconecta el observador cuando cambia a separador", () => {
        const { container, rerender } = render(<HojasDecorativas />);
        const actual = obtenerObservador();
        rerender(<HojasDecorativas variante="separador" />);
        expect(actual.disconnect).toHaveBeenCalledOnce();
        expect(cantidadPatrones(container)).toBe(0);
    });

    it("usa resize cuando no hay ResizeObserver y elimina el listener", () => {
        vi.stubGlobal("ResizeObserver", undefined);
        const agregarListener = vi.spyOn(window, "addEventListener");
        const eliminarListener = vi.spyOn(window, "removeEventListener");
        const { container, unmount } = render(<HojasDecorativas />);
        const registroResize = agregarListener.mock.calls.find(
            ([evento]) => evento === "resize"
        );
        if (!registroResize) throw new Error("No se registró el evento resize");
        expect(observadores).toHaveLength(0);
        expect(cantidadPatrones(container)).toBe(4);
        altoDecoracion = 1800;
        fireEvent.resize(window);
        expect(cantidadPatrones(container)).toBe(6);
        unmount();
        expect(eliminarListener).toHaveBeenCalledWith("resize", registroResize[1]);
    });
});
