import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCompartirPublicacion } from "./use-compartir-publicacion";
import type { Publicacion } from "./tipos";

const publicacion: Publicacion = {
    id: 52, publicacionOperadorId: 13, paisId: null, version: 1,
    foto: "/api/publicaciones/imagenes/52/foto.webp", precio: "45", fecha: "2026-10-25T15:00:00Z",
    publicacionActiva: true, publicacionDisponible: true,
    especie: { id: 7, nombreEspecie: "Papa", fotoEspecie: null },
    variedad: null, presentacion: null, categoria: null, calibre: null,
};

function respuestaFoto(tipo = "image/webp") {
    return { ok: true, blob: async () => new Blob(["fotografia"], { type: tipo }) };
}

describe("useCompartirPublicacion", () => {
    const compartirNativo = vi.fn();
    const admiteArchivo = vi.fn();
    const descargar = vi.fn();
    const abrir = vi.fn();
    const notificar = vi.fn();

    function preparar(datos: Publicacion | null = publicacion) {
        return renderHook(({ seleccion }: { seleccion: Publicacion | null }) =>
            useCompartirPublicacion(seleccion, "Mercado Pérez", notificar), { initialProps: { seleccion: datos } });
    }

    beforeEach(() => {
        vi.resetAllMocks();
        compartirNativo.mockResolvedValue(undefined);
        admiteArchivo.mockReturnValue(true);
        descargar.mockResolvedValue(respuestaFoto());
        vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (iPhone)", maxTouchPoints: 5, share: compartirNativo, canShare: admiteArchivo });
        vi.stubGlobal("fetch", descargar);
        vi.stubGlobal("open", abrir);
    });

    afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

    it.each([["image/webp", "webp"], ["image/png", "png"], ["image/jpeg", "jpg"]])(
        "prepara la foto %s al abrir y comparte sin otra espera con el precio vigente", async (tipo, extension) => {
            descargar.mockResolvedValue(respuestaFoto(tipo));
            const { result, rerender } = preparar(null);
            expect(descargar).not.toHaveBeenCalled();
            rerender({ seleccion: publicacion });
            expect(result.current.preparandoFoto).toBe(true);
            await waitFor(() => expect(result.current.preparandoFoto).toBe(false));
            rerender({ seleccion: { ...publicacion, precio: "70", version: 2 } });

            await act(async () => {
                const tarea = result.current.compartir();
                expect(compartirNativo).toHaveBeenCalledOnce();
                await tarea;
            });

            const datos = compartirNativo.mock.calls[0][0] as ShareData;
            expect(datos.text).toContain("Precio: $70");
            expect(datos.text).toContain("/operadores/Mercado%20P%C3%A9rez");
            expect(datos.files).toHaveLength(1);
            expect(datos.files![0]).toMatchObject({ name: `publicacion-52.${extension}`, type: tipo, size: 10 });
            expect(descargar).toHaveBeenCalledOnce();
            expect(abrir).not.toHaveBeenCalled();
        },
    );

    it("también usa el menú del celular cuando la publicación no tiene foto", async () => {
        const { result } = preparar({ ...publicacion, foto: null });
        await act(() => result.current.compartir());
        expect(compartirNativo).toHaveBeenCalledWith({ text: expect.stringContaining("Papa") });
        expect(descargar).not.toHaveBeenCalled();
        expect(abrir).not.toHaveBeenCalled();
    });

    it("en escritorio abre WhatsApp Web aunque exista el menú nativo", async () => {
        vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Windows NT 10.0)", maxTouchPoints: 10, share: compartirNativo, canShare: admiteArchivo });
        const { result } = preparar();
        await act(() => result.current.compartir());
        expect(abrir).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/web\.whatsapp\.com\/send\?text=/), "_blank", "noopener,noreferrer");
        expect(compartirNativo).not.toHaveBeenCalled();
        expect(descargar).not.toHaveBeenCalled();
    });

    it("abre el enlace móvil cuando el navegador no ofrece compartir", async () => {
        vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Android)", maxTouchPoints: 5 });
        const { result } = preparar();
        await act(() => result.current.compartir());
        expect(abrir).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/wa\.me\/\?text=/), "_blank", "noopener,noreferrer");
        expect(descargar).not.toHaveBeenCalled();
    });

    it("avisa si el dispositivo no admite la foto y permite compartir el texto", async () => {
        admiteArchivo.mockReturnValue(false);
        const { result } = preparar();
        await waitFor(() => expect(result.current.preparandoFoto).toBe(false));
        await act(() => result.current.compartir());
        expect(compartirNativo).toHaveBeenCalledWith({ text: expect.any(String) });
        expect(notificar).toHaveBeenCalledWith(expect.stringContaining("no permite adjuntar la foto"), "warning");
    });

    it("espera a que termine el menú nativo antes de avisar que no se adjuntó la foto", async () => {
        let terminar!: () => void;
        compartirNativo.mockReturnValueOnce(new Promise<void>((resolve) => { terminar = resolve; }));
        admiteArchivo.mockReturnValue(false);
        const { result } = preparar();
        await waitFor(() => expect(result.current.preparandoFoto).toBe(false));
        let tarea!: Promise<void>;
        act(() => { tarea = result.current.compartir(); });

        expect(compartirNativo).toHaveBeenCalledWith({ text: expect.any(String) });
        expect(notificar).not.toHaveBeenCalled();
        await act(async () => { terminar(); await tarea; });
        expect(notificar).toHaveBeenCalledExactlyOnceWith("Se compartió solo el texto porque este navegador no permite adjuntar la foto.", "warning");
    });

    it("no avisa de una foto omitida si se cancela el menú sin compartir", async () => {
        admiteArchivo.mockReturnValue(false);
        compartirNativo.mockRejectedValueOnce(new DOMException("Cancelado", "AbortError"));
        const { result } = preparar();
        await waitFor(() => expect(result.current.preparandoFoto).toBe(false));
        await act(() => result.current.compartir());

        expect(notificar).not.toHaveBeenCalled();
        expect(result.current.compartiendo).toBe(false);
    });

    it("cancelar el menú no muestra un error ni abre WhatsApp por otra vía", async () => {
        compartirNativo.mockRejectedValue(new DOMException("Cancelado", "AbortError"));
        const { result } = preparar({ ...publicacion, foto: null });
        await act(() => result.current.compartir());
        expect(notificar).not.toHaveBeenCalled();
        expect(abrir).not.toHaveBeenCalled();
        expect(result.current.compartiendo).toBe(false);
    });

    it("informa un fallo del menú y permite reintentar sin abrir ventanas tardías", async () => {
        compartirNativo.mockRejectedValueOnce(new DOMException("Bloqueado", "NotAllowedError"));
        const { result } = preparar({ ...publicacion, foto: null });
        await act(() => result.current.compartir());
        expect(notificar).toHaveBeenCalledWith(expect.stringContaining("No se pudo compartir"), "error");
        expect(abrir).not.toHaveBeenCalled();
        await act(() => result.current.compartir());
        expect(compartirNativo).toHaveBeenCalledTimes(2);
    });

    it.each(["HTTP", "HTML"])("no omite silenciosamente una foto que falló (%s), y reintenta al reabrir", async (fallo) => {
        descargar.mockResolvedValueOnce(fallo === "HTTP" ? { ok: false } : respuestaFoto("text/html"));
        const { result, rerender } = preparar();
        await waitFor(() => expect(result.current.preparandoFoto).toBe(false));
        await act(() => result.current.compartir());
        expect(compartirNativo).not.toHaveBeenCalled();
        expect(notificar).toHaveBeenCalledWith(expect.stringContaining("No se pudo cargar la foto"), "error");
        rerender({ seleccion: null });
        rerender({ seleccion: publicacion });
        expect(result.current.preparandoFoto).toBe(true);
        await waitFor(() => expect(result.current.preparandoFoto).toBe(false));
        await act(() => result.current.compartir());
        expect(compartirNativo).toHaveBeenCalledOnce();
    });

    it("cancela la descarga anterior y nunca comparte una foto de otra publicación", async () => {
        let resolverAnterior!: (valor: ReturnType<typeof respuestaFoto>) => void;
        descargar.mockReturnValueOnce(new Promise((resolve) => { resolverAnterior = resolve; }));
        const { result, rerender, unmount } = preparar();
        await act(() => result.current.compartir());
        expect(compartirNativo).not.toHaveBeenCalled();
        const primeraSenal = descargar.mock.calls[0][1].signal as AbortSignal;
        rerender({ seleccion: { ...publicacion, id: 53, foto: "/api/publicaciones/imagenes/53/otra.webp" } });
        expect(primeraSenal.aborted).toBe(true);
        await waitFor(() => expect(result.current.preparandoFoto).toBe(false));
        await act(async () => { resolverAnterior(respuestaFoto()); });
        await act(() => result.current.compartir());
        expect(compartirNativo.mock.calls[0][0].files[0].name).toBe("publicacion-53.webp");
        const segundaSenal = descargar.mock.calls[1][1].signal as AbortSignal;
        unmount();
        expect(segundaSenal.aborted).toBe(true);
    });

    it("actualiza el archivo si cambia la foto de la publicación abierta", async () => {
        const { result, rerender } = preparar();
        await waitFor(() => expect(result.current.preparandoFoto).toBe(false));
        descargar.mockResolvedValueOnce(respuestaFoto("image/png"));
        rerender({ seleccion: { ...publicacion, foto: "/api/publicaciones/imagenes/52/nueva.png" } });
        expect(result.current.preparandoFoto).toBe(true);
        await waitFor(() => expect(result.current.preparandoFoto).toBe(false));
        await act(() => result.current.compartir());
        expect(compartirNativo.mock.calls[0][0].files[0].type).toBe("image/png");
    });

    it("libera el botón si la descarga no responde y cancela esa solicitud", async () => {
        vi.useFakeTimers();
        descargar.mockReturnValueOnce(new Promise(() => {}));
        const { result } = preparar();
        expect(result.current.preparandoFoto).toBe(true);
        await act(() => vi.advanceTimersByTimeAsync(30_000));
        expect(result.current.preparandoFoto).toBe(false);
        expect(descargar.mock.calls[0][1].signal.aborted).toBe(true);
        await act(() => result.current.compartir());
        expect(notificar).toHaveBeenCalledWith(expect.stringContaining("No se pudo cargar la foto"), "error");
        expect(compartirNativo).not.toHaveBeenCalled();
    });

    it("evita abrir dos menús si se pulsa compartir mientras el anterior sigue abierto", async () => {
        let terminar!: () => void;
        compartirNativo.mockReturnValueOnce(new Promise<void>((resolve) => { terminar = resolve; }));
        const { result } = preparar({ ...publicacion, foto: null });
        let tarea!: Promise<void>;
        act(() => {
            tarea = result.current.compartir();
            void result.current.compartir();
        });
        expect(compartirNativo).toHaveBeenCalledOnce();
        expect(result.current.compartiendo).toBe(true);
        await act(async () => { terminar(); await tarea; });
        expect(result.current.compartiendo).toBe(false);
    });
});
