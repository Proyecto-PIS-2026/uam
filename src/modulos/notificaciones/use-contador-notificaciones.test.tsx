import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notificarCambioNotificaciones } from "./cliente";
import { useContadorNotificaciones } from "./use-contador-notificaciones";

const fetchSimulado = vi.fn<typeof fetch>();
const respuesta = (noLeidas: number) => ({ ok: true, status: 200, json: async () => ({ noLeidas }) }) as Response;

beforeEach(() => {
    vi.stubGlobal("fetch", fetchSimulado);
    vi.stubGlobal("BroadcastChannel", undefined);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    fetchSimulado.mockReset();
    fetchSimulado.mockResolvedValue(respuesta(4));
});

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe("contador de notificaciones", () => {
    it("no consulta ni muestra datos sin usuario", () => {
        const { result } = renderHook(() => useContadorNotificaciones(null));
        expect(result.current.noLeidas).toBe(0);
        expect(fetchSimulado).not.toHaveBeenCalled();
    });

    it("carga el contador y recibe cambios del mismo usuario", async () => {
        const { result } = renderHook(() => useContadorNotificaciones(1));
        await waitFor(() => expect(result.current.noLeidas).toBe(4));
        act(() => notificarCambioNotificaciones(2, 100));
        expect(result.current.noLeidas).toBe(4);
        act(() => notificarCambioNotificaciones(1, 2));
        expect(result.current.noLeidas).toBe(2);
        expect(fetchSimulado).toHaveBeenCalledTimes(1);
    });

    it("una respuesta anterior no pisa un contador actualizado por una acción", async () => {
        let resolver!: (valor: Response) => void;
        fetchSimulado.mockReturnValueOnce(new Promise<Response>((resolve) => { resolver = resolve; }));
        const { result } = renderHook(() => useContadorNotificaciones(1));
        act(() => notificarCambioNotificaciones(1, 0));
        await act(async () => resolver(respuesta(10)));
        expect(result.current.noLeidas).toBe(0);
        expect(fetchSimulado.mock.calls[0][1]?.signal?.aborted).toBe(true);
    });

    it("limpia el contador al cambiar de cuenta o cerrar sesión", async () => {
        const { result, rerender } = renderHook(({ usuarioId }: { usuarioId: number | null }) => useContadorNotificaciones(usuarioId), { initialProps: { usuarioId: 1 as number | null } });
        await waitFor(() => expect(result.current.noLeidas).toBe(4));
        fetchSimulado.mockResolvedValueOnce(respuesta(1));
        rerender({ usuarioId: 2 });
        expect(result.current.noLeidas).toBe(0);
        await waitFor(() => expect(result.current.noLeidas).toBe(1));
        rerender({ usuarioId: null });
        expect(result.current.noLeidas).toBe(0);
    });

    it("suspende consultas con la pestaña oculta y actualiza al volver", async () => {
        const visibilidad = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
        const { result } = renderHook(() => useContadorNotificaciones(1));
        expect(fetchSimulado).not.toHaveBeenCalled();
        visibilidad.mockReturnValue("visible");
        act(() => document.dispatchEvent(new Event("visibilitychange")));
        await waitFor(() => expect(result.current.noLeidas).toBe(4));
    });

    it("conserva el contador ante errores de red y lo limpia si vence la sesión", async () => {
        const { result } = renderHook(() => useContadorNotificaciones(1));
        await waitFor(() => expect(result.current.noLeidas).toBe(4));
        fetchSimulado.mockRejectedValueOnce(new Error("Sin conexión"));
        await act(async () => result.current.refrescar());
        expect(result.current.noLeidas).toBe(4);
        fetchSimulado.mockResolvedValueOnce({ status: 401, ok: false } as Response);
        act(() => result.current.refrescar());
        await waitFor(() => expect(result.current.noLeidas).toBe(0));
    });
});
