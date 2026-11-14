import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Temporal } from "temporal-polyfill";
import { procesarVencimientosUsuario } from "./procesar-vencimientos";

const mocks = vi.hoisted(() => ({
    configFirst: vi.fn(),
    operadorFirst: vi.fn(),
    productorFirst: vi.fn(),
    publicacionesOperador: vi.fn(),
    publicacionesProductor: vi.fn(),
    transaction: vi.fn(),
    query: vi.fn(),
    execute: vi.fn(),
    tx: {} as Record<string, unknown>,
    publicacionWhere: vi.fn(),
    publicacionUpdate: vi.fn(),
    enviarNotificacion: vi.fn(),
}));

vi.mock("@/modulos/notificaciones/notificaciones", () => ({
    enviarNotificacion: mocks.enviarNotificacion,
}));

vi.mock("@/infraestructura/persistencia/prisma/db", () => {
    type Consulta = {
        select: () => Consulta;
        include: (relacion: string, configurar?: (consulta: Consulta) => unknown) => Consulta;
        all: () => unknown;
        first: () => unknown;
    };

    const consulta = (terminales: Partial<Pick<Consulta, "all" | "first">>): Consulta => {
        const c: Consulta = {
            select: () => c,
            include: (_relacion, configurar) => {
                configurar?.(c);
                return c;
            },
            all: terminales.all ?? (() => undefined),
            first: terminales.first ?? (() => undefined),
        };
        return c;
    };

    Object.assign(mocks.tx, {
        query: mocks.query,
        execute: mocks.execute,
        orm: {
            public: {
                Publicacion: {
                    where: (filtro: unknown) => {
                        mocks.publicacionWhere(filtro);
                        return { update: mocks.publicacionUpdate };
                    },
                },
            },
        },
    });

    return {
        db: {
            transaction: mocks.transaction,
            raw: {
                sql: (partes: TemplateStringsArray, ...valores: unknown[]) => ({
                    returnsRow: () => ({ build: () => ({ sql: partes.join("?"), valores }) }),
                }),
            },
            orm: {
                public: {
                    Configuracion: {
                        where: (filtro: { nombreConfiguracion: string }) =>
                            consulta({ first: () => mocks.configFirst(filtro.nombreConfiguracion) }),
                    },
                    Operador: { where: () => consulta({ first: () => mocks.operadorFirst() }) },
                    Productor: { where: () => consulta({ first: () => mocks.productorFirst() }) },
                    PublicacionOperador: {
                        where: (filtro: unknown) => consulta({ all: () => mocks.publicacionesOperador(filtro) }),
                    },
                    PublicacionProductor: {
                        where: (filtro: unknown) => consulta({ all: () => mocks.publicacionesProductor(filtro) }),
                    },
                },
            },
        },
    };
});

const USUARIO = 5;
const OPERADOR_ID = 7;
const PRODUCTOR_ID = 9;
const AHORA = Temporal.Instant.from("2026-11-04T15:00:00Z");
const VENCIDA = AHORA.subtract({ hours: 48 }); // 2026-11-02 en Montevideo
const PROXIMA = AHORA.add({ hours: 48 });      // 2026-11-06 en Montevideo

const NOMBRES_AVISO = ["aviso_vencimiento_publicaciones_operador_habilitado", "aviso_vencimiento_publicaciones_productor_habilitado"];
type EstadoPublicacion = {
    fechaVigencia: string | null;
    publicacionDisponible: boolean;
    avisoProximoVencimientoEn: Temporal.Instant | null;
    avisoVencimientoEn: Temporal.Instant | null;
};
const publicacionesActuales = new Map<number, EstadoPublicacion>();

function registrarAviso(publicacionId: number, tipo: "proximo" | "vencido") {
    const publicacion = publicacionesActuales.get(publicacionId);
    if (!publicacion) throw new Error("Falta la publicación de la prueba.");
    publicacion[tipo === "proximo" ? "avisoProximoVencimientoEn" : "avisoVencimientoEn"] = AHORA;
}

function configurar({ aviso = "true", dias = "7" }: { aviso?: string | null; dias?: string | null } = {}) {
    mocks.configFirst.mockImplementation(async (nombre: string) => {
        const valor = NOMBRES_AVISO.includes(nombre) ? aviso : dias;
        return valor === null ? null : { valorConfiguracion: valor };
    });
}

function relacion(id: number, fechaVigencia: Temporal.Instant | null, disponible = true, especie = "Tomate") {
    const estado: EstadoPublicacion = {
        fechaVigencia: fechaVigencia?.toString() ?? null,
        publicacionDisponible: disponible,
        avisoProximoVencimientoEn: null,
        avisoVencimientoEn: null,
    };
    publicacionesActuales.set(id, estado);
    return {
        publicacion: {
            id,
            fechaVigencia,
            get publicacionDisponible() { return estado.publicacionDisponible; },
            get avisoProximoVencimientoEn() { return estado.avisoProximoVencimientoEn; },
            get avisoVencimientoEn() { return estado.avisoVencimientoEn; },
            especie: { nombreEspecie: especie },
        },
    };
}

function comoOperador(publicaciones: unknown[]) {
    mocks.operadorFirst.mockResolvedValue({ id: OPERADOR_ID });
    mocks.publicacionesOperador.mockResolvedValue(publicaciones);
}

function comoProductor(publicaciones: unknown[]) {
    mocks.productorFirst.mockResolvedValue({ id: PRODUCTOR_ID });
    mocks.publicacionesProductor.mockResolvedValue(publicaciones);
}

function comoRol(rol: "operador" | "productor", publicaciones: unknown[]) {
    if (rol === "operador") comoOperador(publicaciones);
    else comoProductor(publicaciones);
}

const textoVencida = (fecha: string, especie = "Tomate") =>
    `Tu publicación de ${especie} ha vencido el ${fecha} y ya no está disponible.`;

const textoAviso = (fecha: string, especie = "Tomate") =>
    `Tu publicación de ${especie} está próxima a vencer el ${fecha}.`;

describe("procesarVencimientosUsuario", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date(AHORA.epochMilliseconds));

        configurar();
        publicacionesActuales.clear();
        mocks.transaction.mockImplementation((trabajo: (tx: unknown) => Promise<unknown>) => trabajo(mocks.tx));
        mocks.query.mockImplementation(async ({ valores }: { valores: unknown[] }) => {
            const [id, fechaVigencia] = valores as [number, string];
            const actual = publicacionesActuales.get(id);
            return actual?.fechaVigencia === fechaVigencia
                ? [{
                    id,
                    publicacionDisponible: actual.publicacionDisponible,
                    avisoProximoEnviado: actual.avisoProximoVencimientoEn !== null,
                    avisoVencidoEnviado: actual.avisoVencimientoEn !== null,
                }]
                : [];
        });
        mocks.execute.mockImplementation(async ({ sql, valores }: { sql: string; valores: unknown[] }) => {
            const [fecha, id] = valores as [string, number];
            const actual = publicacionesActuales.get(id);
            if (actual) {
                const campo = sql.includes('"avisoProximoVencimientoEn"') ? "avisoProximoVencimientoEn" : "avisoVencimientoEn";
                actual[campo] = Temporal.Instant.from(fecha);
            }
        });
        mocks.operadorFirst.mockResolvedValue(null);
        mocks.productorFirst.mockResolvedValue(null);
        mocks.publicacionesOperador.mockResolvedValue([]);
        mocks.publicacionesProductor.mockResolvedValue([]);
        mocks.publicacionUpdate.mockImplementation(async (cambios: Partial<EstadoPublicacion>) => {
            const { id } = mocks.publicacionWhere.mock.lastCall?.[0] as { id: number };
            const actual = publicacionesActuales.get(id);
            if (actual) Object.assign(actual, cambios);
        });
        mocks.enviarNotificacion.mockResolvedValue({ enviadas: 1 });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe("validación y rol del usuario", () => {
        it.each(["operador", "productor"] as const)("consulta exclusivamente la política de avisos del %s", async (rol) => {
            comoRol(rol, []);

            await procesarVencimientosUsuario(USUARIO);

            expect(mocks.configFirst.mock.calls.map(([nombre]) => nombre)).toEqual([
                `aviso_vencimiento_publicaciones_${rol}_habilitado`,
                `anticipacion_aviso_publicaciones_${rol}`,
            ]);
        });

        it.each(["operador", "productor"] as const)("aplica el plazo propio del %s aunque el otro rol tenga otro", async (rol) => {
            mocks.configFirst.mockImplementation(async (nombre: string) => ({
                valorConfiguracion: NOMBRES_AVISO.includes(nombre) ? "true" : nombre.endsWith("_operador") ? "2" : "7",
            }));
            comoRol(rol, [relacion(1, AHORA.add({ hours: 4 * 24 }))]);

            await procesarVencimientosUsuario(USUARIO);

            expect(mocks.enviarNotificacion).toHaveBeenCalledTimes(rol === "operador" ? 0 : 1);
        });

        it.each(["operador", "productor"] as const)("desactivar avisos del operador respeta el estado propio del %s", async (rol) => {
            mocks.configFirst.mockImplementation(async (nombre: string) => ({
                valorConfiguracion: nombre === NOMBRES_AVISO[0] ? "false" : nombre === NOMBRES_AVISO[1] ? "true" : "7",
            }));
            comoRol(rol, [relacion(1, PROXIMA)]);

            await procesarVencimientosUsuario(USUARIO);

            expect(mocks.enviarNotificacion).toHaveBeenCalledTimes(rol === "operador" ? 0 : 1);
        });

        it.each([0, -1, 1.5, Number.NaN])("ignora el usuarioId inválido %s sin consultar la base", async (id) => {
            await procesarVencimientosUsuario(id);

            expect(mocks.configFirst).not.toHaveBeenCalled();
            expect(mocks.enviarNotificacion).not.toHaveBeenCalled();
        });

        it("no hace nada si el usuario no es operador ni productor", async () => {
            await procesarVencimientosUsuario(USUARIO);

            expect(mocks.publicacionesOperador).not.toHaveBeenCalled();
            expect(mocks.publicacionesProductor).not.toHaveBeenCalled();
            expect(mocks.enviarNotificacion).not.toHaveBeenCalled();
        });

        it("consulta solo las publicaciones del operador cuando el usuario es operador", async () => {
            comoOperador([]);

            await procesarVencimientosUsuario(USUARIO);

            expect(mocks.publicacionesOperador).toHaveBeenCalledWith({ operadorId: OPERADOR_ID });
            expect(mocks.publicacionesProductor).not.toHaveBeenCalled();
        });

        it("consulta solo las publicaciones del productor cuando el usuario es productor", async () => {
            comoProductor([]);

            await procesarVencimientosUsuario(USUARIO);

            expect(mocks.publicacionesProductor).toHaveBeenCalledWith({ productorId: PRODUCTOR_ID });
            expect(mocks.publicacionesOperador).not.toHaveBeenCalled();
        });

        it("ignora las publicaciones sin fechaVigencia", async () => {
            comoOperador([relacion(1, null)]);

            await procesarVencimientosUsuario(USUARIO);

            expect(mocks.transaction).not.toHaveBeenCalled();
            expect(mocks.publicacionUpdate).not.toHaveBeenCalled();
            expect(mocks.enviarNotificacion).not.toHaveBeenCalled();
        });
    });

    describe("publicaciones vencidas", () => {
        it.each(["operador", "productor"] as const)(
            "marca como no disponible y notifica la publicación vencida de un %s",
            async (rol) => {
                comoRol(rol, [relacion(1, VENCIDA)]);

                await procesarVencimientosUsuario(USUARIO);

                expect(mocks.publicacionWhere).toHaveBeenCalledWith({ id: 1 });
                expect(mocks.publicacionUpdate).toHaveBeenCalledWith({ publicacionDisponible: false });
                expect(mocks.enviarNotificacion).toHaveBeenCalledOnce();
                expect(mocks.enviarNotificacion).toHaveBeenCalledWith({
                    texto: textoVencida("2026-11-02"),
                    usuarios: [USUARIO],
                    url: rol === "operador" ? "/mi-mercado?publicacion=1" : "/mi-mercado/productor?publicacion=1",
                }, mocks.tx);
            }
        );

        it("notifica una vencida que ya estaba no disponible sin volver a modificar su disponibilidad", async () => {
            comoOperador([relacion(1, VENCIDA, false)]);

            await procesarVencimientosUsuario(USUARIO);

            expect(mocks.publicacionUpdate).not.toHaveBeenCalled();
            expect(publicacionesActuales.get(1)?.avisoVencimientoEn).toEqual(AHORA);
            expect(mocks.enviarNotificacion).toHaveBeenCalledOnce();
        });

        it("no repite la notificación de vencida si ya fue enviada", async () => {
            comoOperador([relacion(1, VENCIDA, false)]);
            registrarAviso(1, "vencido");

            await procesarVencimientosUsuario(USUARIO);

            expect(mocks.enviarNotificacion).not.toHaveBeenCalled();
        });

        it("marca y notifica la vencida aunque los avisos de próxima a vencer estén deshabilitados", async () => {
            configurar({ aviso: "false" });
            comoProductor([relacion(1, VENCIDA)]);

            await procesarVencimientosUsuario(USUARIO);

            expect(mocks.publicacionUpdate).toHaveBeenCalledWith({ publicacionDisponible: false });
            expect(mocks.enviarNotificacion).toHaveBeenCalledOnce();
        });
    });

    describe("publicaciones próximas a vencer", () => {
        it.each(["operador", "productor"] as const)(
            "notifica sin modificar la disponibilidad cuando la publicación de un %s está próxima a vencer",
            async (rol) => {
                comoRol(rol, [relacion(1, PROXIMA)]);

                await procesarVencimientosUsuario(USUARIO);

                expect(mocks.publicacionUpdate).not.toHaveBeenCalled();
                expect(publicacionesActuales.get(1)?.avisoProximoVencimientoEn).toEqual(AHORA);
                expect(mocks.enviarNotificacion).toHaveBeenCalledOnce();
                expect(mocks.enviarNotificacion).toHaveBeenCalledWith({
                    texto: textoAviso("2026-11-06"),
                    usuarios: [USUARIO],
                    url: rol === "operador" ? "/mi-mercado?publicacion=1" : "/mi-mercado/productor?publicacion=1",
                }, mocks.tx);
            }
        );

        it("notifica cuando vence justo en el límite de la anticipación", async () => {
            comoOperador([relacion(1, AHORA.add({ hours: 7 * 24 }))]);

            await procesarVencimientosUsuario(USUARIO);

            expect(mocks.enviarNotificacion).toHaveBeenCalledOnce();
        });

        it("no notifica cuando vence apenas después del límite de la anticipación", async () => {
            comoOperador([relacion(1, AHORA.add({ hours: 7 * 24 + 1 }))]);

            await procesarVencimientosUsuario(USUARIO);

            expect(mocks.enviarNotificacion).not.toHaveBeenCalled();
        });

        it("no notifica ni modifica una publicación con vigencia lejana", async () => {
            comoOperador([relacion(1, AHORA.add({ hours: 30 * 24 }))]);

            await procesarVencimientosUsuario(USUARIO);

            expect(mocks.publicacionUpdate).not.toHaveBeenCalled();
            expect(mocks.enviarNotificacion).not.toHaveBeenCalled();
        });

        it("no envía el aviso cuando la configuración está en false", async () => {
            configurar({ aviso: "false" });
            comoProductor([relacion(1, PROXIMA)]);

            await procesarVencimientosUsuario(USUARIO);

            expect(mocks.enviarNotificacion).not.toHaveBeenCalled();
        });

        it("envía el aviso cuando la configuración no existe", async () => {
            configurar({ aviso: null });
            comoProductor([relacion(1, PROXIMA)]);

            await procesarVencimientosUsuario(USUARIO);

            expect(mocks.enviarNotificacion).toHaveBeenCalledOnce();
        });

        it.each([
            [48, true],
            [96, false],
        ])("respeta la anticipación configurada en 3 días (vence en %s horas: notifica %s)", async (horas, notifica) => {
            configurar({ dias: "3" });
            comoOperador([relacion(1, AHORA.add({ hours: horas }))]);

            await procesarVencimientosUsuario(USUARIO);

            expect(mocks.enviarNotificacion).toHaveBeenCalledTimes(notifica ? 1 : 0);
        });

        it("usa 7 días de anticipación cuando el valor configurado no es numérico", async () => {
            configurar({ dias: "abc" });
            comoOperador([relacion(1, AHORA.add({ hours: 6 * 24 }))]);

            await procesarVencimientosUsuario(USUARIO);

            expect(mocks.enviarNotificacion).toHaveBeenCalledOnce();
        });

        it("usa como mínimo 1 día de anticipación", async () => {
            configurar({ dias: "-5" });
            comoOperador([
                relacion(1, AHORA.add({ hours: 12 })),
                relacion(2, AHORA.add({ hours: 36 })),
            ]);

            await procesarVencimientosUsuario(USUARIO);

            expect(mocks.enviarNotificacion).toHaveBeenCalledOnce();
            expect(mocks.enviarNotificacion).toHaveBeenCalledWith(
                expect.objectContaining({ url: "/mi-mercado?publicacion=1" }), mocks.tx,
            );
        });

        it("no repite el aviso si ya fue enviado", async () => {
            comoOperador([relacion(1, PROXIMA)]);
            registrarAviso(1, "proximo");

            await procesarVencimientosUsuario(USUARIO);

            expect(mocks.enviarNotificacion).not.toHaveBeenCalled();
        });
    });

    describe("varias publicaciones en la misma corrida", () => {
        it("procesa cada una según su estado y deja intactas las que no corresponden", async () => {
            comoOperador([
                relacion(1, VENCIDA),
                relacion(2, PROXIMA, true, "Manzana"),
                relacion(3, AHORA.add({ hours: 30 * 24 })),
                relacion(4, null),
            ]);

            await procesarVencimientosUsuario(USUARIO);

            expect(mocks.publicacionWhere).toHaveBeenCalledWith({ id: 1 });
            expect(mocks.publicacionWhere).not.toHaveBeenCalledWith({ id: 2 });
            expect(mocks.publicacionWhere).not.toHaveBeenCalledWith({ id: 3 });
            expect(mocks.publicacionWhere).not.toHaveBeenCalledWith({ id: 4 });
            expect(mocks.enviarNotificacion).toHaveBeenCalledTimes(2);
            expect(mocks.enviarNotificacion).toHaveBeenCalledWith(
                expect.objectContaining({ texto: textoVencida("2026-11-02") }), mocks.tx,
            );
            expect(mocks.enviarNotificacion).toHaveBeenCalledWith(
                expect.objectContaining({ texto: textoAviso("2026-11-06", "Manzana") }), mocks.tx,
            );
        });
    });

    describe.each(["operador", "productor"] as const)("avisos sin IDs visibles para %s", (rol) => {
        const rutaMercado = rol === "operador" ? "/mi-mercado" : "/mi-mercado/productor";
        const estados = [
            {
                estado: "vencidas",
                fecha: VENCIDA,
                texto: textoVencida("2026-11-02"),
                tipo: "vencido" as const,
            },
            {
                estado: "próximas a vencer",
                fecha: PROXIMA,
                texto: textoAviso("2026-11-06"),
                tipo: "proximo" as const,
            },
        ];

        it.each(estados)("notifica ambas publicaciones $estado aunque tengan la misma especie y fecha", async ({ fecha, texto }) => {
            comoRol(rol, [relacion(1, fecha), relacion(2, fecha)]);

            await procesarVencimientosUsuario(USUARIO);

            expect(mocks.enviarNotificacion).toHaveBeenCalledTimes(2);
            for (const id of [1, 2]) {
                expect(mocks.enviarNotificacion).toHaveBeenCalledWith({
                    texto,
                    usuarios: [USUARIO],
                    url: `${rutaMercado}?publicacion=${id}`,
                }, mocks.tx);
            }
        });

        it.each(estados)("un aviso existente de publicaciones $estado no bloquea a otra publicación con igual texto", async ({ fecha, texto, tipo }) => {
            comoRol(rol, [relacion(1, fecha), relacion(2, fecha)]);
            registrarAviso(1, tipo);

            await procesarVencimientosUsuario(USUARIO);

            expect(mocks.enviarNotificacion).toHaveBeenCalledOnce();
            expect(mocks.enviarNotificacion).toHaveBeenCalledWith({
                texto,
                usuarios: [USUARIO],
                url: `${rutaMercado}?publicacion=2`,
            }, mocks.tx);
        });

        it.each(estados)("no reenvía avisos de publicaciones $estado aunque la bandeja esté vacía", async ({ fecha, tipo }) => {
            comoRol(rol, [relacion(1, fecha)]);

            await procesarVencimientosUsuario(USUARIO);
            mocks.enviarNotificacion.mockClear();
            mocks.transaction.mockClear();
            mocks.query.mockClear();
            mocks.execute.mockClear();
            mocks.publicacionUpdate.mockClear();

            await procesarVencimientosUsuario(USUARIO);

            expect(publicacionesActuales.get(1)?.[tipo === "proximo" ? "avisoProximoVencimientoEn" : "avisoVencimientoEn"])
                .toEqual(AHORA);
            expect(mocks.enviarNotificacion).not.toHaveBeenCalled();
            expect(mocks.transaction).not.toHaveBeenCalled();
            expect(mocks.query).not.toHaveBeenCalled();
            expect(mocks.execute).not.toHaveBeenCalled();
            expect(mocks.publicacionUpdate).not.toHaveBeenCalled();
        });

        it.each(estados)("descarta publicaciones $estado ya avisadas sin abrir transacciones ni bloquear filas", async ({ fecha, tipo }) => {
            comoRol(rol, [relacion(1, fecha, false)]);
            registrarAviso(1, tipo);

            await procesarVencimientosUsuario(USUARIO);

            expect(mocks.transaction).not.toHaveBeenCalled();
            expect(mocks.query).not.toHaveBeenCalled();
            expect(mocks.execute).not.toHaveBeenCalled();
            expect(mocks.publicacionUpdate).not.toHaveBeenCalled();
            expect(mocks.enviarNotificacion).not.toHaveBeenCalled();
        });

        it.each(estados)("una nueva vigencia con los campos reiniciados permite un nuevo aviso de publicaciones $estado", async ({ fecha, tipo }) => {
            comoRol(rol, [relacion(1, fecha.subtract({ hours: 24 }))]);
            registrarAviso(1, tipo);
            comoRol(rol, [relacion(1, fecha)]);

            await procesarVencimientosUsuario(USUARIO);

            expect(mocks.enviarNotificacion).toHaveBeenCalledOnce();
            expect(publicacionesActuales.get(1)?.[tipo === "proximo" ? "avisoProximoVencimientoEn" : "avisoVencimientoEn"])
                .toEqual(AHORA);
        });

        it("el aviso próximo anterior no impide avisar que la publicación venció", async () => {
            comoRol(rol, [relacion(1, VENCIDA)]);
            registrarAviso(1, "proximo");

            await procesarVencimientosUsuario(USUARIO);

            expect(mocks.enviarNotificacion).toHaveBeenCalledWith({
                texto: textoVencida("2026-11-02"),
                usuarios: [USUARIO],
                url: `${rutaMercado}?publicacion=1`,
            }, mocks.tx);
        });

        it("volver a marcar disponible una publicación vencida no repite el aviso", async () => {
            comoRol(rol, [relacion(1, VENCIDA)]);
            registrarAviso(1, "vencido");

            await procesarVencimientosUsuario(USUARIO);

            expect(mocks.enviarNotificacion).not.toHaveBeenCalled();
            expect(mocks.transaction).toHaveBeenCalledOnce();
            expect(mocks.query).toHaveBeenCalledOnce();
            expect(mocks.publicacionUpdate).toHaveBeenCalledWith({ publicacionDisponible: false });
            expect(publicacionesActuales.get(1)?.avisoVencimientoEn).toEqual(AHORA);
        });
    });

    describe("consistencia de la transacción", () => {
        it.each([
            { fecha: PROXIMA, avisoProximoEnviado: true, avisoVencidoEnviado: false },
            { fecha: VENCIDA, avisoProximoEnviado: false, avisoVencidoEnviado: true },
        ])("revisa de nuevo el aviso al bloquear una candidata para evitar envíos concurrentes", async ({ fecha, ...avisos }) => {
            comoOperador([relacion(1, fecha)]);
            mocks.query.mockResolvedValueOnce([{ id: 1, publicacionDisponible: false, ...avisos }]);

            await procesarVencimientosUsuario(USUARIO);

            expect(mocks.transaction).toHaveBeenCalledOnce();
            expect(mocks.query).toHaveBeenCalledOnce();
            expect(mocks.enviarNotificacion).not.toHaveBeenCalled();
            expect(mocks.execute).not.toHaveBeenCalled();
        });

        it("no envía un aviso próximo si la publicación venció mientras esperaba el bloqueo", async () => {
            comoOperador([relacion(1, PROXIMA)]);
            mocks.query.mockImplementationOnce(async () => {
                vi.setSystemTime(new Date(PROXIMA.add({ seconds: 1 }).epochMilliseconds));
                return [{ id: 1, publicacionDisponible: true }];
            });

            await procesarVencimientosUsuario(USUARIO);

            expect(mocks.publicacionUpdate).not.toHaveBeenCalled();
            expect(mocks.enviarNotificacion).not.toHaveBeenCalled();
            expect(publicacionesActuales.get(1)?.avisoProximoVencimientoEn).toBeNull();
        });

        it.each(["eliminada", "renovada"])("ignora una publicación %s después de consultar el listado", async (cambio) => {
            comoOperador([relacion(1, VENCIDA)]);
            if (cambio === "eliminada") publicacionesActuales.delete(1);
            else relacion(1, PROXIMA);

            await procesarVencimientosUsuario(USUARIO);

            expect(mocks.publicacionUpdate).not.toHaveBeenCalled();
            expect(mocks.enviarNotificacion).not.toHaveBeenCalled();
        });

        it("usa la disponibilidad actual al bloquear la publicación", async () => {
            comoOperador([relacion(1, VENCIDA)]);
            relacion(1, VENCIDA, false);

            await procesarVencimientosUsuario(USUARIO);

            expect(mocks.publicacionUpdate).not.toHaveBeenCalled();
            expect(publicacionesActuales.get(1)?.avisoVencimientoEn).toEqual(AHORA);
            expect(mocks.enviarNotificacion).toHaveBeenCalledOnce();
        });

        it("propaga el error de envío para que la transacción revierta la marca", async () => {
            comoOperador([relacion(1, PROXIMA)]);
            const error = new Error("No se pudo guardar el aviso");
            mocks.enviarNotificacion.mockRejectedValue(error);

            await expect(procesarVencimientosUsuario(USUARIO)).rejects.toBe(error);

            expect(mocks.transaction).toHaveBeenCalledOnce();
            expect(mocks.enviarNotificacion).toHaveBeenCalledWith(expect.any(Object), mocks.tx);
            expect(publicacionesActuales.get(1)?.avisoProximoVencimientoEn).toBeNull();
        });

        it("no registra el aviso si no se creó ninguna notificación", async () => {
            comoProductor([relacion(1, PROXIMA)]);
            mocks.enviarNotificacion.mockResolvedValue({ enviadas: 0 });

            await procesarVencimientosUsuario(USUARIO);

            expect(mocks.publicacionUpdate).not.toHaveBeenCalled();
            expect(mocks.execute).not.toHaveBeenCalled();
            expect(publicacionesActuales.get(1)?.avisoProximoVencimientoEn).toBeNull();
        });

        it("conserva la marca cuando la notificación se envió", async () => {
            comoProductor([relacion(1, PROXIMA)]);

            await procesarVencimientosUsuario(USUARIO);

            expect(publicacionesActuales.get(1)?.avisoProximoVencimientoEn).toEqual(AHORA);
            expect(mocks.enviarNotificacion.mock.invocationCallOrder[0])
                .toBeLessThan(mocks.execute.mock.invocationCallOrder[0]);
        });
    });
});
