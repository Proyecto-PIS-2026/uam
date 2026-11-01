import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import VistaNotificaciones from "./VistaNotificaciones";
import { notificarCambioNotificaciones } from "../cliente";
import type { NotificacionesUsuario } from "../tipos";

vi.mock("../cliente", () => ({ notificarCambioNotificaciones: vi.fn() }));
vi.mock("@/compartido/componentes/NotificacionToast", async (importOriginal) => {
    const original = await importOriginal<typeof import("@/compartido/componentes/NotificacionToast")>();
    return {
        ...original,
        default: ({ notificacion, alCerrar }: Parameters<typeof original.default>[0]) => notificacion && <div role={notificacion.tipo === "error" ? "alert" : "status"}>
            {notificacion.mensaje}<button onClick={alCerrar}>Cerrar notificación</button>
        </div>,
    };
});

const modalOriginal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const cierreOriginal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");

function listado(): NotificacionesUsuario {
    return {
        notificaciones: [
            { id: 11, texto: "Tu publicación necesita una nueva foto.", url: "/mi-mercado?publicacion=5", leida: false, fecha: "2026-10-27T12:15:00.000Z" },
            { id: 12, texto: "Se actualizaron los precios de referencia.", url: null, leida: true, fecha: "2026-10-26T03:05:00.000Z" },
        ],
        noLeidas: 1,
    };
}

function respuesta(datos: unknown, status = 200): Response {
    return { ok: status >= 200 && status < 300, status, json: async () => datos } as Response;
}

function pendiente() {
    let resolver!: (respuesta: Response) => void;
    const promesa = new Promise<Response>((resolve) => { resolver = resolve; });
    return { promesa, resolver };
}

function fila(texto: string) {
    return screen.getByText(texto).closest("li")!;
}

async function abrir(datos = listado()) {
    vi.mocked(fetch).mockResolvedValueOnce(respuesta(datos));
    const vista = render(<VistaNotificaciones usuarioId={7} />);
    await waitFor(() => expect(screen.queryByText("Cargando notificaciones...")).not.toBeInTheDocument());
    return vista;
}

describe("VistaNotificaciones", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal("fetch", vi.fn());
        vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
        vi.stubGlobal("matchMedia", vi.fn((consulta: string) => ({
            matches: consulta === "(prefers-reduced-motion: reduce)", media: consulta, onchange: null,
            addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
        })));
        Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
        Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } });
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        if (modalOriginal) Object.defineProperty(HTMLDialogElement.prototype, "showModal", modalOriginal);
        else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
        if (cierreOriginal) Object.defineProperty(HTMLDialogElement.prototype, "close", cierreOriginal);
        else Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
    });

    it("distingue la carga del vacío y muestra fecha y hora de Montevideo al recibir los avisos", async () => {
        const carga = pendiente();
        vi.mocked(fetch).mockReturnValueOnce(carga.promesa);
        render(<VistaNotificaciones usuarioId={7} />);
        expect(screen.getByRole("heading", { name: "Notificaciones", level: 1 })).toBeVisible();
        expect(screen.getByRole("status")).toHaveTextContent("Cargando notificaciones...");
        expect(screen.queryByText("No tenés notificaciones")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Leer todo" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Borrar todo" })).toBeDisabled();
        await act(async () => carga.resolver(respuesta(listado())));
        expect(screen.getByRole("list", { name: "Notificaciones recibidas" })).toBeVisible();
        expect(screen.getByText(/27\/10\/2026.*09:15/)).toHaveAttribute("dateTime", "2026-10-27T12:15:00.000Z");
        expect(screen.getByText(/26\/10\/2026.*00:05/)).toBeVisible();
        expect(screen.getByText("1 notificación sin leer")).toBeVisible();
        expect(fila(listado().notificaciones[0].texto)).toHaveAttribute("data-leida", "false");
        expect(fila(listado().notificaciones[1].texto)).toHaveAttribute("data-leida", "true");
        expect(notificarCambioNotificaciones).toHaveBeenLastCalledWith(7, 1);
    });

    it("muestra el estado vacío solo después de una carga correcta y deshabilita las acciones globales", async () => {
        await abrir({ notificaciones: [], noLeidas: 0 });
        expect(screen.getByRole("heading", { name: "No tenés notificaciones" })).toBeVisible();
        expect(screen.queryByRole("list")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Leer todo" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Borrar todo" })).toBeDisabled();
        expect(notificarCambioNotificaciones).toHaveBeenLastCalledWith(7, 0);
    });

    it("permite navegar desde el texto sin marcar automáticamente la notificación como leída", async () => {
        await abrir();
        const enlace = screen.getByRole("link", { name: listado().notificaciones[0].texto });
        expect(enlace).toHaveAttribute("href", "/mi-mercado?publicacion=5");
        enlace.addEventListener("click", (evento) => evento.preventDefault());
        fireEvent.click(enlace);
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(within(fila(listado().notificaciones[0].texto)).getByText("No leída")).toBeVisible();
        expect(screen.queryByRole("link", { name: listado().notificaciones[1].texto })).not.toBeInTheDocument();
    });

    it.each(["https://externo.example/destino", "//externo.example", "javascript:alert(1)"])("no convierte una URL insegura de datos anteriores en enlace: %s", async (url) => {
        const datos = listado();
        datos.notificaciones[0].url = url;
        await abrir(datos);
        expect(screen.getByText(datos.notificaciones[0].texto)).toBeVisible();
        expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });

    it("marca únicamente el aviso elegido y comunica el contador confirmado al encabezado", async () => {
        const datos = listado();
        datos.notificaciones[1].leida = false;
        datos.noLeidas = 2;
        await abrir(datos);
        vi.mocked(fetch).mockResolvedValueOnce(respuesta({ noLeidas: 1 }));
        fireEvent.click(within(fila(datos.notificaciones[0].texto)).getByRole("button", { name: "Marcar como leída" }));
        await waitFor(() => expect(within(fila(datos.notificaciones[0].texto)).getByRole("button", { name: "Notificación leída" })).toBeDisabled());
        expect(fetch).toHaveBeenLastCalledWith("/api/notificaciones/11", expect.objectContaining({ method: "PATCH", signal: expect.any(AbortSignal) }));
        expect(within(fila(datos.notificaciones[1].texto)).getByRole("button", { name: "Marcar como leída" })).toBeEnabled();
        expect(notificarCambioNotificaciones).toHaveBeenLastCalledWith(7, 1);
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("borra solo el aviso elegido y conserva el contador del servidor al borrar uno leído", async () => {
        await abrir();
        vi.mocked(fetch).mockResolvedValueOnce(respuesta({ noLeidas: 1 }));
        fireEvent.click(within(fila(listado().notificaciones[1].texto)).getByRole("button", { name: "Borrar notificación" }));
        await waitFor(() => expect(screen.queryByText(listado().notificaciones[1].texto)).not.toBeInTheDocument());
        expect(screen.getByText(listado().notificaciones[0].texto)).toBeVisible();
        expect(fetch).toHaveBeenLastCalledWith("/api/notificaciones/12", expect.objectContaining({ method: "DELETE" }));
        expect(notificarCambioNotificaciones).toHaveBeenLastCalledWith(7, 1);
    });

    it("Leer todo marca todos los avisos sin borrarlos", async () => {
        const datos = listado();
        datos.notificaciones[1].leida = false;
        datos.noLeidas = 2;
        await abrir(datos);
        vi.mocked(fetch).mockResolvedValueOnce(respuesta({ noLeidas: 0 }));
        fireEvent.click(screen.getByRole("button", { name: "Leer todo" }));
        await waitFor(() => expect(screen.getAllByRole("button", { name: "Notificación leída" })).toHaveLength(2));
        expect(screen.getAllByRole("listitem")).toHaveLength(2);
        expect(fetch).toHaveBeenLastCalledWith("/api/notificaciones", expect.objectContaining({ method: "PATCH" }));
        expect(screen.getByRole("button", { name: "Leer todo" })).toBeDisabled();
        expect(notificarCambioNotificaciones).toHaveBeenLastCalledWith(7, 0);
    });

    it("Borrar todo requiere confirmación, admite cancelar y bloquea envíos repetidos mientras guarda", async () => {
        await abrir();
        fireEvent.click(screen.getByRole("button", { name: "Borrar todo" }));
        const dialogo = screen.getByRole("alertdialog", { name: "Borrar todas las notificaciones" });
        expect(dialogo).toBeVisible();
        expect(fetch).toHaveBeenCalledTimes(1);
        fireEvent.click(within(dialogo).getByRole("button", { name: "Cancelar" }));
        await waitFor(() => expect(dialogo).not.toBeVisible());
        expect(screen.getAllByRole("listitem")).toHaveLength(2);
        fireEvent.click(screen.getByRole("button", { name: "Borrar todo" }));
        const borrado = pendiente();
        vi.mocked(fetch).mockReturnValueOnce(borrado.promesa);
        fireEvent.click(within(dialogo).getByRole("button", { name: "Sí, borrar todas" }));
        expect(within(dialogo).getByRole("button", { name: "Eliminando..." })).toBeDisabled();
        expect(within(dialogo).getByRole("button", { name: "Cancelar" })).toBeDisabled();
        fireEvent.click(within(dialogo).getByRole("button", { name: "Eliminando..." }));
        expect(fetch).toHaveBeenCalledTimes(2);
        await act(async () => borrado.resolver(respuesta({ noLeidas: 0 })));
        expect(screen.getByRole("heading", { name: "No tenés notificaciones" })).toBeVisible();
        expect(fetch).toHaveBeenLastCalledWith("/api/notificaciones", expect.objectContaining({ method: "DELETE" }));
        expect(notificarCambioNotificaciones).toHaveBeenLastCalledWith(7, 0);
    });

    it("un fallo de carga muestra un toast y permite reintentar sin fingir una lista vacía", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(respuesta({ errores: ["Servicio temporalmente no disponible."] }, 503));
        render(<VistaNotificaciones usuarioId={7} />);
        expect(await screen.findByRole("alert")).toHaveTextContent("Servicio temporalmente no disponible.");
        expect(screen.queryByText("No tenés notificaciones")).not.toBeInTheDocument();
        expect(notificarCambioNotificaciones).not.toHaveBeenCalled();
        vi.mocked(fetch).mockResolvedValueOnce(respuesta(listado()));
        fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
        expect(await screen.findByRole("list", { name: "Notificaciones recibidas" })).toBeVisible();
        expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
    });

    it.each(["leer", "borrar"] as const)("no altera el listado ni el contador cuando falla la operación de %s", async (operacion) => {
        await abrir();
        vi.mocked(fetch).mockResolvedValueOnce(respuesta({ errores: ["La operación no pudo completarse."] }, 500));
        fireEvent.click(within(fila(listado().notificaciones[0].texto)).getByRole("button", { name: operacion === "leer" ? "Marcar como leída" : "Borrar notificación" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("La operación no pudo completarse.");
        expect(within(fila(listado().notificaciones[0].texto)).getByRole("button", { name: "Marcar como leída" })).toBeEnabled();
        expect(screen.getAllByRole("listitem")).toHaveLength(2);
        expect(screen.getByText("1 notificación sin leer")).toBeVisible();
        expect(notificarCambioNotificaciones).toHaveBeenCalledTimes(1);
    });

    it("conserva los avisos existentes si falla una actualización y explica el fallo de red en español", async () => {
        await abrir();
        vi.mocked(fetch).mockRejectedValueOnce(new TypeError("Failed to fetch"));
        fireEvent(window, new Event("focus"));
        expect(await screen.findByRole("alert")).toHaveTextContent("No se pudieron cargar las notificaciones. Intentá nuevamente.");
        expect(screen.getAllByRole("listitem")).toHaveLength(2);
        expect(screen.getByRole("button", { name: "Reintentar" })).toBeEnabled();
    });

    it("rechaza una respuesta inválida antes de cambiar el contador", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(respuesta({ notificaciones: [], noLeidas: -1 }));
        render(<VistaNotificaciones usuarioId={7} />);
        expect(await screen.findByRole("alert")).toHaveTextContent("La respuesta del servidor no es válida.");
        expect(screen.queryByText("No tenés notificaciones")).not.toBeInTheDocument();
        expect(notificarCambioNotificaciones).not.toHaveBeenCalled();
    });

    it("una recarga anterior no deshace una lectura confirmada ni restaura el contador viejo", async () => {
        await abrir();
        const recarga = pendiente();
        vi.mocked(fetch).mockReturnValueOnce(recarga.promesa);
        fireEvent(window, new Event("focus"));
        const signalRecarga = vi.mocked(fetch).mock.calls[1][1]!.signal!;
        vi.mocked(fetch).mockResolvedValueOnce(respuesta({ noLeidas: 0 }));
        fireEvent.click(within(fila(listado().notificaciones[0].texto)).getByRole("button", { name: "Marcar como leída" }));
        await waitFor(() => expect(screen.getByText("0 notificaciones sin leer")).toBeVisible());
        expect(signalRecarga.aborted).toBe(true);
        await act(async () => recarga.resolver(respuesta(listado())));
        expect(within(fila(listado().notificaciones[0].texto)).getByRole("button", { name: "Notificación leída" })).toBeDisabled();
        expect(notificarCambioNotificaciones).toHaveBeenCalledTimes(2);
        expect(notificarCambioNotificaciones).toHaveBeenLastCalledWith(7, 0);
    });

    it("actualiza cada minuto solo estando visible y al recuperar foco, sin superponer cargas", async () => {
        vi.useFakeTimers();
        vi.mocked(fetch).mockResolvedValue(respuesta(listado()));
        render(<VistaNotificaciones usuarioId={7} />);
        await act(async () => {});
        expect(fetch).toHaveBeenCalledTimes(1);
        await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
        expect(fetch).toHaveBeenCalledTimes(2);
        vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
        await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
        fireEvent(window, new Event("focus"));
        expect(fetch).toHaveBeenCalledTimes(2);
        vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
        const recarga = pendiente();
        vi.mocked(fetch).mockReturnValueOnce(recarga.promesa);
        fireEvent(document, new Event("visibilitychange"));
        fireEvent(window, new Event("focus"));
        expect(fetch).toHaveBeenCalledTimes(3);
        await act(async () => recarga.resolver(respuesta({ notificaciones: [], noLeidas: 0 })));
        expect(screen.getByRole("heading", { name: "No tenés notificaciones" })).toBeVisible();
    });

    it("aborta al salir y no publica resultados tardíos en el contador del encabezado", async () => {
        const carga = pendiente();
        vi.mocked(fetch).mockReturnValueOnce(carga.promesa);
        const vista = render(<VistaNotificaciones usuarioId={7} />);
        await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
        const signal = vi.mocked(fetch).mock.calls[0][1]!.signal!;
        vista.unmount();
        expect(signal.aborted).toBe(true);
        await act(async () => carga.resolver(respuesta(listado())));
        fireEvent(window, new Event("focus"));
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(notificarCambioNotificaciones).not.toHaveBeenCalled();
    });
});
