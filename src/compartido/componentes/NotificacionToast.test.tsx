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

function simularMedidaNotificaciones(medir: () => DOMRect) {
    const medirOriginal = HTMLDivElement.prototype.getBoundingClientRect;
    return vi.spyOn(HTMLDivElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLDivElement) {
        return this.getAttribute("role") === "region" && this.getAttribute("aria-label") === "Notificaciones"
            ? medir() : medirOriginal.call(this);
    });
}

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

    it.each(["right", "bottom"] as const)("reserva las acciones del drawer %s en mobile y recupera el espacio al cerrarlo", async (anchor) => {
        vi.stubGlobal("innerWidth", 390);
        function Pantalla() {
            const [abierto, setAbierto] = useState(true);
            return <Drawer anchor={anchor} open={abierto} transitionDuration={0} slotProps={{ paper: { role: "dialog", "aria-label": "Panel" } }}>
                <Ejemplo />
                <div data-acciones-modal role="group" aria-label="Acciones del panel">
                    <button onClick={() => setAbierto(false)}>Cancelar</button>
                </div>
            </Drawer>;
        }
        render(<Pantalla />);
        const acciones = screen.getByRole("group", { name: "Acciones del panel" });
        const izquierda = anchor === "right" ? window.innerWidth - 360 : 0;
        const ancho = anchor === "right" ? 360 : window.innerWidth;
        const medir = vi.spyOn(acciones, "getBoundingClientRect").mockReturnValue(new DOMRect(izquierda, window.innerHeight - 88, ancho, 88));
        const medirPila = simularMedidaNotificaciones(() => new DOMRect(window.innerWidth - 344, window.innerHeight - 160, 328, 56));
        try {
            fireEvent.click(screen.getByRole("button", { name: "Fallar" }));
            expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo guardar.");
            const pila = screen.getByRole("region", { name: "Notificaciones" });
            expect(pila.style.getPropertyValue("--toast-inferior")).toBe("88px");
            expect(pila.style.getPropertyValue("--toast-alto-visible")).toBe(`${window.innerHeight - 88}px`);

            medir.mockReturnValue(new DOMRect(izquierda, window.innerHeight - 160, ancho, 160));
            fireEvent.transitionEnd(screen.getByRole("dialog", { name: "Panel" }));
            expect(pila.style.getPropertyValue("--toast-inferior")).toBe("160px");
            expect(pila.style.getPropertyValue("--toast-alto-visible")).toBe(`${window.innerHeight - 160}px`);

            fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
            await waitFor(() => expect(screen.queryByRole("dialog", { name: "Panel" })).not.toBeInTheDocument());
            await waitFor(() => expect(screen.getByRole("region", { name: "Notificaciones" }).style.getPropertyValue("--toast-inferior")).toBe("0px"));
        } finally {
            medir.mockRestore();
            medirPila.mockRestore();
        }
    });

    it.each([["drawer", 768], ["dialog", 1024], ["página", 1440]] as const)("mantiene el aviso abajo a la derecha en %s de escritorio a %i px aunque coincida con las acciones", async (contexto, ancho) => {
        vi.stubGlobal("innerWidth", ancho);
        vi.stubGlobal("innerHeight", 844);
        const medirPila = simularMedidaNotificaciones(() => new DOMRect(ancho - 464, 764, 448, 56));
        const contenido = <>
            <Ejemplo />
            <div data-acciones-modal={contexto !== "página" || undefined} data-acciones-flotantes={contexto === "página" || undefined}
                role="group" aria-label="Acciones inferiores" ref={(elemento) => {
                    if (elemento) elemento.getBoundingClientRect = () => new DOMRect(ancho - 360, 684, 360, 160);
                }}><button>Guardar configuración</button></div>
        </>;
        try {
            render(contexto === "drawer"
                ? <Drawer anchor="right" open transitionDuration={0}>{contenido}</Drawer>
                : contexto === "dialog" ? <Dialog open transitionDuration={0}>{contenido}</Dialog> : contenido);
            fireEvent.click(screen.getByRole("button", { name: "Fallar" }));
            const pila = await screen.findByRole("region", { name: "Notificaciones" });
            expect(screen.getByRole("alert")).toHaveTextContent("No se pudo guardar.");
            expect(pila.style.getPropertyValue("--toast-inferior")).toBe("0px");
            expect(pila.style.getPropertyValue("--toast-derecha")).toBe("0px");
            expect(pila.style.getPropertyValue("--toast-alto-visible")).toBe("844px");
        } finally {
            medirPila.mockRestore();
        }
    });

    it.each(["drawer", "página"] as const)("conserva las acciones inferiores de %s al abrir un select y mantiene el vencimiento del aviso", async (contexto) => {
        vi.useFakeTimers();
        vi.stubGlobal("innerWidth", 390);
        vi.stubGlobal("innerHeight", 844);
        const enDrawer = contexto === "drawer";
        function Pantalla() {
            const contenido = <>
                <Ejemplo />
                <TextField select label="Especie" defaultValue="1" slotProps={{ select: { MenuProps: { transitionDuration: 0 } } }}>
                    <MenuItem value="1">Manzana</MenuItem>
                    <MenuItem value="2">Pera</MenuItem>
                </TextField>
            </>;
            return enDrawer ? (
                <Drawer anchor="bottom" open transitionDuration={0} slotProps={{ paper: { role: "dialog", "aria-label": "Publicación" } }}>
                    {contenido}
                    <div data-acciones-modal role="group" aria-label="Acciones inferiores"><button>Confirmar</button></div>
                </Drawer>
            ) : <>
                {contenido}
                <button data-acciones-flotantes aria-label="Acciones inferiores">Guardar configuración</button>
                <Drawer open={false} transitionDuration={0} ModalProps={{ keepMounted: true }} style={{ display: "none" }}>
                    <div data-acciones-modal ref={(elemento) => {
                        if (elemento) elemento.getBoundingClientRect = () => new DOMRect(0, 444, 390, 400);
                    }}><button>Acciones del drawer oculto</button></div>
                </Drawer>
            </>;
        }
        const medirPila = simularMedidaNotificaciones(() => new DOMRect(16, 668, 358, 56));
        const vista = render(<Pantalla />);
        const contenedorOriginal = enDrawer ? screen.getByRole("dialog", { name: "Publicación" }) : document.body;
        const acciones = screen.getByLabelText("Acciones inferiores");
        const medirAcciones = vi.fn(() => new DOMRect(0, 756, 390, 88));
        Object.defineProperty(acciones, "getBoundingClientRect", { configurable: true, value: medirAcciones });
        const selector = screen.getByRole("combobox", { name: "Especie" });
        const anclaSelector = selector.parentElement!;
        Object.defineProperty(anclaSelector, "getBoundingClientRect", { configurable: true, value: () => new DOMRect(16, 200, 358, 40) });
        try {
            fireEvent.click(screen.getByRole("button", { name: "Fallar" }));
            await act(async () => {});
            const pilaInicial = screen.getByRole("region", { name: "Notificaciones" });
            expect(pilaInicial.parentElement).toBe(contenedorOriginal);
            expect(pilaInicial.style.getPropertyValue("--toast-inferior")).toBe("88px");
            await act(async () => vi.advanceTimersByTime(2000));

            fireEvent.mouseDown(selector);
            await act(async () => vi.advanceTimersByTime(0));
            const menu = screen.getByRole("listbox").closest<HTMLElement>(".MuiPopover-paper")!;
            const pilaEnMenu = within(menu).getByRole("region", { name: "Notificaciones" });
            expect(within(menu).getByRole("alert")).toHaveTextContent("No se pudo guardar.");
            expect(screen.getAllByRole("alert")).toHaveLength(1);
            expect(pilaEnMenu.style.getPropertyValue("--toast-inferior")).toBe("88px");
            expect(pilaEnMenu.style.getPropertyValue("--toast-alto-visible")).toBe("756px");

            medirAcciones.mockReturnValue(new DOMRect(0, 684, 390, 160));
            fireEvent(window, new Event("resize"));
            expect(pilaEnMenu.style.getPropertyValue("--toast-inferior")).toBe("160px");
            expect(pilaEnMenu.style.getPropertyValue("--toast-alto-visible")).toBe("684px");
            await act(async () => vi.advanceTimersByTime(1000));

            fireEvent.click(screen.getByRole("option", { name: "Pera" }));
            await act(async () => vi.advanceTimersByTime(0));
            expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
            const pilaRestaurada = screen.getByRole("region", { name: "Notificaciones" });
            expect(pilaRestaurada.parentElement).toBe(contenedorOriginal);
            expect(pilaRestaurada.style.getPropertyValue("--toast-inferior")).toBe("160px");
            expect(screen.getByRole("alert")).toHaveTextContent("No se pudo guardar.");
            expect(selector).toHaveTextContent("Pera");

            await act(async () => vi.advanceTimersByTime(1999));
            expect(screen.getByRole("alert")).toHaveTextContent("No se pudo guardar.");
            await act(async () => vi.advanceTimersByTime(1));
            await act(async () => vi.advanceTimersByTime(160));
            expect(screen.queryByRole("region", { name: "Notificaciones", hidden: true })).not.toBeInTheDocument();
        } finally {
            vista.unmount();
            Reflect.deleteProperty(acciones, "getBoundingClientRect");
            Reflect.deleteProperty(anclaSelector, "getBoundingClientRect");
            medirPila.mockRestore();
        }
    });

    it("no levanta el aviso si las acciones del mapa quedan a su izquierda", async () => {
        render(<Dialog open transitionDuration={0} slotProps={{ paper: { role: "dialog", "aria-label": "Mapa" } }}>
            <Ejemplo />
            <footer role="group" aria-label="Acciones del mapa"><button>Agregar punto</button></footer>
        </Dialog>);
        const medirPila = simularMedidaNotificaciones(() => new DOMRect(window.innerWidth - 464, window.innerHeight - 80, 448, 56));
        const medirAcciones = vi.spyOn(screen.getByRole("group", { name: "Acciones del mapa" }), "getBoundingClientRect")
            .mockReturnValue(new DOMRect(64, window.innerHeight - 190, 320, 80));
        try {
            fireEvent.click(screen.getByRole("button", { name: "Fallar" }));
            expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo guardar.");
            const pila = screen.getByRole("region", { name: "Notificaciones" });
            expect(pila.style.getPropertyValue("--toast-inferior")).toBe("0px");
            expect(pila.style.getPropertyValue("--toast-alto-visible")).toBe(`${window.innerHeight}px`);
            expect(within(screen.getByRole("dialog", { name: "Mapa" })).getByRole("alert")).toBeInTheDocument();
        } finally {
            medirAcciones.mockRestore();
            medirPila.mockRestore();
        }
    });

    it("reserva la barra flotante de la página mientras está visible y recupera el espacio al ocultarse", async () => {
        vi.stubGlobal("innerWidth", 390);
        vi.stubGlobal("innerHeight", 844);
        let limitesAcciones = new DOMRect(16, 764, 358, 64);
        function Pantalla() {
            const [modificado, setModificado] = useState(false);
            return <>
                <Ejemplo />
                <button onClick={() => setModificado(true)}>Modificar</button>
                {modificado && <div data-acciones-flotantes ref={(elemento) => {
                    if (elemento) elemento.getBoundingClientRect = () => limitesAcciones;
                }}><button onClick={() => setModificado(false)}>Cancelar cambios</button></div>}
                <footer ref={(elemento) => {
                    if (elemento) elemento.getBoundingClientRect = () => new DOMRect(0, 600, 390, 244);
                }}>Pie de la página</footer>
                <div className="MuiModal-root" aria-hidden="true"><div data-acciones-flotantes ref={(elemento) => {
                    if (elemento) elemento.getBoundingClientRect = () => new DOMRect(0, 500, 390, 344);
                }}>Acciones de un modal inactivo</div></div>
            </>;
        }
        const medirPila = simularMedidaNotificaciones(() => new DOMRect(16, 680, 358, 56));
        try {
            render(<Pantalla />);
            fireEvent.click(screen.getByRole("button", { name: "Fallar" }));
            const pila = await screen.findByRole("region", { name: "Notificaciones" });
            expect(pila.style.getPropertyValue("--toast-inferior")).toBe("0px");

            fireEvent.click(screen.getByRole("button", { name: "Modificar" }));
            await waitFor(() => expect(pila.style.getPropertyValue("--toast-inferior")).toBe("80px"));
            expect(pila.style.getPropertyValue("--toast-alto-visible")).toBe("764px");

            limitesAcciones = new DOMRect(16, -80, 358, 64);
            fireEvent.scroll(document);
            expect(pila.style.getPropertyValue("--toast-inferior")).toBe("0px");

            limitesAcciones = new DOMRect(16, 740, 358, 88);
            fireEvent(window, new Event("resize"));
            expect(pila.style.getPropertyValue("--toast-inferior")).toBe("104px");

            fireEvent.click(screen.getByRole("button", { name: "Cancelar cambios" }));
            await waitFor(() => expect(pila.style.getPropertyValue("--toast-inferior")).toBe("0px"));
            expect(screen.getByRole("alert")).toHaveTextContent("No se pudo guardar.");
        } finally {
            medirPila.mockRestore();
        }
    });

    it("reserva las acciones del mapa al pasar a mobile y recupera el espacio al volver a escritorio", async () => {
        render(<Dialog open transitionDuration={0} slotProps={{ paper: { role: "dialog", "aria-label": "Mapa" } }}>
            <Ejemplo />
            <footer role="group" aria-label="Acciones del mapa"><button>Agregar punto</button></footer>
        </Dialog>);
        const anchoEscritorio = window.innerWidth;
        let rectanguloPila = new DOMRect(anchoEscritorio - 464, window.innerHeight - 80, 448, 56);
        const medirPila = simularMedidaNotificaciones(() => rectanguloPila);
        const medirAcciones = vi.spyOn(screen.getByRole("group", { name: "Acciones del mapa" }), "getBoundingClientRect")
            .mockReturnValue(new DOMRect(64, window.innerHeight - 190, 320, 80));
        try {
            fireEvent.click(screen.getByRole("button", { name: "Fallar" }));
            const pila = await screen.findByRole("region", { name: "Notificaciones" });
            expect(pila.style.getPropertyValue("--toast-inferior")).toBe("0px");

            vi.stubGlobal("innerWidth", 390);
            rectanguloPila = new DOMRect(16, window.innerHeight - 160, 358, 56);
            medirAcciones.mockReturnValue(new DOMRect(0, window.innerHeight - 88, 390, 88));
            fireEvent(window, new Event("resize"));
            await waitFor(() => expect(pila.style.getPropertyValue("--toast-inferior")).toBe("88px"));
            expect(pila.style.getPropertyValue("--toast-ancho-visible")).toBe("390px");

            vi.stubGlobal("innerWidth", anchoEscritorio);
            rectanguloPila = new DOMRect(anchoEscritorio - 464, window.innerHeight - 80, 448, 56);
            medirAcciones.mockReturnValue(new DOMRect(64, window.innerHeight - 190, 320, 80));
            fireEvent(window, new Event("resize"));
            await waitFor(() => expect(pila.style.getPropertyValue("--toast-inferior")).toBe("0px"));
            expect(pila.style.getPropertyValue("--toast-alto-visible")).toBe(`${window.innerHeight}px`);
        } finally {
            medirAcciones.mockRestore();
            medirPila.mockRestore();
        }
    });

    it("ignora las acciones del drawer oculto mientras el mapa está abierto y las recupera al cerrarlo", async () => {
        vi.stubGlobal("innerWidth", 390);
        function Pantalla() {
            const [mapaAbierto, setMapaAbierto] = useState(false);
            return <Drawer anchor="right" open transitionDuration={0} slotProps={{ paper: { role: "dialog", "aria-label": "Publicación" } }}>
                <Ejemplo />
                <button onClick={() => setMapaAbierto(true)}>Abrir mapa</button>
                <footer role="group" aria-label="Acciones de publicación"><button>Guardar publicación</button></footer>
                <Dialog open={mapaAbierto} transitionDuration={0} slotProps={{ paper: { role: "dialog", "aria-label": "Mapa" } }}>
                    <footer role="group" aria-label="Acciones del mapa"><button onClick={() => setMapaAbierto(false)}>Cerrar mapa</button></footer>
                </Dialog>
            </Drawer>;
        }
        render(<Pantalla />);
        const medirPila = simularMedidaNotificaciones(() => new DOMRect(window.innerWidth - 344, window.innerHeight - 160, 328, 56));
        const medirDrawer = vi.spyOn(screen.getByRole("group", { name: "Acciones de publicación" }), "getBoundingClientRect")
            .mockReturnValue(new DOMRect(window.innerWidth - 360, window.innerHeight - 96, 360, 96));
        try {
            fireEvent.click(screen.getByRole("button", { name: "Fallar" }));
            const pilaInicial = await screen.findByRole("region", { name: "Notificaciones" });
            expect(pilaInicial.style.getPropertyValue("--toast-inferior")).toBe("96px");
            fireEvent.click(screen.getByRole("button", { name: "Abrir mapa" }));
            const mapa = await screen.findByRole("dialog", { name: "Mapa" });
            const medirMapa = vi.spyOn(within(mapa).getByRole("group", { name: "Acciones del mapa" }), "getBoundingClientRect")
                .mockReturnValue(new DOMRect(0, window.innerHeight - 64, 390, 64));
            try {
                fireEvent.transitionEnd(mapa);
                await waitFor(() => expect(within(mapa).getByRole("region", { name: "Notificaciones" }).style.getPropertyValue("--toast-inferior")).toBe("64px"));
                fireEvent.click(within(mapa).getByRole("button", { name: "Cerrar mapa" }));
                await waitFor(() => expect(screen.queryByRole("dialog", { name: "Mapa" })).not.toBeInTheDocument());
                await waitFor(() => expect(within(screen.getByRole("dialog", { name: "Publicación" })).getByRole("region", { name: "Notificaciones" }).style.getPropertyValue("--toast-inferior")).toBe("96px"));
            } finally {
                medirMapa.mockRestore();
            }
        } finally {
            medirDrawer.mockRestore();
            medirPila.mockRestore();
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
