import { act, fireEvent, render as renderOriginal, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import type { FormEvent, ReactElement } from "react";
import Drawer from "@mui/material/Drawer";
import Dialog from "@mui/material/Dialog";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
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

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() });

function Emisor({ nombre }: { nombre: string }) {
    const { notificar, cerrarNotificacion } = useNotificacionToast();
    const [cantidad, setCantidad] = useState(0);
    return <>
        <button onClick={() => { notificar(`${nombre} ${cantidad + 1}`, "success"); setCantidad(cantidad + 1) }}>{nombre}</button>
        <button onClick={cerrarNotificacion}>Limpiar {nombre}</button>
    </>;
}

describe("NotificacionToast", () => {
    it("agrupa errores nativos en un toast y mantiene bloqueado el envío inválido", async () => {
        const enviar = vi.fn((evento: FormEvent<HTMLFormElement>) => evento.preventDefault());
        render(<form onSubmit={enviar}>
            <label>Nombre<input name="nombre" required /></label>
            <label>Correo<input name="correo" type="email" required /></label>
            <button type="submit">Enviar</button>
        </form>);
        fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
        const aviso = await screen.findByRole("alert");
        expect(screen.getAllByRole("alert")).toHaveLength(1);
        expect(aviso).toHaveTextContent("Faltan completar campos obligatorios.");
        expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveAttribute("aria-invalid", "true");
        expect(screen.getByRole("textbox", { name: "Correo" })).toHaveAttribute("aria-invalid", "true");
        expect(enviar).not.toHaveBeenCalled();
        expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveFocus();

        fireEvent.change(screen.getByRole("textbox", { name: "Nombre" }), { target: { value: "Ana" } });
        fireEvent.change(screen.getByRole("textbox", { name: "Correo" }), { target: { value: "ana@example.com" } });
        expect(screen.getByRole("textbox", { name: "Nombre" })).not.toHaveAttribute("aria-invalid", "true");
        expect(screen.getByRole("textbox", { name: "Correo" })).not.toHaveAttribute("data-error-validacion");
        fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
        expect(enviar).toHaveBeenCalledOnce();
    });

    it("valida blancos con noValidate, sin exigir campos opcionales ni deshabilitados", async () => {
        const enviar = vi.fn((evento: FormEvent<HTMLFormElement>) => evento.preventDefault());
        render(<form noValidate onSubmit={enviar} aria-label="Datos">
            <label>Nombre<input required defaultValue="   " /></label>
            <label>Comentario<input /></label>
            <label>Automático<input required disabled /></label>
            <button type="submit">Guardar datos</button>
        </form>);
        expect(screen.getByRole("textbox", { name: "Nombre" })).not.toHaveAttribute("aria-invalid");
        fireEvent.submit(screen.getByRole("form", { name: "Datos" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("Faltan completar campos obligatorios.");
        expect(enviar).not.toHaveBeenCalled();
        expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveAttribute("data-error-validacion", "true");
        expect(screen.getByRole("textbox", { name: "Comentario" })).not.toHaveAttribute("aria-invalid");
        expect(screen.getByRole("textbox", { name: "Automático" })).not.toHaveAttribute("aria-invalid");
        fireEvent.change(screen.getByRole("textbox", { name: "Nombre" }), { target: { value: "Ana" } });
        fireEvent.submit(screen.getByRole("form", { name: "Datos" }));
        expect(enviar).toHaveBeenCalledOnce();
    });

    it("marca y enfoca el select visible de MUI y lo limpia al elegir una opción", async () => {
        render(<form noValidate aria-label="Publicación">
            <TextField select required label="Especie" defaultValue="">
                <MenuItem value="">Seleccionar</MenuItem>
                <MenuItem value="1">Manzana</MenuItem>
            </TextField>
        </form>);
        const selector = screen.getByRole("combobox", { name: /Especie/ });
        fireEvent.submit(screen.getByRole("form", { name: "Publicación" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("Faltan completar campos obligatorios.");
        expect(selector).toHaveAttribute("aria-invalid", "true");
        expect(selector).toHaveAttribute("data-error-validacion", "true");
        expect(selector).toHaveFocus();
        fireEvent.mouseDown(selector);
        fireEvent.click(screen.getByRole("option", { name: "Manzana" }));
        await waitFor(() => expect(selector).not.toHaveAttribute("aria-invalid", "true"));
        expect(selector).not.toHaveAttribute("data-error-validacion");
    });

    it("respeta formNoValidate para cancelar sin completar los campos", () => {
        const enviar = vi.fn((evento: FormEvent<HTMLFormElement>) => evento.preventDefault());
        render(<form aria-label="Verificación" onSubmit={enviar}>
            <label>Código<input required /></label>
            <button type="submit" formNoValidate>Cancelar</button>
        </form>);
        fireEvent(screen.getByRole("form", { name: "Verificación" }), new SubmitEvent("submit", {
            bubbles: true, cancelable: true, submitter: screen.getByRole("button", { name: "Cancelar" }),
        }));
        expect(enviar).toHaveBeenCalledOnce();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(screen.getByRole("textbox", { name: "Código" })).not.toHaveAttribute("aria-invalid");
    });

    it("muestra el error nativo de formato sin el globo del navegador", async () => {
        render(<form>
            <label>Correo<input name="correo" type="email" defaultValue="invalido" /></label>
        </form>);
        const campo = screen.getByRole("textbox", { name: "Correo" });
        const invalidacion = new Event("invalid", { cancelable: true });
        act(() => { campo.dispatchEvent(invalidacion) });
        expect(invalidacion.defaultPrevented).toBe(true);
        expect(await screen.findByRole("alert")).toHaveTextContent("Ingresá un correo electrónico válido en «Correo».");
    });

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
        render(<div onKeyDown={(evento) => { if (evento.key === "Escape") cerrarPanel() }}><Ejemplo /></div>);
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
        const guardado = new Promise<void>((resolve) => { resolver = resolve });
        function FormularioPendiente() {
            const { notificar } = useNotificacionToast();
            return <button onClick={async () => { notificar("Guardando", "info"); await guardado; notificar("Guardado", "success") }}>Enviar</button>;
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

    it.each(["drawer", "dialog"] as const)("muestra un nuevo aviso cuando el anterior venció dentro de un %s que ya se desmontó", async (tipoPanel) => {
        vi.useFakeTimers();
        const descriptorPopover = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "showPopover");
        const mostrarPopover = vi.fn(function (this: HTMLElement) {
            if (!this.isConnected) throw new DOMException("Invalid on disconnected popover elements.", "InvalidStateError");
            this.style.display = "block";
        });
        Object.defineProperty(HTMLElement.prototype, "showPopover", { configurable: true, value: mostrarPopover });
        function Pantalla() {
            const [abierto, setAbierto] = useState(true);
            const { notificar } = useNotificacionToast();
            const Panel = tipoPanel === "drawer" ? Drawer : Dialog;
            return <><Ejemplo />{abierto && <Panel open transitionDuration={0} slotProps={{ paper: { role: "dialog", "aria-label": "Panel" } }}>
                <button onClick={() => notificar("Aviso anterior", "success")}>Avisar dentro</button>
                <button onClick={() => setAbierto(false)}>Cerrar panel</button>
            </Panel>}</>;
        }
        try {
            render(<Pantalla />);
            fireEvent.click(screen.getByRole("button", { name: "Avisar dentro" }));
            expect(within(screen.getByRole("dialog", { name: "Panel" })).getByRole("status")).toHaveTextContent("Aviso anterior");
            await act(async () => vi.advanceTimersByTime(5000));
            await act(async () => vi.advanceTimersByTime(160));
            expect(screen.queryByRole("region", { name: "Notificaciones", hidden: true })).not.toBeInTheDocument();
            fireEvent.click(screen.getByRole("button", { name: "Cerrar panel" }));
            expect(screen.queryByRole("dialog", { name: "Panel", hidden: true })).not.toBeInTheDocument();
            fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
            await act(async () => {});
            expect(screen.getByRole("status")).toHaveTextContent("Cambios guardados.");
            expect(screen.getByRole("region", { name: "Notificaciones" })).toHaveAttribute("popover", "manual");
            expect(mostrarPopover).toHaveBeenCalledTimes(2);
        } finally {
            if (descriptorPopover) Object.defineProperty(HTMLElement.prototype, "showPopover", descriptorPopover);
            else Reflect.deleteProperty(HTMLElement.prototype, "showPopover");
        }
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
