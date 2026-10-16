import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useActualizacionesPublicaciones } from "./use-actualizaciones-publicaciones";

class FuenteEventos extends EventTarget {
    static instancias: FuenteEventos[] = [];
    close = vi.fn();
    constructor(public url: string) { super(); FuenteEventos.instancias.push(this); }
}

describe("actualizaciones de publicaciones", () => {
    beforeEach(() => {
        FuenteEventos.instancias = [];
        vi.useFakeTimers();
        vi.stubGlobal("EventSource", FuenteEventos);
    });
    afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

    it("agrupa eventos y vuelve a consultar al conectarse o reconectarse", async () => {
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
        hook.rerender({ operadorPublicoId: 7 });
        expect(FuenteEventos.instancias).toHaveLength(1);
        hook.rerender({ operadorPublicoId: 8 });
        expect(primera.close).toHaveBeenCalledOnce();
        expect(FuenteEventos.instancias[1].url).toBe("/api/publicaciones/eventos?operadorPublicoId=8");
        await act(async () => {
            FuenteEventos.instancias[1].dispatchEvent(new Event("cambio"));
            await vi.advanceTimersByTimeAsync(200);
        });
        expect(actualizar).toHaveBeenCalledOnce();
        hook.unmount();
    });

    it("usa la consulta actual al cambiar filtros sin abrir otra conexión", async () => {
        const primera = vi.fn();
        const segunda = vi.fn();
        const hook = renderHook(({ actualizar }) => useActualizacionesPublicaciones(actualizar), { initialProps: { actualizar: primera } });
        hook.rerender({ actualizar: segunda });
        await act(async () => { FuenteEventos.instancias[0].dispatchEvent(new Event("cambio")); await vi.advanceTimersByTimeAsync(200); });
        expect(primera).not.toHaveBeenCalled();
        expect(segunda).toHaveBeenCalledOnce();
        expect(FuenteEventos.instancias).toHaveLength(1);
        hook.unmount();
    });

    it("suspende la conexión cuando la pestaña queda oculta y recupera al volver", () => {
        let visible = "visible";
        vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visible as DocumentVisibilityState);
        const hook = renderHook(() => useActualizacionesPublicaciones(vi.fn()));
        visible = "hidden";
        act(() => document.dispatchEvent(new Event("visibilitychange")));
        expect(FuenteEventos.instancias[0].close).toHaveBeenCalledOnce();
        visible = "visible";
        act(() => document.dispatchEvent(new Event("visibilitychange")));
        expect(FuenteEventos.instancias).toHaveLength(2);
        hook.unmount();
    });
});
