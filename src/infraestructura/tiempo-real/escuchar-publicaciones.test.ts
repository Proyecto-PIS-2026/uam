import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EscuchaPublicaciones } from "./escuchar-publicaciones";

const simulacion = vi.hoisted(() => {
    const conexiones: Promise<void>[] = [];
    const clientes: ClienteSimulado[] = [];
    class ClienteSimulado {
        private eventos = new Map<string, ((dato?: unknown) => void)[]>();
        connect = vi.fn(() => conexiones.shift() ?? Promise.resolve());
        query = vi.fn(async () => undefined);
        end = vi.fn(async () => undefined);

        constructor() { clientes.push(this); }

        on(evento: string, manejar: (dato?: unknown) => void) {
            this.eventos.set(evento, [...this.eventos.get(evento) ?? [], manejar]);
        }

        emitir(evento: string, dato?: unknown) {
            for (const manejar of this.eventos.get(evento) ?? []) manejar(dato);
        }
    }
    return { clientes, conexiones, ClienteSimulado };
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
});

afterEach(() => {
    for (const desuscribir of desuscripciones.splice(0)) desuscribir();
    vi.clearAllTimers();
    vi.useRealTimers();
});

describe("EscuchaPublicaciones", () => {
    it("comparte una conexión entre oyentes y la cierra al salir el último", async () => {
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
        expect(cliente.end).toHaveBeenCalledOnce();
    });

    it("distribuye cambios válidos y descarta canales o mensajes inválidos", async () => {
        const escucha = new EscuchaPublicaciones();
        const { oyente } = suscribir(escucha);
        await completarConexion();
        oyente.mockClear();
        const cliente = simulacion.clientes[0];
        for (const payload of ["no-json", "null", "{}", '{"operadorId":0,"publicacionId":2}', '{"operadorId":1,"publicacionId":1.5}', '{"operadorId":"1","publicacionId":2}']) {
            cliente.emitir("notification", { channel: "uam_publicaciones", payload });
        }
        const cambio = { operadorId: 1, publicacionId: 2 };
        cliente.emitir("notification", { channel: "otro", payload: JSON.stringify(cambio) });
        expect(oyente).not.toHaveBeenCalled();
        cliente.emitir("notification", { channel: "uam_publicaciones", payload: JSON.stringify(cambio) });
        expect(oyente).toHaveBeenCalledExactlyOnceWith(cambio);
    });

    it("reconecta después de un error y avisa que hay que recargar el estado", async () => {
        const escucha = new EscuchaPublicaciones();
        const { oyente } = suscribir(escucha);
        await completarConexion();
        const anterior = simulacion.clientes[0];
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
