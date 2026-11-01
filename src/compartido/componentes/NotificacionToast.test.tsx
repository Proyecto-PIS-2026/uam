import { act, fireEvent, render as renderOriginal, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import type { ReactElement } from "react";
import Drawer from "@mui/material/Drawer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProveedorNotificacionesToast, useNotificacionToast } from "./NotificacionToast";

const render = (ui: ReactElement) => renderOriginal(ui, { wrapper: ProveedorNotificacionesToast });

function Ejemplo() {
    const { notificar } = useNotificacionToast();
    return (
        <form aria-label="Formulario de prueba">
            <button type="button" onClick={() => notificar("Cambios guardados.", "success")}>Guardar</button>
            <button type="button" onClick={() => notificar("No se pudo guardar.", "error")}>Fallar</button>
        </form>
    );
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

function Emisor({ nombre }: { nombre: string }) {
    const { notificar, cerrarNotificacion } = useNotificacionToast();
    const [cantidad, setCantidad] = useState(0);
    return <>
        <button onClick={() => { notificar(`${nombre} ${cantidad + 1}`, "success"); setCantidad(cantidad + 1); }}>{nombre}</button>
        <button onClick={cerrarNotificacion}>Limpiar {nombre}</button>
    </>;
}

describe("NotificacionToast", () => {
    it("muestra resultados fuera del formulario sin añadir un bloque a su contenido", () => {
        render(<Ejemplo />);
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
        expect(screen.getByRole("status")).toHaveTextContent("Cambios guardados.");
        expect(within(screen.getByRole("form")).queryByRole("status")).not.toBeInTheDocument();
        expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    });

    it("permite cerrar el aviso y volver a mostrar el mismo error", () => {
        render(<Ejemplo />);
        fireEvent.click(screen.getByRole("button", { name: "Fallar" }));
        expect(screen.getByRole("alert")).toHaveTextContent("No se pudo guardar.");
        fireEvent.click(screen.getByRole("button", { name: "Cerrar notificación" }));
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Fallar" }));
        expect(screen.getByRole("alert")).toHaveTextContent("No se pudo guardar.");
    });

    it.each(["cierre", "vencimiento"])("retira el aviso después de una salida breve por %s", (motivo) => {
        vi.useFakeTimers();
        render(<Ejemplo />);
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
        const aviso = screen.getByRole("status");
        act(() => vi.advanceTimersByTime(200));
        if (motivo === "cierre") fireEvent.click(within(aviso).getByRole("button", { name: "Cerrar notificación" }));
        else act(() => vi.advanceTimersByTime(4800));
        expect(aviso).toBeInTheDocument();
        expect(aviso.parentElement).toHaveAttribute("inert");
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
        act(() => vi.advanceTimersByTime(80));
        expect(aviso).toBeInTheDocument();
        act(() => vi.advanceTimersByTime(80));
        expect(aviso).not.toBeInTheDocument();
        expect(screen.queryByRole("region", { name: "Notificaciones" })).not.toBeInTheDocument();
    });

    it("completa la salida del aviso desplazado sin borrar los tres nuevos", () => {
        vi.useFakeTimers();
        render(<Emisor nombre="Aviso" />);
        const boton = screen.getByRole("button", { name: "Aviso" });
        fireEvent.click(boton);
        const anterior = screen.getByRole("status");
        act(() => vi.advanceTimersByTime(200));
        fireEvent.click(boton);
        fireEvent.click(boton);
        fireEvent.click(boton);
        expect(anterior).toBeInTheDocument();
        expect(screen.getAllByRole("status").map((aviso) => aviso.textContent)).toEqual(["Aviso 2", "Aviso 3", "Aviso 4"]);
        act(() => vi.advanceTimersByTime(160));
        expect(anterior).not.toBeInTheDocument();
        expect(screen.getAllByRole("status")).toHaveLength(3);
    });

    it("da cinco segundos a cada aviso cuando se repite una acción", () => {
        vi.useFakeTimers();
        render(<Ejemplo />);
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
        act(() => vi.advanceTimersByTime(4000));
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
        act(() => vi.advanceTimersByTime(4999));
        expect(screen.getByRole("status")).toBeInTheDocument();
        act(() => vi.advanceTimersByTime(1));
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("pausa el cierre mientras se lee el aviso con el puntero", () => {
        vi.useFakeTimers();
        render(<Ejemplo />);
        fireEvent.click(screen.getByRole("button", { name: "Fallar" }));
        fireEvent.mouseEnter(screen.getByRole("alert"));
        act(() => vi.advanceTimersByTime(10000));
        expect(screen.getByRole("alert")).toBeInTheDocument();
        fireEvent.mouseLeave(screen.getByRole("alert"));
        act(() => vi.advanceTimersByTime(5000));
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("ignora clics fuera y permite cerrar con Escape", () => {
        vi.useFakeTimers();
        render(<Ejemplo />);
        fireEvent.click(screen.getByRole("button", { name: "Fallar" }));
        act(() => vi.advanceTimersByTime(200));
        fireEvent.click(document.body);
        expect(screen.getByRole("alert")).toBeInTheDocument();
        fireEvent.keyDown(document, { key: "Escape" });
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("Escape cierra primero el toast sin cerrar el panel ni mover su foco", () => {
        const cerrarPanel = vi.fn();
        render(<div onKeyDown={(evento) => { if (evento.key === "Escape") cerrarPanel(); }}><Ejemplo /></div>);
        const boton = screen.getByRole("button", { name: "Fallar" });
        boton.focus();
        fireEvent.click(boton);
        fireEvent.keyDown(boton, { key: "Escape" });
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(cerrarPanel).not.toHaveBeenCalled();
        expect(boton).toHaveFocus();
        fireEvent.keyDown(boton, { key: "Escape" });
        expect(cerrarPanel).toHaveBeenCalledOnce();
    });

    it("apila los tres avisos más recientes de distintos emisores y descarta el más antiguo", () => {
        render(<><Emisor nombre="Uno" /><Emisor nombre="Dos" /></>);
        fireEvent.click(screen.getByRole("button", { name: "Uno" }));
        fireEvent.click(screen.getByRole("button", { name: "Dos" }));
        fireEvent.click(screen.getByRole("button", { name: "Uno" }));
        expect(screen.getAllByRole("status").map((elemento) => elemento.textContent)).toEqual(["Uno 1", "Dos 1", "Uno 2"]);
        fireEvent.click(screen.getByRole("button", { name: "Dos" }));
        expect(screen.getAllByRole("status").map((elemento) => elemento.textContent)).toEqual(["Dos 1", "Uno 2", "Dos 2"]);
        fireEvent.click(within(screen.getAllByRole("status")[1]).getByRole("button", { name: "Cerrar notificación" }));
        expect(screen.getAllByRole("status").map((elemento) => elemento.textContent)).toEqual(["Dos 1", "Dos 2"]);
    });

    it("limpiar un emisor conserva los avisos del otro", () => {
        render(<><Emisor nombre="Uno" /><Emisor nombre="Dos" /></>);
        fireEvent.click(screen.getByRole("button", { name: "Uno" }));
        fireEvent.click(screen.getByRole("button", { name: "Dos" }));
        fireEvent.click(screen.getByRole("button", { name: "Limpiar Uno" }));
        expect(screen.getByRole("status")).toHaveTextContent("Dos 1");
    });

    it("conserva avisos y recibe resultados pendientes después de desmontar el formulario", async () => {
        let resolver!: () => void;
        const guardado = new Promise<void>((resolve) => { resolver = resolve; });
        function FormularioPendiente() {
            const { notificar } = useNotificacionToast();
            return <button onClick={async () => { notificar("Guardando", "info"); await guardado; notificar("Guardado", "success"); }}>Enviar</button>;
        }
        const vista = render(<FormularioPendiente />);
        fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
        vista.rerender(<div>Otra página</div>);
        expect(screen.getByRole("status")).toHaveTextContent("Guardando");
        await act(async () => resolver());
        expect(screen.getAllByRole("status").map((elemento) => elemento.textContent)).toEqual(["Guardando", "Guardado"]);
    });

    it("Escape elimina únicamente el más reciente", () => {
        render(<Emisor nombre="Aviso" />);
        fireEvent.click(screen.getByRole("button", { name: "Aviso" }));
        fireEvent.click(screen.getByRole("button", { name: "Aviso" }));
        fireEvent.keyDown(document, { key: "Escape" });
        expect(screen.getByRole("status")).toHaveTextContent("Aviso 1");
    });

    it("cada aviso conserva su propio plazo aunque se agreguen o cierren otros", () => {
        vi.useFakeTimers();
        render(<Emisor nombre="Aviso" />);
        fireEvent.click(screen.getByRole("button", { name: "Aviso" }));
        act(() => vi.advanceTimersByTime(4000));
        fireEvent.click(screen.getByRole("button", { name: "Aviso" }));
        act(() => vi.advanceTimersByTime(1000));
        expect(screen.getByRole("status")).toHaveTextContent("Aviso 2");
        act(() => vi.advanceTimersByTime(4000));
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("no consume avisos mientras la ventana pierde el foco", () => {
        vi.useFakeTimers();
        render(<Ejemplo />);
        fireEvent.blur(window);
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
        act(() => vi.advanceTimersByTime(10000));
        expect(screen.getByRole("status")).toBeInTheDocument();
        fireEvent.focus(window);
        act(() => vi.advanceTimersByTime(5000));
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("mantiene la pausa con foco aunque salga el puntero", () => {
        vi.useFakeTimers();
        render(<Ejemplo />);
        fireEvent.click(screen.getByRole("button", { name: "Fallar" }));
        const aviso = screen.getByRole("alert");
        fireEvent.mouseEnter(aviso);
        fireEvent.focus(within(aviso).getByRole("button"));
        fireEvent.mouseLeave(aviso);
        act(() => vi.advanceTimersByTime(10000));
        expect(aviso).toBeInTheDocument();
        fireEvent.blur(within(aviso).getByRole("button"), { relatedTarget: document.body });
        act(() => vi.advanceTimersByTime(5000));
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("mantiene accesible un aviso anterior al abrir y cerrar un drawer", async () => {
        function Pantalla() {
            const [abierto, setAbierto] = useState(false);
            return <><Ejemplo /><button onClick={() => setAbierto(true)}>Abrir panel</button>
                <Drawer open={abierto} onClose={() => setAbierto(false)} slotProps={{ paper: { role: "dialog", "aria-label": "Panel" } }}>
                    <button onClick={() => setAbierto(false)}>Cerrar panel</button>
                </Drawer></>;
        }
        render(<Pantalla />);
        fireEvent.click(screen.getByRole("button", { name: "Fallar" }));
        fireEvent.click(screen.getByRole("button", { name: "Abrir panel" }));
        await waitFor(() => expect(within(screen.getByRole("dialog", { name: "Panel" })).getByRole("alert")).toHaveTextContent("No se pudo guardar."));
        const cruz = screen.getByRole("button", { name: "Cerrar notificación" });
        act(() => cruz.focus());
        expect(cruz).toHaveFocus();
        fireEvent.click(screen.getByRole("button", { name: "Cerrar panel" }));
        await waitFor(() => expect(screen.queryByRole("dialog", { name: "Panel" })).not.toBeInTheDocument());
        expect(screen.getByRole("alert")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Cerrar notificación" }));
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("adapta el espacio del aviso al viewport visible y sus desplazamientos", () => {
        const viewport = Object.assign(new EventTarget(), { width: 360, height: 400, offsetTop: 20, offsetLeft: 0 });
        vi.stubGlobal("visualViewport", viewport);
        render(<Ejemplo />);
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
        const pila = screen.getByRole("region", { name: "Notificaciones" });
        expect(pila.style.getPropertyValue("--toast-alto-visible")).toBe("400px");
        expect(pila.style.getPropertyValue("--toast-inferior")).toBe(`${window.innerHeight - 420}px`);
        viewport.height = 500;
        viewport.offsetTop = 0;
        act(() => viewport.dispatchEvent(new Event("resize")));
        expect(pila.style.getPropertyValue("--toast-alto-visible")).toBe("500px");
        expect(pila.style.getPropertyValue("--toast-inferior")).toBe(`${window.innerHeight - 500}px`);
    });

    it("ignora mensajes vacíos", () => {
        function Vacio() {
            const { notificar } = useNotificacionToast();
            return <button onClick={() => notificar("   ", "info")}>Enviar vacío</button>;
        }
        render(<Vacio />);
        fireEvent.click(screen.getByRole("button", { name: "Enviar vacío" }));
        expect(screen.queryByRole("region", { name: "Notificaciones" })).not.toBeInTheDocument();
    });
});
