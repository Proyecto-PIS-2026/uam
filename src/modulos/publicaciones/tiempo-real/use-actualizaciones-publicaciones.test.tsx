import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useActualizacionesPublicaciones } from "./use-actualizaciones-publicaciones";

const verificarSesion = vi.hoisted(() => vi.fn<(entrada: RequestInfo | URL, opciones?: RequestInit) => Promise<Response>>());
vi.mock("@/modulos/identidad-acceso/autenticacion/cliente-sesion", () => ({ fetchConSesion: verificarSesion }));

class FuenteEventos extends EventTarget {
    static instancias: FuenteEventos[] = [];
    close = vi.fn();
    constructor(public url: string) { super(); FuenteEventos.instancias.push(this); }
}

async function notificar(fuente: FuenteEventos, tipo: "conectado" | "cambio", version: string, espera = 200) {
    await act(async () => {
        fuente.dispatchEvent(new MessageEvent(tipo, { lastEventId: version }));
        await vi.advanceTimersByTimeAsync(espera);
    });
}

describe("actualizaciones de publicaciones", () => {
    beforeEach(() => {
        FuenteEventos.instancias = [];
        verificarSesion.mockReset().mockResolvedValue(new Response(null, { status: 204 }));
        vi.useFakeTimers();
        vi.stubGlobal("EventSource", FuenteEventos);
    });
    afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

    it("conserva la recarga conservadora y el debounce para eventos sin versión", async () => {
        const actualizar = vi.fn();
        const hook = renderHook(() => useActualizacionesPublicaciones(actualizar, 7));
        const fuente = FuenteEventos.instancias[0];
        expect(fuente.url).toBe("/api/publicaciones/eventos?operadorId=7");
        await act(async () => {
            fuente.dispatchEvent(new Event("conectado"));
            fuente.dispatchEvent(new Event("cambio"));
            fuente.dispatchEvent(new Event("cambio"));
            await vi.advanceTimersByTimeAsync(200);
        });
        expect(actualizar).toHaveBeenCalledOnce();
        await act(async () => { fuente.dispatchEvent(new Event("conectado")); await vi.advanceTimersByTimeAsync(200); });
        expect(actualizar).toHaveBeenCalledTimes(2);
        hook.unmount();
        expect(fuente.close).toHaveBeenCalledOnce();
    });

    it("sincroniza una vez al conectar y omite la misma versión en reconexiones y cambios repetidos", async () => {
        const actualizar = vi.fn();
        const hook = renderHook(() => useActualizacionesPublicaciones(actualizar));
        const fuente = FuenteEventos.instancias[0];

        expect(actualizar).not.toHaveBeenCalled();
        await notificar(fuente, "conectado", "epoca:0", 199);
        expect(actualizar).not.toHaveBeenCalled();
        await act(async () => { await vi.advanceTimersByTimeAsync(1); });
        expect(actualizar).toHaveBeenCalledOnce();

        for (let intento = 0; intento < 3; intento++) await notificar(fuente, "conectado", "epoca:0");
        await notificar(fuente, "cambio", "epoca:0");
        expect(actualizar).toHaveBeenCalledOnce();
        hook.unmount();
    });

    it("recupera cambios durante una desconexión y reconoce una nueva época aunque su contador sea menor", async () => {
        const actualizar = vi.fn();
        const hook = renderHook(() => useActualizacionesPublicaciones(actualizar));
        const fuente = FuenteEventos.instancias[0];
        await notificar(fuente, "conectado", "arranque-a:8");
        await notificar(fuente, "conectado", "arranque-a:12");
        expect(actualizar).toHaveBeenCalledTimes(2);

        await notificar(fuente, "conectado", "arranque-b:1");
        await notificar(fuente, "conectado", "arranque-b:1");
        expect(actualizar).toHaveBeenCalledTimes(3);
        hook.unmount();
    });

    it("agrupa una ráfaga y aplica la última versión recibida", async () => {
        const actualizar = vi.fn();
        const hook = renderHook(() => useActualizacionesPublicaciones(actualizar));
        const fuente = FuenteEventos.instancias[0];
        await act(async () => {
            fuente.dispatchEvent(new MessageEvent("conectado", { lastEventId: "a" }));
            fuente.dispatchEvent(new MessageEvent("cambio", { lastEventId: "b" }));
            fuente.dispatchEvent(new MessageEvent("cambio", { lastEventId: "c" }));
            await vi.advanceTimersByTimeAsync(200);
        });
        expect(actualizar).toHaveBeenCalledOnce();
        await notificar(fuente, "conectado", "c");
        expect(actualizar).toHaveBeenCalledOnce();
        hook.unmount();
    });

    it("no agrega otra carga por duplicados de una versión que se está sincronizando", async () => {
        let terminar!: () => void;
        const actualizar = vi.fn().mockImplementationOnce(() => new Promise<void>((resolve) => { terminar = resolve; }));
        const hook = renderHook(() => useActualizacionesPublicaciones(actualizar));
        const fuente = FuenteEventos.instancias[0];
        await notificar(fuente, "conectado", "a");
        await notificar(fuente, "cambio", "a");
        await notificar(fuente, "conectado", "a");
        expect(actualizar).toHaveBeenCalledOnce();

        await act(async () => { terminar(); await vi.advanceTimersByTimeAsync(1000); });
        await notificar(fuente, "conectado", "a");
        expect(actualizar).toHaveBeenCalledOnce();
        hook.unmount();
    });

    it("serializa la consulta y conserva la última versión nueva llegada durante la carga", async () => {
        let terminar!: () => void;
        const actualizar = vi.fn().mockImplementationOnce(() => new Promise<void>((resolve) => { terminar = resolve; }));
        const hook = renderHook(() => useActualizacionesPublicaciones(actualizar));
        const fuente = FuenteEventos.instancias[0];
        await notificar(fuente, "conectado", "a");
        await notificar(fuente, "cambio", "b");
        await notificar(fuente, "cambio", "c");
        await notificar(fuente, "conectado", "c");
        expect(actualizar).toHaveBeenCalledOnce();

        await act(async () => { terminar(); await vi.advanceTimersByTimeAsync(199); });
        expect(actualizar).toHaveBeenCalledOnce();
        await act(async () => { await vi.advanceTimersByTimeAsync(1); });
        expect(actualizar).toHaveBeenCalledTimes(2);
        await notificar(fuente, "conectado", "c");
        expect(actualizar).toHaveBeenCalledTimes(2);
        hook.unmount();
    });

    it.each(["rechazo", "false"])("reintenta la misma versión en la próxima conexión cuando la sincronización devuelve %s", async (fallo) => {
        const actualizar = vi.fn()
            .mockImplementationOnce(() => fallo === "rechazo" ? Promise.reject(new Error("Sin conexión")) : Promise.resolve(false))
            .mockResolvedValue(undefined);
        const hook = renderHook(() => useActualizacionesPublicaciones(actualizar));
        const fuente = FuenteEventos.instancias[0];
        await notificar(fuente, "conectado", "a");
        await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
        expect(actualizar).toHaveBeenCalledOnce();

        await notificar(fuente, "conectado", "a");
        expect(actualizar).toHaveBeenCalledTimes(2);
        await notificar(fuente, "conectado", "a");
        expect(actualizar).toHaveBeenCalledTimes(2);
        hook.unmount();
    });

    it("no pierde una versión nueva pendiente si la consulta en curso rechaza", async () => {
        let rechazar!: (razon: Error) => void;
        const actualizar = vi.fn().mockImplementationOnce(() => new Promise<void>((_, reject) => { rechazar = reject; }));
        const hook = renderHook(() => useActualizacionesPublicaciones(actualizar));
        const fuente = FuenteEventos.instancias[0];
        await notificar(fuente, "conectado", "a");
        await notificar(fuente, "cambio", "b");
        await act(async () => { rechazar(new Error("Sin conexión")); await vi.advanceTimersByTimeAsync(200); });
        expect(actualizar).toHaveBeenCalledTimes(2);
        await notificar(fuente, "conectado", "b");
        expect(actualizar).toHaveBeenCalledTimes(2);
        hook.unmount();
    });

    it("trata también los MessageEvent con lastEventId vacío como avisos sin versión", async () => {
        const actualizar = vi.fn();
        const hook = renderHook(() => useActualizacionesPublicaciones(actualizar));
        const fuente = FuenteEventos.instancias[0];
        await notificar(fuente, "conectado", "a");
        await notificar(fuente, "cambio", "");
        await notificar(fuente, "conectado", "");
        expect(actualizar).toHaveBeenCalledTimes(3);
        hook.unmount();
    });

    it("espera la consulta en curso y conserva una actualización pendiente", async () => {
        let terminar!: () => void;
        const actualizar = vi.fn().mockImplementationOnce(() => new Promise<void>((resolve) => { terminar = resolve; }));
        const hook = renderHook(() => useActualizacionesPublicaciones(actualizar));
        const fuente = FuenteEventos.instancias[0];
        expect(fuente.url).toBe("/api/publicaciones/eventos");
        await act(async () => { fuente.dispatchEvent(new Event("cambio")); await vi.advanceTimersByTimeAsync(200); });
        await act(async () => { fuente.dispatchEvent(new Event("cambio")); await vi.advanceTimersByTimeAsync(200); });
        expect(actualizar).toHaveBeenCalledOnce();
        await act(async () => { terminar(); await vi.advanceTimersByTimeAsync(200); });
        expect(actualizar).toHaveBeenCalledTimes(2);
        hook.unmount();
    });

    it("suscribe el perfil al canal público de su operador y cambia de conexión al navegar a otro", async () => {
        const actualizar = vi.fn();
        const hook = renderHook(({ operadorPublicoId }) => useActualizacionesPublicaciones(actualizar, { operadorPublicoId }), {
            initialProps: { operadorPublicoId: 7 },
        });
        const primera = FuenteEventos.instancias[0];
        expect(primera.url).toBe("/api/publicaciones/eventos?operadorPublicoId=7");
        await notificar(primera, "conectado", "misma-version");
        hook.rerender({ operadorPublicoId: 7 });
        expect(FuenteEventos.instancias).toHaveLength(1);
        hook.rerender({ operadorPublicoId: 8 });
        expect(primera.close).toHaveBeenCalledOnce();
        expect(FuenteEventos.instancias[1].url).toBe("/api/publicaciones/eventos?operadorPublicoId=8");
        await act(async () => {
            primera.dispatchEvent(new MessageEvent("cambio", { lastEventId: "fuente-cerrada" }));
            FuenteEventos.instancias[1].dispatchEvent(new MessageEvent("conectado", { lastEventId: "misma-version" }));
            await vi.advanceTimersByTimeAsync(200);
        });
        expect(actualizar).toHaveBeenCalledTimes(2);
        hook.unmount();
    });

    it("usa la consulta actual al cambiar filtros sin abrir otra conexión", async () => {
        const primera = vi.fn();
        const segunda = vi.fn();
        const hook = renderHook(({ actualizar }) => useActualizacionesPublicaciones(actualizar), { initialProps: { actualizar: primera } });
        await notificar(FuenteEventos.instancias[0], "cambio", "a", 0);
        hook.rerender({ actualizar: segunda });
        await act(async () => { await vi.advanceTimersByTimeAsync(200); });
        expect(primera).not.toHaveBeenCalled();
        expect(segunda).toHaveBeenCalledOnce();
        expect(FuenteEventos.instancias).toHaveLength(1);
        hook.unmount();
    });

    it("suspende la conexión oculta, conserva la versión aplicada e ignora eventos de la fuente cerrada", async () => {
        let visible = "visible";
        vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visible as DocumentVisibilityState);
        const actualizar = vi.fn();
        const hook = renderHook(() => useActualizacionesPublicaciones(actualizar));
        const primera = FuenteEventos.instancias[0];
        await notificar(primera, "conectado", "a");
        visible = "hidden";
        act(() => document.dispatchEvent(new Event("visibilitychange")));
        expect(primera.close).toHaveBeenCalledOnce();
        await notificar(primera, "cambio", "oculta");
        visible = "visible";
        act(() => document.dispatchEvent(new Event("visibilitychange")));
        expect(FuenteEventos.instancias).toHaveLength(2);
        await notificar(FuenteEventos.instancias[1], "conectado", "a");
        await notificar(primera, "cambio", "tardia");
        expect(actualizar).toHaveBeenCalledOnce();

        await notificar(FuenteEventos.instancias[1], "conectado", "b");
        expect(actualizar).toHaveBeenCalledTimes(2);
        hook.unmount();
    });

    it("cancela el debounce al ocultarse y recupera ese cambio al volver a conectar", async () => {
        let visible = "visible";
        vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visible as DocumentVisibilityState);
        const actualizar = vi.fn();
        const hook = renderHook(() => useActualizacionesPublicaciones(actualizar));
        await notificar(FuenteEventos.instancias[0], "conectado", "a", 100);
        visible = "hidden";
        act(() => document.dispatchEvent(new Event("visibilitychange")));
        await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
        expect(actualizar).not.toHaveBeenCalled();

        visible = "visible";
        act(() => document.dispatchEvent(new Event("visibilitychange")));
        await notificar(FuenteEventos.instancias[1], "conectado", "a");
        expect(actualizar).toHaveBeenCalledOnce();
        hook.unmount();
    });

    it("espera a que una pestaña inicialmente oculta se vuelva visible", async () => {
        let visible = "hidden";
        vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visible as DocumentVisibilityState);
        const actualizar = vi.fn();
        const hook = renderHook(() => useActualizacionesPublicaciones(actualizar));
        expect(FuenteEventos.instancias).toHaveLength(0);
        visible = "visible";
        act(() => document.dispatchEvent(new Event("visibilitychange")));
        await notificar(FuenteEventos.instancias[0], "conectado", "a");
        expect(actualizar).toHaveBeenCalledOnce();
        hook.unmount();
    });

    it("descarta el debounce y los eventos tardíos al desmontar", async () => {
        const actualizar = vi.fn();
        const hook = renderHook(() => useActualizacionesPublicaciones(actualizar));
        const fuente = FuenteEventos.instancias[0];
        await notificar(fuente, "conectado", "a", 0);
        hook.unmount();
        await notificar(fuente, "cambio", "b");
        expect(actualizar).not.toHaveBeenCalled();
        expect(fuente.close).toHaveBeenCalledOnce();
    });

    it("descarta actualizaciones pendientes aunque una carga termine después del desmontaje", async () => {
        let terminar!: () => void;
        const actualizar = vi.fn().mockImplementationOnce(() => new Promise<void>((resolve) => { terminar = resolve; }));
        const hook = renderHook(() => useActualizacionesPublicaciones(actualizar));
        const fuente = FuenteEventos.instancias[0];
        await notificar(fuente, "conectado", "a");
        await notificar(fuente, "cambio", "b");
        hook.unmount();
        await act(async () => { terminar(); await vi.advanceTimersByTimeAsync(1000); });
        expect(actualizar).toHaveBeenCalledOnce();
    });

    it("no intenta conectar cuando EventSource no está disponible", () => {
        vi.stubGlobal("EventSource", undefined);
        const hook = renderHook(() => useActualizacionesPublicaciones(vi.fn()));
        expect(FuenteEventos.instancias).toHaveLength(0);
        hook.unmount();
    });

    it("comprueba la sesión privada solamente al fallar SSE, sin sondeos periódicos", async () => {
        const hook = renderHook(() => useActualizacionesPublicaciones(vi.fn(), 7));
        const fuente = FuenteEventos.instancias[0];
        await notificar(fuente, "conectado", "a");
        expect(verificarSesion).not.toHaveBeenCalled();

        await act(async () => { fuente.dispatchEvent(new Event("error")); });

        expect(verificarSesion).toHaveBeenCalledExactlyOnceWith("/api/sesion", { cache: "no-store", signal: expect.any(AbortSignal) });
        expect(fuente.close).not.toHaveBeenCalled();
        await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
        expect(verificarSesion).toHaveBeenCalledOnce();
        hook.unmount();
    });

    it.each([undefined, { operadorPublicoId: 7 }])("no comprueba sesiones ante errores del canal público %s", async (filtro) => {
        const hook = renderHook(() => useActualizacionesPublicaciones(vi.fn(), filtro));
        const fuente = FuenteEventos.instancias[0];

        await act(async () => {
            fuente.dispatchEvent(new Event("error"));
            await vi.advanceTimersByTimeAsync(60_000);
        });

        expect(verificarSesion).not.toHaveBeenCalled();
        expect(fuente.close).not.toHaveBeenCalled();
        hook.unmount();
    });

    it("delega la sesión inválida al helper que procesa el 401 sin generar rechazos sin manejar", async () => {
        verificarSesion.mockRejectedValueOnce(new Error("Tu sesión finalizó. Volvé a iniciar sesión."));
        const hook = renderHook(() => useActualizacionesPublicaciones(vi.fn(), 7));

        await act(async () => { FuenteEventos.instancias[0].dispatchEvent(new Event("error")); });

        expect(verificarSesion).toHaveBeenCalledExactlyOnceWith("/api/sesion", { cache: "no-store", signal: expect.any(AbortSignal) });
        hook.unmount();
    });

    it.each(["red", "503"])("mantiene la reconexión SSE ante una falla temporal de %s", async (fallo) => {
        if (fallo === "red") verificarSesion.mockRejectedValueOnce(new TypeError("Failed to fetch"));
        else verificarSesion.mockResolvedValueOnce(new Response(null, { status: 503 }));
        const actualizar = vi.fn();
        const hook = renderHook(() => useActualizacionesPublicaciones(actualizar, 7));
        const fuente = FuenteEventos.instancias[0];

        await act(async () => { fuente.dispatchEvent(new Event("error")); });
        await notificar(fuente, "conectado", "recuperada");

        expect(verificarSesion).toHaveBeenCalledOnce();
        expect(FuenteEventos.instancias).toHaveLength(1);
        expect(fuente.close).not.toHaveBeenCalled();
        expect(actualizar).toHaveBeenCalledOnce();
        hook.unmount();
    });

    it("evita comprobaciones simultáneas y permite comprobar otro error posterior", async () => {
        let terminar!: (respuesta: Response) => void;
        verificarSesion.mockImplementationOnce(() => new Promise<Response>((resolve) => { terminar = resolve; }));
        const hook = renderHook(() => useActualizacionesPublicaciones(vi.fn(), 7));
        const fuente = FuenteEventos.instancias[0];
        await act(async () => {
            fuente.dispatchEvent(new Event("error"));
            fuente.dispatchEvent(new Event("error"));
            fuente.dispatchEvent(new Event("error"));
        });
        expect(verificarSesion).toHaveBeenCalledOnce();

        await act(async () => { terminar(new Response(null, { status: 204 })); });
        await act(async () => { fuente.dispatchEvent(new Event("error")); });

        expect(verificarSesion).toHaveBeenCalledTimes(2);
        hook.unmount();
    });

    it.each(["desmontar", "cambiar canal", "ocultar"])("cancela la comprobación pendiente al %s e ignora errores de la fuente anterior", async (accion) => {
        verificarSesion.mockImplementation(() => new Promise<Response>(() => {}));
        const hook = renderHook(({ operadorId }) => useActualizacionesPublicaciones(vi.fn(), operadorId), { initialProps: { operadorId: 7 } });
        const anterior = FuenteEventos.instancias[0];
        await act(async () => { anterior.dispatchEvent(new Event("error")); });
        const signal = verificarSesion.mock.calls[0][1]?.signal;
        expect(signal?.aborted).toBe(false);

        if (accion === "desmontar") hook.unmount();
        else if (accion === "cambiar canal") hook.rerender({ operadorId: 8 });
        else {
            vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
            act(() => document.dispatchEvent(new Event("visibilitychange")));
        }

        expect(signal?.aborted).toBe(true);
        await act(async () => { anterior.dispatchEvent(new Event("error")); });
        expect(verificarSesion).toHaveBeenCalledOnce();
        if (accion === "cambiar canal") {
            await act(async () => { FuenteEventos.instancias[1].dispatchEvent(new Event("error")); });
            expect(verificarSesion).toHaveBeenCalledTimes(2);
            expect(verificarSesion.mock.calls[1][1]?.signal?.aborted).toBe(false);
        }
        if (accion !== "desmontar") hook.unmount();
    });
});
