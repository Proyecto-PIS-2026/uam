import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReadableStream } from "node:stream/web";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({ suscribir: vi.fn(), desuscribir: vi.fn(), sesion: vi.fn(), operador: vi.fn(), autorizado: vi.fn() }));
vi.mock("@/infraestructura/tiempo-real/escuchar-publicaciones", () => ({ escuchaPublicaciones: { suscribir: mocks.suscribir } }));
vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({ obtenerSesion: mocks.sesion }));
vi.mock("@/modulos/usuarios/operadores/operador-actual", () => ({ obtenerOperadorAutorizado: mocks.operador }));
vi.mock("@/modulos/identidad-acceso/autorizacion/permisos", () => ({ autorizado: mocks.autorizado }));
vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => ({ ErrorAutorizacion: class extends Error { constructor(public status: number, mensaje: string) { super(mensaje); } } }));

describe("eventos de publicaciones", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.stubGlobal("ReadableStream", ReadableStream);
        mocks.suscribir.mockReturnValue(mocks.desuscribir);
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
        expect(evento).toBe("event: cambio\ndata: {}\n\n");
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
        expect(new TextDecoder().decode((await lector.read()).value)).toBe('event: cambio\ndata: {"publicacionId":43}\n\n');
        expect(mocks.operador).toHaveBeenCalledWith(7);
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
        expect(new TextDecoder().decode((await lector.read()).value)).toBe("event: cambio\ndata: {}\n\n");
        emitir(null);
        expect(new TextDecoder().decode((await lector.read()).value)).toBe("event: conectado\ndata: {}\n\n");
        expect(mocks.sesion).not.toHaveBeenCalled();
        expect(mocks.operador).not.toHaveBeenCalled();
        expect(mocks.autorizado).not.toHaveBeenCalled();
        await lector.cancel();
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
