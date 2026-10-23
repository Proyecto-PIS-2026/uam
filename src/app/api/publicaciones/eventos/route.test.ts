import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReadableStream } from "node:stream/web";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({ suscribir: vi.fn(), desuscribir: vi.fn(), obtenerVersion: vi.fn(), sesion: vi.fn(), operador: vi.fn(), autorizado: vi.fn() }));
vi.mock("@/infraestructura/tiempo-real/escuchar-publicaciones", () => ({ escuchaPublicaciones: { suscribir: mocks.suscribir, obtenerVersion: mocks.obtenerVersion } }));
vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({ obtenerSesion: mocks.sesion }));
vi.mock("@/modulos/usuarios/operadores/operador-actual", () => ({ obtenerOperadorAutorizado: mocks.operador }));
vi.mock("@/modulos/identidad-acceso/autorizacion/permisos", () => ({ autorizado: mocks.autorizado }));
vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => ({ ErrorAutorizacion: class extends Error { constructor(public status: number, mensaje: string) { super(mensaje); } } }));

describe("eventos de publicaciones", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-10-23T12:00:00Z"));
        vi.stubGlobal("ReadableStream", ReadableStream);
        mocks.suscribir.mockImplementation((oyente) => {
            oyente(null);
            return mocks.desuscribir;
        });
        mocks.obtenerVersion.mockImplementation((operadorId?: number) => operadorId === undefined ? "epoca-global" : `epoca-operador-${operadorId}`);
        mocks.sesion.mockResolvedValue({ usuarioId: 10, rol: "OPERADOR", expiraEn: Math.floor(Date.now() / 1000) + 1000 });
        mocks.operador.mockResolvedValue({ id: 7, usuarioId: 10 });
        mocks.autorizado.mockReturnValue(true);
    });
    afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

    it("publica sólo invalidaciones sin identificadores en el canal público", async () => {
        const respuesta = await GET(new Request("http://localhost/api/publicaciones/eventos"));
        const lector = respuesta.body!.getReader();
        await lector.read();
        mocks.suscribir.mock.calls[0][0]({ operadorId: 8, publicacionId: 42 });
        const evento = new TextDecoder().decode((await lector.read()).value);
        expect(evento).toBe("id: epoca-global:2026-10-23\nevent: cambio\ndata: {}\n\n");
        expect(mocks.obtenerVersion).toHaveBeenLastCalledWith(undefined);
        await expect(lector.cancel()).resolves.toBeUndefined();
        expect(mocks.desuscribir).toHaveBeenCalledOnce();
    });

    it("filtra eventos del canal privado por el operador autenticado", async () => {
        const respuesta = await GET(new Request("http://localhost/api/publicaciones/eventos?operadorId=7"));
        const lector = respuesta.body!.getReader();
        await lector.read();
        const emitir = mocks.suscribir.mock.calls[0][0];
        emitir({ operadorId: 8, publicacionId: 42 });
        emitir({ operadorId: 7, publicacionId: 43 });
        expect(new TextDecoder().decode((await lector.read()).value)).toBe('id: epoca-operador-7:2026-10-23\nevent: cambio\ndata: {"publicacionId":43}\n\n');
        expect(mocks.operador).toHaveBeenCalledWith(7);
        expect(mocks.obtenerVersion).toHaveBeenCalledTimes(2);
        expect(mocks.obtenerVersion).toHaveBeenLastCalledWith(7);
        await lector.cancel();
    });

    it("filtra el perfil público sin autenticar ni exponer identificadores de publicaciones", async () => {
        mocks.sesion.mockResolvedValue(null);
        const respuesta = await GET(new Request("http://localhost/api/publicaciones/eventos?operadorPublicoId=7"));
        expect(respuesta.status).toBe(200);
        const lector = respuesta.body!.getReader();
        await lector.read();
        const emitir = mocks.suscribir.mock.calls[0][0];
        emitir({ operadorId: 8, publicacionId: 42 });
        emitir({ operadorId: 7, publicacionId: 43 });
        expect(new TextDecoder().decode((await lector.read()).value)).toBe("id: epoca-operador-7:2026-10-23\nevent: cambio\ndata: {}\n\n");
        emitir(null);
        expect(new TextDecoder().decode((await lector.read()).value)).toBe("retry: 3000\nid: epoca-operador-7:2026-10-23\nevent: conectado\ndata: {}\n\n");
        expect(mocks.sesion).not.toHaveBeenCalled();
        expect(mocks.operador).not.toHaveBeenCalled();
        expect(mocks.autorizado).not.toHaveBeenCalled();
        await lector.cancel();
    });

    it("emite un único handshake con versión cuando la suscripción ya está lista", async () => {
        const respuesta = await GET(new Request("http://localhost/api/publicaciones/eventos"));
        const lector = respuesta.body!.getReader();
        expect(new TextDecoder().decode((await lector.read()).value)).toBe("retry: 3000\nid: epoca-global:2026-10-23\nevent: conectado\ndata: {}\n\n");
        const siguiente = vi.fn();
        const pendiente = lector.read().then(siguiente);
        await Promise.resolve();
        expect(siguiente).not.toHaveBeenCalled();
        await lector.cancel();
        await pendiente;
        expect(siguiente).toHaveBeenCalledWith(expect.objectContaining({ done: true }));
    });

    it("espera LISTEN antes de anunciar conexión y usa la versión confirmada", async () => {
        mocks.suscribir.mockReturnValue(mocks.desuscribir);
        const respuesta = await GET(new Request("http://localhost/api/publicaciones/eventos"));
        const lector = respuesta.body!.getReader();
        const recibido = vi.fn();
        const pendiente = lector.read().then(recibido);
        await Promise.resolve();
        expect(recibido).not.toHaveBeenCalled();
        mocks.obtenerVersion.mockReturnValue("nueva-epoca");
        mocks.suscribir.mock.calls[0][0](null);
        await pendiente;
        expect(new TextDecoder().decode(recibido.mock.calls[0][0].value)).toBe("retry: 3000\nid: nueva-epoca:2026-10-23\nevent: conectado\ndata: {}\n\n");
        await lector.cancel();
    });

    it("mantiene el mismo id al reconectar sin cambios y transmite el nuevo id al cambiar", async () => {
        const primera = await GET(new Request("http://localhost/api/publicaciones/eventos?operadorPublicoId=7"));
        const primerLector = primera.body!.getReader();
        const handshake = new TextDecoder().decode((await primerLector.read()).value);
        await primerLector.cancel();
        const segunda = await GET(new Request("http://localhost/api/publicaciones/eventos?operadorPublicoId=7", { headers: { "Last-Event-ID": "epoca-operador-7" } }));
        const segundoLector = segunda.body!.getReader();
        expect(new TextDecoder().decode((await segundoLector.read()).value)).toBe(handshake);
        mocks.obtenerVersion.mockReturnValue("version-nueva");
        mocks.suscribir.mock.calls[1][0]({ operadorId: 7, publicacionId: 43 });
        expect(new TextDecoder().decode((await segundoLector.read()).value)).toBe("id: version-nueva:2026-10-23\nevent: cambio\ndata: {}\n\n");
        await segundoLector.cancel();
    });

    it("cambia el id al cruzar medianoche en Montevideo aunque no haya notificaciones", async () => {
        vi.setSystemTime(new Date("2026-10-24T02:59:59Z"));
        const primera = await GET(new Request("http://localhost/api/publicaciones/eventos?operadorPublicoId=7"));
        const primerLector = primera.body!.getReader();
        expect(new TextDecoder().decode((await primerLector.read()).value)).toContain("id: epoca-operador-7:2026-10-23\n");
        await primerLector.cancel();

        vi.setSystemTime(new Date("2026-10-24T03:00:00Z"));
        const segunda = await GET(new Request("http://localhost/api/publicaciones/eventos?operadorPublicoId=7"));
        const segundoLector = segunda.body!.getReader();
        expect(new TextDecoder().decode((await segundoLector.read()).value)).toContain("id: epoca-operador-7:2026-10-24\n");
        await segundoLector.cancel();
    });

    it("informa un cambio de catálogo sin publicacionId también en el canal privado", async () => {
        const respuesta = await GET(new Request("http://localhost/api/publicaciones/eventos?operadorId=7"));
        const lector = respuesta.body!.getReader();
        await lector.read();

        mocks.obtenerVersion.mockReturnValue("version-catalogo");
        mocks.suscribir.mock.calls[0][0]({ operadorId: 7 });

        expect(new TextDecoder().decode((await lector.read()).value)).toBe("id: version-catalogo:2026-10-23\nevent: cambio\ndata: {}\n\n");
        await lector.cancel();
    });

    it("cierra a los 55 segundos y libera los temporizadores", async () => {
        vi.useFakeTimers();
        const respuesta = await GET(new Request("http://localhost/api/publicaciones/eventos"));
        const lector = respuesta.body!.getReader();
        await lector.read();
        await vi.advanceTimersByTimeAsync(55000);
        while (!(await lector.read()).done) { /* Consumir los pulsos anteriores al cierre. */ }
        expect(mocks.desuscribir).toHaveBeenCalledOnce();
        expect(vi.getTimerCount()).toBe(0);
    });

    it("respeta la expiración de la sesión privada antes del límite general", async () => {
        vi.useFakeTimers();
        mocks.sesion.mockResolvedValue({ usuarioId: 10, rol: "OPERADOR", expiraEn: (Date.now() + 2000) / 1000 });
        const respuesta = await GET(new Request("http://localhost/api/publicaciones/eventos?operadorId=7"));
        const lector = respuesta.body!.getReader();
        await lector.read();
        await vi.advanceTimersByTimeAsync(2000);
        expect(await lector.read()).toMatchObject({ done: true });
        expect(mocks.desuscribir).toHaveBeenCalledOnce();
        expect(vi.getTimerCount()).toBe(0);
    });

    it("libera una suscripción que cierra por backpressure durante callbacks síncronos", async () => {
        vi.useFakeTimers();
        mocks.suscribir.mockImplementation((oyente) => {
            for (let indice = 0; indice < 20; indice++) oyente(null);
            return mocks.desuscribir;
        });
        const respuesta = await GET(new Request("http://localhost/api/publicaciones/eventos"));
        const lector = respuesta.body!.getReader();
        while (!(await lector.read()).done) { /* Vaciar el buffer que provocó backpressure. */ }
        expect(mocks.desuscribir).toHaveBeenCalledOnce();
        expect(vi.getTimerCount()).toBe(0);
    });

    it("no crea suscripciones ni temporizadores si la solicitud ya fue abortada", async () => {
        vi.useFakeTimers();
        const controlador = new AbortController();
        controlador.abort();
        const respuesta = await GET(new Request("http://localhost/api/publicaciones/eventos", { signal: controlador.signal }));
        expect(await respuesta.body!.getReader().read()).toMatchObject({ done: true });
        expect(mocks.suscribir).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
    });

    it("rechaza mezclar el filtro público con una suscripción privada", async () => {
        const respuesta = await GET(new Request("http://localhost/api/publicaciones/eventos?operadorPublicoId=7&operadorId=7"));
        expect(respuesta.status).toBe(400);
        expect(mocks.suscribir).not.toHaveBeenCalled();
    });

    it("rechaza una suscripción privada sin sesión", async () => {
        mocks.sesion.mockResolvedValue(null);
        expect((await GET(new Request("http://localhost/api/publicaciones/eventos?operadorId=7"))).status).toBe(401);
        expect(mocks.suscribir).not.toHaveBeenCalled();
    });

    it("rechaza usuarios sin permiso", async () => {
        mocks.autorizado.mockReturnValue(false);
        expect((await GET(new Request("http://localhost/api/publicaciones/eventos?operadorId=7"))).status).toBe(403);
        expect(mocks.suscribir).not.toHaveBeenCalled();
    });

    it.each(["0", "-1", "7&operadorId=8", "texto"])("rechaza operador inválido %s", async (valor) => {
        expect((await GET(new Request(`http://localhost/api/publicaciones/eventos?operadorId=${valor}`))).status).toBe(400);
        expect(mocks.suscribir).not.toHaveBeenCalled();
    });

    it.each(["", "0", "-1", "7&operadorPublicoId=8", "texto", "1.5", "9007199254740992"])("rechaza operador público inválido %s", async (valor) => {
        expect((await GET(new Request(`http://localhost/api/publicaciones/eventos?operadorPublicoId=${valor}`))).status).toBe(400);
        expect(mocks.suscribir).not.toHaveBeenCalled();
    });

    it("cierra y libera la suscripción al abortar la solicitud", async () => {
        const controlador = new AbortController();
        const respuesta = await GET(new Request("http://localhost/api/publicaciones/eventos", { signal: controlador.signal }));
        const lector = respuesta.body!.getReader();
        await lector.read();
        controlador.abort();
        expect(await lector.read()).toMatchObject({ done: true });
        expect(mocks.desuscribir).toHaveBeenCalledOnce();
    });
});
