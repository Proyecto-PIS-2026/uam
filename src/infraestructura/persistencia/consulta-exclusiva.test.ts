import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type EjecutarConsulta = typeof import("./consulta-exclusiva").ejecutarConsultaExclusiva;
type GuardarConsulta = Parameters<Parameters<EjecutarConsulta>[1]>[0];

const mocks = vi.hoisted(() => {
    type Plan = { texto: string; valores: unknown[] };
    type Reserva = { id: number; propietario: string; vence: number };
    const reservas = new Map<string, Reserva>();
    let reloj = 0;
    let siguienteId = 1;
    let activas = 0;

    const query = vi.fn(async (plan: Plan) => {
        const [nombre, propietario, duracion] = plan.valores as [string, string, number];
        const actual = reservas.get(nombre);
        if (plan.texto.includes("INSERT INTO configuracion")) {
            if (actual && actual.vence >= reloj) return [];
            const reserva = { id: actual?.id ?? siguienteId++, propietario, vence: reloj + duracion };
            reservas.set(nombre, reserva);
            return [{ id: reserva.id }];
        }
        if (plan.texto.includes("DELETE FROM configuracion")) {
            if (!actual || actual.propietario !== propietario) return [];
            reservas.delete(nombre);
            return [{ id: actual.id }];
        }
        throw new Error("Consulta SQL inesperada en la prueba");
    });
    const execute = vi.fn(async (plan: Plan) => {
        const reserva = reservas.get(String(plan.valores[0]));
        return reserva ? [{ id: reserva.id }] : [];
    });
    const tx = {
        execute,
        orm: { public: { Configuracion: {
            where: ({ nombreConfiguracion }: { nombreConfiguracion: string }) => ({
                first: async () => {
                    const reserva = reservas.get(nombreConfiguracion);
                    return reserva ? { id: reserva.id, nombreConfiguracion, valorConfiguracion: JSON.stringify(reserva) } : null;
                },
            }),
        } } },
    };
    const transaction = vi.fn(async (trabajo: (conexion: typeof tx) => Promise<unknown>) => {
        activas++;
        try { return await trabajo(tx); } finally { activas--; }
    });

    return {
        reservas,
        query,
        execute,
        transaction,
        tx,
        activas: () => activas,
        avanzarReloj: (segundos: number) => { reloj += segundos; },
        reiniciar: () => { reservas.clear(); reloj = 0; siguienteId = 1; activas = 0; },
        db: {
            transaction,
            runtime: () => ({ query }),
            raw: {
                sql: (partes: TemplateStringsArray, ...valores: unknown[]) => ({
                    returnsRow: () => ({ build: (): Plan => ({ texto: partes.join("?"), valores }) }),
                }),
            },
        },
    };
});

vi.mock("./prisma/db", () => ({ db: mocks.db }));

function diferida<T>() {
    let resolver!: (valor: T) => void;
    const promesa = new Promise<T>((resolve) => { resolver = resolve; });
    return { promesa, resolver };
}

function nombreReserva(clave: string) {
    return `consulta-en-curso:${createHash("sha256").update(clave).digest("hex")}`;
}

let ejecutar: EjecutarConsulta;

beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.useFakeTimers();
    mocks.reiniciar();
    ejecutar = (await import("./consulta-exclusiva")).ejecutarConsultaExclusiva;
});

afterEach(() => { vi.useRealTimers(); });

describe("consulta exclusiva sin retener una conexión durante la espera externa", () => {
    it("abre la transacción solamente para comprobar la reserva y guardar la respuesta", async () => {
        const inicio = diferida<void>();
        const respuesta = diferida<string>();
        const consulta = ejecutar("referencia", async (guardar) => {
            inicio.resolver();
            const dato = await respuesta.promesa;
            return guardar(async (tx) => {
                expect(tx).toBe(mocks.tx);
                expect(mocks.activas()).toBe(1);
                expect(mocks.execute).toHaveBeenCalledOnce();
                expect(mocks.execute.mock.calls[0][0].texto).toContain("FOR UPDATE");
                return dato;
            });
        });
        await inicio.promesa;
        expect(mocks.transaction).not.toHaveBeenCalled();
        expect(mocks.activas()).toBe(0);
        respuesta.resolver("precios");
        await expect(consulta).resolves.toBe("precios");
        expect(mocks.transaction).toHaveBeenCalledOnce();
        expect(mocks.activas()).toBe(0);
        expect(mocks.reservas.size).toBe(0);
    });

    it("ordena solicitudes locales de la misma clave y permite releer la caché actualizada", async () => {
        const inicio = diferida<void>();
        const respuesta = diferida<string>();
        let cache: string | undefined;
        const remoto = vi.fn(() => respuesta.promesa);
        const consultar = vi.fn(async (guardar: GuardarConsulta) => {
            if (cache) return cache;
            inicio.resolver();
            const dato = await remoto();
            return guardar(async () => cache = dato);
        });
        const primera = ejecutar("referencia", consultar);
        await inicio.promesa;
        const segunda = ejecutar("referencia", consultar);
        await vi.advanceTimersByTimeAsync(500);
        expect(consultar).toHaveBeenCalledOnce();
        expect(mocks.query).toHaveBeenCalledOnce();
        expect(mocks.activas()).toBe(0);
        respuesta.resolver("precios");
        await expect(Promise.all([primera, segunda])).resolves.toEqual(["precios", "precios"]);
        expect(consultar).toHaveBeenCalledTimes(2);
        expect(remoto).toHaveBeenCalledOnce();
        expect(mocks.transaction).toHaveBeenCalledOnce();
        expect(mocks.reservas.size).toBe(0);
    });

    it("permite consultar y guardar otra clave mientras la primera sigue esperando", async () => {
        const inicio = diferida<void>();
        const respuesta = diferida<string>();
        const primera = ejecutar("tomate", async (guardar) => {
            inicio.resolver();
            const dato = await respuesta.promesa;
            return guardar(async () => dato);
        });
        await inicio.promesa;
        await expect(ejecutar("papa", async (guardar) => guardar(async () => "papa"))).resolves.toBe("papa");
        expect(mocks.activas()).toBe(0);
        expect(mocks.reservas.size).toBe(1);
        respuesta.resolver("tomate");
        await expect(primera).resolves.toBe("tomate");
    });

    it("libera la reserva cuando falla la consulta y permite continuar la cola local", async () => {
        const inicio = diferida<void>();
        const terminar = diferida<void>();
        const primera = ejecutar("referencia", async () => {
            inicio.resolver();
            await terminar.promesa;
            throw new Error("Servicio no disponible");
        });
        const error = expect(primera).rejects.toThrow("Servicio no disponible");
        await inicio.promesa;
        const segunda = ejecutar("referencia", async () => "recuperado");
        terminar.resolver();
        await error;
        await expect(segunda).resolves.toBe("recuperado");
        expect(mocks.transaction).not.toHaveBeenCalled();
        expect(mocks.reservas.size).toBe(0);
    });

    it("coordina dos instancias independientes sin abrir transacciones durante la consulta ni el sondeo", async () => {
        vi.resetModules();
        const otraInstancia = (await import("./consulta-exclusiva")).ejecutarConsultaExclusiva;
        const inicio = diferida<void>();
        const respuesta = diferida<string>();
        let cache: string | undefined;
        const remoto = vi.fn(() => respuesta.promesa);
        const consultar = vi.fn(async (guardar: GuardarConsulta) => {
            if (cache) return cache;
            inicio.resolver();
            const dato = await remoto();
            return guardar(async () => cache = dato);
        });
        const primera = ejecutar("referencia", consultar);
        await inicio.promesa;
        const segunda = otraInstancia("referencia", consultar);
        await vi.advanceTimersByTimeAsync(500);
        expect(mocks.query.mock.calls.filter(([plan]) => plan.texto.includes("INSERT INTO")).length).toBeGreaterThanOrEqual(2);
        expect(consultar).toHaveBeenCalledOnce();
        expect(mocks.transaction).not.toHaveBeenCalled();
        expect(mocks.activas()).toBe(0);
        respuesta.resolver("precios");
        await primera;
        await vi.advanceTimersByTimeAsync(500);
        await expect(segunda).resolves.toBe("precios");
        expect(consultar).toHaveBeenCalledTimes(2);
        expect(remoto).toHaveBeenCalledOnce();
        expect(mocks.transaction).toHaveBeenCalledOnce();
        expect(mocks.reservas.size).toBe(0);
    });

    it("impide que el dueño anterior guarde o libere una reserva reemplazada tras vencer", async () => {
        vi.resetModules();
        const otraInstancia = (await import("./consulta-exclusiva")).ejecutarConsultaExclusiva;
        const inicioAnterior = diferida<void>();
        const inicioNuevo = diferida<void>();
        const respuestaAnterior = diferida<void>();
        const respuestaNueva = diferida<void>();
        const guardarAnterior = vi.fn(async () => "viejo");
        let cache: string | undefined;
        const primera = ejecutar("referencia", async (guardar) => {
            if (cache) return cache;
            inicioAnterior.resolver();
            await respuestaAnterior.promesa;
            return guardar(guardarAnterior);
        });
        await inicioAnterior.promesa;
        const propietarioAnterior = mocks.reservas.get(nombreReserva("referencia"))!.propietario;
        mocks.avanzarReloj(181);
        const segunda = otraInstancia("referencia", async (guardar) => {
            inicioNuevo.resolver();
            await respuestaNueva.promesa;
            return guardar(async () => cache = "nuevo");
        });
        await inicioNuevo.promesa;
        const propietarioNuevo = mocks.reservas.get(nombreReserva("referencia"))!.propietario;
        expect(propietarioNuevo).not.toBe(propietarioAnterior);
        respuestaAnterior.resolver();
        await vi.advanceTimersByTimeAsync(0);
        expect(guardarAnterior).not.toHaveBeenCalled();
        expect(mocks.reservas.get(nombreReserva("referencia"))!.propietario).toBe(propietarioNuevo);
        respuestaNueva.resolver();
        await expect(segunda).resolves.toBe("nuevo");
        await vi.advanceTimersByTimeAsync(500);
        await expect(primera).resolves.toBe("nuevo");
        expect(guardarAnterior).not.toHaveBeenCalled();
        expect(mocks.reservas.size).toBe(0);
    });

    it("reintenta la consulta sin guardar el resultado anterior si desapareció la reserva", async () => {
        const guardarDato = vi.fn(async () => "precios");
        let intentos = 0;
        const consultar = vi.fn(async (guardar: GuardarConsulta) => {
            if (++intentos === 1) mocks.reservas.clear();
            return guardar(guardarDato);
        });
        await expect(ejecutar("referencia", consultar)).resolves.toBe("precios");
        expect(consultar).toHaveBeenCalledTimes(2);
        expect(guardarDato).toHaveBeenCalledOnce();
        expect(mocks.activas()).toBe(0);
    });

    it("recupera una reserva abandonada cuando vence sin mantener una transacción abierta", async () => {
        mocks.reservas.set(nombreReserva("referencia"), { id: 10, propietario: "proceso-anterior", vence: 1 });
        const consultar = vi.fn(async () => "precios");
        const resultado = ejecutar("referencia", consultar);
        await vi.advanceTimersByTimeAsync(500);
        expect(consultar).not.toHaveBeenCalled();
        expect(mocks.transaction).not.toHaveBeenCalled();
        mocks.avanzarReloj(2);
        await vi.advanceTimersByTimeAsync(500);
        await expect(resultado).resolves.toBe("precios");
        expect(mocks.reservas.size).toBe(0);
    });

    it("limita la espera ante una reserva ocupada sin borrarla ni consultar el servicio", async () => {
        mocks.reservas.set(nombreReserva("referencia"), { id: 10, propietario: "otro-proceso", vence: 10000 });
        const consultar = vi.fn(async () => "precios");
        const resultado = ejecutar("referencia", consultar);
        const error = expect(resultado).rejects.toThrow();
        await vi.advanceTimersByTimeAsync(240500);
        await error;
        expect(consultar).not.toHaveBeenCalled();
        expect(mocks.transaction).not.toHaveBeenCalled();
        expect(mocks.reservas.get(nombreReserva("referencia"))!.propietario).toBe("otro-proceso");
        expect(mocks.query.mock.calls.some(([plan]) => plan.texto.includes("DELETE FROM"))).toBe(false);
    });

    it("libera la reserva aunque falle el guardado dentro de la transacción", async () => {
        await expect(ejecutar("referencia", async (guardar) => guardar(async () => {
            throw new Error("No se pudo guardar");
        }))).rejects.toThrow("No se pudo guardar");
        expect(mocks.transaction).toHaveBeenCalledOnce();
        expect(mocks.activas()).toBe(0);
        expect(mocks.reservas.size).toBe(0);
    });
});
