import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EscuchaPublicaciones } from "./escuchar-publicaciones";

const simulacion = vi.hoisted(() => {
    const conexiones: Promise<void>[] = [];
    const consultas: Promise<void>[] = [];
    const clientes: ClienteSimulado[] = [];
    class ClienteSimulado {
        private eventos = new Map<string, ((dato?: unknown) => void)[]>();
        connect = vi.fn(() => conexiones.shift() ?? Promise.resolve());
        query = vi.fn(() => consultas.shift() ?? Promise.resolve());
        end = vi.fn(async () => undefined);

        constructor() { clientes.push(this); }

        on(evento: string, manejar: (dato?: unknown) => void) {
            this.eventos.set(evento, [...this.eventos.get(evento) ?? [], manejar]);
        }

        emitir(evento: string, dato?: unknown) {
            for (const manejar of this.eventos.get(evento) ?? []) manejar(dato);
        }
    }
    return { clientes, conexiones, consultas, ClienteSimulado };
});

vi.mock("pg", () => ({ Client: simulacion.ClienteSimulado }));

const desuscripciones: (() => void)[] = [];

function suscribir(escucha: EscuchaPublicaciones, oyente = vi.fn()) {
    const desuscribir = escucha.suscribir(oyente);
    desuscripciones.push(desuscribir);
    return { oyente, desuscribir };
}

async function completarConexion() {
    await vi.advanceTimersByTimeAsync(0);
}

beforeEach(() => {
    vi.useFakeTimers();
    simulacion.clientes.length = 0;
    simulacion.conexiones.length = 0;
    simulacion.consultas.length = 0;
});

afterEach(() => {
    for (const desuscribir of desuscripciones.splice(0)) desuscribir();
    vi.clearAllTimers();
    vi.useRealTimers();
});

describe("EscuchaPublicaciones", () => {
    it("comparte una conexión y la cierra tras 60 segundos sin oyentes", async () => {
        const escucha = new EscuchaPublicaciones();
        const primero = suscribir(escucha);
        const segundo = suscribir(escucha);
        await completarConexion();

        expect(simulacion.clientes).toHaveLength(1);
        const cliente = simulacion.clientes[0];
        expect(cliente.query).toHaveBeenCalledExactlyOnceWith("LISTEN uam_publicaciones");
        expect(primero.oyente).toHaveBeenCalledWith(null);
        expect(segundo.oyente).toHaveBeenCalledWith(null);
        primero.desuscribir();
        expect(cliente.end).not.toHaveBeenCalled();
        segundo.desuscribir();
        await vi.advanceTimersByTimeAsync(59999);
        expect(cliente.end).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(cliente.end).toHaveBeenCalledOnce();
        expect(vi.getTimerCount()).toBe(0);
    });

    it("distribuye cambios válidos y descarta canales o mensajes inválidos", async () => {
        const escucha = new EscuchaPublicaciones();
        const { oyente } = suscribir(escucha);
        await completarConexion();
        oyente.mockClear();
        const cliente = simulacion.clientes[0];
        const version = escucha.obtenerVersion();
        for (const payload of ["no-json", "null", "{}", '{"operadorId":0,"publicacionId":2}', '{"operadorId":1,"publicacionId":1.5}', '{"operadorId":"1","publicacionId":2}', '{"operadorId":1,"publicacionId":null}']) {
            cliente.emitir("notification", { channel: "uam_publicaciones", payload });
        }
        const cambio = { operadorId: 1, publicacionId: 2 };
        cliente.emitir("notification", { channel: "otro", payload: JSON.stringify(cambio) });
        expect(oyente).not.toHaveBeenCalled();
        expect(escucha.obtenerVersion()).toBe(version);
        cliente.emitir("notification", { channel: "uam_publicaciones", payload: JSON.stringify(cambio) });
        expect(oyente).toHaveBeenCalledExactlyOnceWith(cambio);
        expect(escucha.obtenerVersion()).not.toBe(version);
        expect(escucha.obtenerVersion(1)).toBe(escucha.obtenerVersion());
    });

    it("invalida el catálogo de un operador sin requerir una publicación individual", async () => {
        const escucha = new EscuchaPublicaciones();
        const { oyente } = suscribir(escucha);
        await completarConexion();
        oyente.mockClear();
        const epoca = escucha.obtenerVersion();

        simulacion.clientes[0].emitir("notification", { channel: "uam_publicaciones", payload: JSON.stringify({ operadorId: 7 }) });

        expect(oyente).toHaveBeenCalledExactlyOnceWith({ operadorId: 7 });
        expect(escucha.obtenerVersion()).not.toBe(epoca);
        expect(escucha.obtenerVersion(7)).toBe(escucha.obtenerVersion());
        expect(escucha.obtenerVersion(8)).toBe(epoca);
    });

    it("conserva la versión al reconectar SSE sin cambios y cancela la gracia", async () => {
        const escucha = new EscuchaPublicaciones();
        const primero = suscribir(escucha);
        await completarConexion();
        const version = escucha.obtenerVersion();
        primero.desuscribir();
        await vi.advanceTimersByTimeAsync(55000);

        const segundo = suscribir(escucha);
        expect(segundo.oyente).toHaveBeenCalledExactlyOnceWith(null);
        expect(escucha.obtenerVersion()).toBe(version);
        await vi.advanceTimersByTimeAsync(6000);
        expect(simulacion.clientes).toHaveLength(1);
        expect(simulacion.clientes[0].end).not.toHaveBeenCalled();
    });

    it("recuerda cambios durante la gracia y mantiene versiones independientes por operador", async () => {
        const escucha = new EscuchaPublicaciones();
        const primero = suscribir(escucha);
        await completarConexion();
        const epoca = escucha.obtenerVersion();
        expect(escucha.obtenerVersion(7)).toBe(epoca);
        expect(escucha.obtenerVersion(8)).toBe(epoca);
        primero.desuscribir();
        const cliente = simulacion.clientes[0];
        cliente.emitir("notification", { channel: "uam_publicaciones", payload: JSON.stringify({ operadorId: 7, publicacionId: 43 }) });
        const version7 = escucha.obtenerVersion(7);
        expect(version7).not.toBe(epoca);
        expect(escucha.obtenerVersion()).toBe(version7);
        expect(escucha.obtenerVersion(8)).toBe(epoca);
        cliente.emitir("notification", { channel: "uam_publicaciones", payload: JSON.stringify({ operadorId: 8, publicacionId: 44 }) });
        expect(escucha.obtenerVersion()).toBe(escucha.obtenerVersion(8));
        expect(escucha.obtenerVersion(8)).not.toBe(version7);
        expect(escucha.obtenerVersion(7)).toBe(version7);

        const segundo = suscribir(escucha);
        expect(segundo.oyente).toHaveBeenCalledExactlyOnceWith(null);
        expect(escucha.obtenerVersion(7)).toBe(version7);
        expect(simulacion.clientes).toHaveLength(1);
    });

    it("limpia las versiones al terminar la gracia y abre una nueva época al volver", async () => {
        const escucha = new EscuchaPublicaciones();
        const primero = suscribir(escucha);
        await completarConexion();
        const anterior = simulacion.clientes[0];
        const epocaAnterior = escucha.obtenerVersion(8);
        anterior.emitir("notification", { channel: "uam_publicaciones", payload: JSON.stringify({ operadorId: 7, publicacionId: 43 }) });
        primero.desuscribir();
        await vi.advanceTimersByTimeAsync(60000);
        expect(anterior.end).toHaveBeenCalledOnce();
        expect(escucha.obtenerVersion(7)).toBe(escucha.obtenerVersion(8));
        const segundo = suscribir(escucha);
        expect(segundo.oyente).not.toHaveBeenCalled();
        await completarConexion();
        expect(escucha.obtenerVersion()).not.toBe(epocaAnterior);
        expect(escucha.obtenerVersion(7)).toBe(escucha.obtenerVersion());
        expect(segundo.oyente).toHaveBeenCalledExactlyOnceWith(null);
    });

    it("reconecta después de un error y avisa que hay que recargar el estado", async () => {
        const escucha = new EscuchaPublicaciones();
        const { oyente } = suscribir(escucha);
        await completarConexion();
        const anterior = simulacion.clientes[0];
        const epocaAnterior = escucha.obtenerVersion();
        anterior.emitir("error", new Error("conexión interrumpida"));
        anterior.emitir("end");
        expect(anterior.end).toHaveBeenCalledOnce();
        await vi.advanceTimersByTimeAsync(2999);
        expect(simulacion.clientes).toHaveLength(1);
        await vi.advanceTimersByTimeAsync(1);
        expect(simulacion.clientes).toHaveLength(2);
        expect(simulacion.clientes[1].query).toHaveBeenCalledExactlyOnceWith("LISTEN uam_publicaciones");
        expect(oyente).toHaveBeenCalledTimes(2);
        expect(oyente).toHaveBeenLastCalledWith(null);
        const nuevaEpoca = escucha.obtenerVersion();
        expect(nuevaEpoca).not.toBe(epocaAnterior);
        expect(escucha.obtenerVersion(7)).toBe(nuevaEpoca);
        anterior.emitir("notification", { channel: "uam_publicaciones", payload: JSON.stringify({ operadorId: 7, publicacionId: 43 }) });
        expect(escucha.obtenerVersion()).toBe(nuevaEpoca);
        expect(oyente).toHaveBeenCalledTimes(2);
    });

    it("no anuncia conexión hasta confirmar LISTEN y descarta una confirmación obsoleta", async () => {
        const listenPendiente = Promise.withResolvers<void>();
        simulacion.consultas.push(listenPendiente.promise);
        const escucha = new EscuchaPublicaciones();
        const primero = suscribir(escucha);
        await completarConexion();
        expect(primero.oyente).not.toHaveBeenCalled();
        primero.desuscribir();
        expect(simulacion.clientes[0].end).toHaveBeenCalledOnce();
        const segundo = suscribir(escucha);
        listenPendiente.resolve();
        await completarConexion();
        expect(simulacion.clientes).toHaveLength(2);
        expect(primero.oyente).not.toHaveBeenCalled();
        expect(segundo.oyente).toHaveBeenCalledExactlyOnceWith(null);
    });

    it("cancela la reconexión si ya no quedan oyentes", async () => {
        const escucha = new EscuchaPublicaciones();
        const { desuscribir } = suscribir(escucha);
        await completarConexion();
        simulacion.clientes[0].emitir("end");
        desuscribir();
        await vi.advanceTimersByTimeAsync(6000);
        expect(simulacion.clientes).toHaveLength(1);
    });

    it("abre otra conexión si cambia el último oyente mientras la anterior está conectando", async () => {
        const conexionPendiente = Promise.withResolvers<void>();
        simulacion.conexiones.push(conexionPendiente.promise);
        const escucha = new EscuchaPublicaciones();
        const primero = suscribir(escucha);
        primero.desuscribir();
        const segundo = suscribir(escucha);
        expect(simulacion.clientes).toHaveLength(1);
        conexionPendiente.resolve();
        await completarConexion();
        expect(simulacion.clientes).toHaveLength(2);
        expect(simulacion.clientes[0].query).not.toHaveBeenCalled();
        expect(segundo.oyente).toHaveBeenCalledExactlyOnceWith(null);
    });

    it("no escucha ni reabre una conexión pendiente cuando todos salieron", async () => {
        const conexionPendiente = Promise.withResolvers<void>();
        simulacion.conexiones.push(conexionPendiente.promise);
        const escucha = new EscuchaPublicaciones();
        const { desuscribir, oyente } = suscribir(escucha);
        desuscribir();
        conexionPendiente.resolve();
        await completarConexion();
        expect(simulacion.clientes).toHaveLength(1);
        expect(simulacion.clientes[0].query).not.toHaveBeenCalled();
        expect(oyente).not.toHaveBeenCalled();
    });

    it("reintenta una conexión rechazada sin crear conexiones en paralelo", async () => {
        const conexionPendiente = Promise.withResolvers<void>();
        simulacion.conexiones.push(conexionPendiente.promise);
        const escucha = new EscuchaPublicaciones();
        suscribir(escucha);
        suscribir(escucha);
        conexionPendiente.reject(new Error("servidor temporalmente indisponible"));
        await completarConexion();
        expect(simulacion.clientes).toHaveLength(1);
        await vi.advanceTimersByTimeAsync(3000);
        expect(simulacion.clientes).toHaveLength(2);
        expect(simulacion.clientes[1].query).toHaveBeenCalledOnce();
    });
});
