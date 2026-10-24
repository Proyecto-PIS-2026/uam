import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { DrawerProps } from "@mui/material/Drawer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DrawerDeslizable from "./DrawerDeslizable";

vi.mock("@mui/material/Drawer", () => ({
    default: ({ open, anchor, children, onClose }: DrawerProps) => <section
        role="dialog" className="MuiDrawer-paper" hidden={!open} data-anchor={anchor}
        style={{ transform: "none", transition: "transform 225ms ease" }}
        onKeyDown={(evento) => { if (evento.key === "Escape") onClose?.(evento, "escapeKeyDown"); }}
    >{children}</section>,
}));

const cerrar = vi.fn();

function mostrar(props: Partial<React.ComponentProps<typeof DrawerDeslizable>> = {}) {
    return render(<DrawerDeslizable anchor="bottom" open onClose={cerrar} {...props}>
        <input aria-label="Precio" />
        <button type="button">Acción del formulario</button>
    </DrawerDeslizable>);
}

function asa() {
    return document.querySelector<HTMLElement>("[data-drawer-handle]")!;
}

function puntero(tipo: string, x: number, y: number, tiempo: number, destino: HTMLElement = asa(), extras: Record<string, unknown> = {}) {
    const evento = new Event(tipo, { bubbles: true, cancelable: true });
    for (const [propiedad, valor] of Object.entries({ pointerId: 1, isPrimary: true, button: 0, clientX: x, clientY: y, timeStamp: tiempo + 1000, ...extras })) {
        Object.defineProperty(evento, propiedad, { value: valor });
    }
    fireEvent(destino, evento);
    return evento;
}

beforeEach(() => {
    vi.useFakeTimers();
    cerrar.mockReset();
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(performance.now()), 16));
    vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
});

afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe("DrawerDeslizable", () => {
    it("sigue el arrastre y solicita cerrar una sola vez al superar el umbral", () => {
        mostrar();
        puntero("pointerdown", 100, 100, 0);
        puntero("pointermove", 100, 180, 300);
        expect(screen.getByRole("dialog").style.transform).toBe("translate(0px, 80px)");
        puntero("pointerup", 100, 180, 310);
        puntero("lostpointercapture", 100, 180, 311);
        expect(cerrar).toHaveBeenCalledOnce();
    });

    it("permite un gesto corto pero rápido hacia abajo", () => {
        mostrar();
        puntero("pointerdown", 100, 100, 0);
        puntero("pointermove", 100, 140, 35);
        puntero("pointerup", 100, 140, 40);
        expect(cerrar).toHaveBeenCalledOnce();
    });

    it.each([
        { nombre: "clic", x: 100, y: 100 },
        { nombre: "movimiento corto", x: 100, y: 120 },
        { nombre: "horizontal", x: 250, y: 180 },
        { nombre: "hacia arriba", x: 100, y: 20 },
    ])("no cierra con $nombre y vuelve a su posición", ({ x, y }) => {
        mostrar();
        puntero("pointerdown", 100, 100, 0);
        puntero("pointermove", x, y, 300);
        puntero("pointerup", x, y, 310);
        expect(cerrar).not.toHaveBeenCalled();
        expect(screen.getByRole("dialog").style.transform).toBe("none");
    });

    it.each(["pointercancel", "lostpointercapture"])("restaura el panel ante %s", (evento) => {
        mostrar();
        puntero("pointerdown", 100, 100, 0);
        puntero("pointermove", 100, 220, 300);
        puntero(evento, 100, 220, 310);
        expect(cerrar).not.toHaveBeenCalled();
        expect(screen.getByRole("dialog").style.transform).toBe("none");
    });

    it("ignora pulsaciones secundarias y otros punteros", () => {
        mostrar();
        puntero("pointerdown", 100, 100, 0, asa(), { isPrimary: false });
        puntero("pointermove", 100, 250, 300);
        expect(screen.getByRole("dialog").style.transform).toBe("none");
        puntero("pointerdown", 100, 100, 0);
        puntero("pointermove", 100, 250, 300, asa(), { pointerId: 2 });
        puntero("pointerup", 100, 250, 310, asa(), { pointerId: 2 });
        expect(cerrar).not.toHaveBeenCalled();
        expect(screen.getByRole("dialog").style.transform).toBe("none");
    });

    it("no arrastra desde campos ni desde el contenido", () => {
        mostrar();
        for (const elemento of [screen.getByLabelText("Precio"), screen.getByRole("button"), screen.getByRole("dialog")]) {
            puntero("pointerdown", 100, 100, 0, elemento);
            puntero("pointermove", 100, 250, 300, elemento);
            puntero("pointerup", 100, 250, 310, elemento);
        }
        expect(cerrar).not.toHaveBeenCalled();
        expect(screen.getByRole("dialog").style.transform).toBe("none");
    });

    it("bloquea el gesto mientras una operación está pendiente", () => {
        mostrar({ arrastreDeshabilitado: true });
        expect(asa()).toHaveAttribute("data-disabled", "true");
        const inicio = puntero("pointerdown", 100, 100, 0);
        expect(inicio.defaultPrevented).toBe(true);
        puntero("pointermove", 100, 250, 300);
        puntero("pointerup", 100, 250, 310);
        expect(cerrar).not.toHaveBeenCalled();
        expect(screen.getByRole("dialog").style.transform).toBe("none");
    });

    it("cancela el gesto si el bloqueo cambia mientras se arrastra", () => {
        const vista = mostrar();
        puntero("pointerdown", 100, 100, 0);
        puntero("pointermove", 100, 250, 300);
        vista.rerender(<DrawerDeslizable anchor="bottom" open onClose={cerrar} arrastreDeshabilitado />);
        puntero("pointerup", 100, 250, 310);
        expect(cerrar).not.toHaveBeenCalled();
        expect(screen.getByRole("dialog").style.transform).toBe("none");
    });

    it("restaura la posición si el consumidor no acepta el cierre", () => {
        mostrar();
        puntero("pointerdown", 100, 100, 0);
        puntero("pointermove", 100, 250, 300);
        puntero("pointerup", 100, 250, 310);
        act(() => vi.advanceTimersByTime(20));
        expect(cerrar).toHaveBeenCalledOnce();
        expect(screen.getByRole("dialog").style.transform).toBe("none");
    });

    it("respeta movimiento reducido al cancelar el arrastre", () => {
        vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
        mostrar();
        puntero("pointerdown", 100, 100, 0);
        puntero("pointermove", 100, 120, 300);
        puntero("pointerup", 100, 120, 310);
        expect(screen.getByRole("dialog").style.transition).toBe("none");
        expect(screen.getByRole("dialog").style.transform).toBe("none");
        expect(cerrar).not.toHaveBeenCalled();
    });

    it("retira el asa en escritorio y conserva el cierre con Escape", () => {
        const vista = mostrar();
        puntero("pointerdown", 100, 100, 0);
        puntero("pointermove", 100, 140, 300);
        vista.rerender(<DrawerDeslizable anchor="right" open onClose={cerrar} />);
        expect(asa()).toBeNull();
        expect(screen.getByRole("dialog").style.transform).toBe("none");
        fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
        expect(cerrar).toHaveBeenCalledOnce();
    });
});
