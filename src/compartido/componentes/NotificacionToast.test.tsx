import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import NotificacionToast, { useNotificacionToast } from "./NotificacionToast";

function Ejemplo() {
    const { notificacion, notificar, cerrarNotificacion } = useNotificacionToast();
    return (
        <form aria-label="Formulario de prueba">
            <button type="button" onClick={() => notificar("Cambios guardados.", "success")}>Guardar</button>
            <button type="button" onClick={() => notificar("No se pudo guardar.", "error")}>Fallar</button>
            <NotificacionToast notificacion={notificacion} alCerrar={cerrarNotificacion} />
        </form>
    );
}

afterEach(() => vi.useRealTimers());

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

    it("reinicia los seis segundos cuando se repite una acción", () => {
        vi.useFakeTimers();
        render(<Ejemplo />);
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
        act(() => vi.advanceTimersByTime(5000));
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
        act(() => vi.advanceTimersByTime(5000));
        expect(screen.getByRole("status")).toBeInTheDocument();
        act(() => vi.advanceTimersByTime(1000));
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
        act(() => vi.advanceTimersByTime(6000));
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
});
