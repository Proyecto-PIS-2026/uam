import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Temporal } from "temporal-polyfill";
import { procesarVencimientosUsuario } from "./procesar-vencimientos";

const mocks = vi.hoisted(() => ({
    configFirst: vi.fn(),
    operadorFirst: vi.fn(),
    productorFirst: vi.fn(),
    publicacionesOperador: vi.fn(),
    publicacionesProductor: vi.fn(),
    notificacionesExistentes: vi.fn(),
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

    return {
        db: {
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
                    Notificacion: { where: () => consulta({ all: () => mocks.notificacionesExistentes() }) },
                    Publicacion: {
                        where: (filtro: unknown) => {
                            mocks.publicacionWhere(filtro);
                            return { update: mocks.publicacionUpdate };
                        },
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

const NOMBRE_AVISO = "aviso_vencimiento_publicaciones_productor_habilitado";

function configurar({ aviso = "true", dias = "7" }: { aviso?: string | null; dias?: string | null } = {}) {
    mocks.configFirst.mockImplementation(async (nombre: string) => {
        const valor = nombre === NOMBRE_AVISO ? aviso : dias;
        return valor === null ? null : { valorConfiguracion: valor };
    });
}

function relacion(id: number, fechaVigencia: Temporal.Instant | null, disponible = true, especie = "Tomate") {
    return {
        publicacion: {
            id,
            fechaVigencia,
            publicacionDisponible: disponible,
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

const textoVencida = (id: number, fecha: string, especie = "Tomate") =>
    `Tu publicación de ${especie} (ID #${id}) ha vencido el ${fecha} y ya no está disponible.`;

const textoAviso = (id: number, fecha: string, especie = "Tomate") =>
    `Tu publicación de ${especie} (ID #${id}) está próxima a vencer el ${fecha}.`;

describe("procesarVencimientosUsuario", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date(AHORA.epochMilliseconds));

        configurar();
        mocks.operadorFirst.mockResolvedValue(null);
        mocks.productorFirst.mockResolvedValue(null);
        mocks.publicacionesOperador.mockResolvedValue([]);
        mocks.publicacionesProductor.mockResolvedValue([]);
        mocks.notificacionesExistentes.mockResolvedValue([]);
        mocks.publicacionUpdate.mockResolvedValue(undefined);
        mocks.enviarNotificacion.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe("validación y rol del usuario", () => {
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

            expect(mocks.notificacionesExistentes).not.toHaveBeenCalled();
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
                    texto: textoVencida(1, "2026-11-02"),
                    usuarios: [USUARIO],
                    url: rol === "operador" ? "/mi-mercado?publicacion=1" : "/mi-mercado/productor?publicacion=1",
                });
            }
        );

        it("notifica una vencida que ya estaba no disponible sin volver a actualizarla", async () => {
            comoOperador([relacion(1, VENCIDA, false)]);

            await procesarVencimientosUsuario(USUARIO);

            expect(mocks.publicacionUpdate).not.toHaveBeenCalled();
            expect(mocks.enviarNotificacion).toHaveBeenCalledOnce();
        });

        it("no repite la notificación de vencida si ya fue enviada", async () => {
            comoOperador([relacion(1, VENCIDA, false)]);
            mocks.notificacionesExistentes.mockResolvedValue([{ descripcion: textoVencida(1, "2026-11-02") }]);

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
                expect(mocks.enviarNotificacion).toHaveBeenCalledOnce();
                expect(mocks.enviarNotificacion).toHaveBeenCalledWith({
                    texto: textoAviso(1, "2026-11-06"),
                    usuarios: [USUARIO],
                    url: rol === "operador" ? "/mi-mercado?publicacion=1" : "/mi-mercado/productor?publicacion=1",
                });
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
                expect.objectContaining({ texto: expect.stringContaining("ID #1") })
            );
        });

        it("no repite el aviso si ya fue enviado", async () => {
            comoOperador([relacion(1, PROXIMA)]);
            mocks.notificacionesExistentes.mockResolvedValue([{ descripcion: textoAviso(1, "2026-11-06") }]);

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

            expect(mocks.publicacionWhere).toHaveBeenCalledTimes(1);
            expect(mocks.publicacionWhere).toHaveBeenCalledWith({ id: 1 });
            expect(mocks.enviarNotificacion).toHaveBeenCalledTimes(2);
            expect(mocks.enviarNotificacion).toHaveBeenCalledWith(
                expect.objectContaining({ texto: textoVencida(1, "2026-11-02") })
            );
            expect(mocks.enviarNotificacion).toHaveBeenCalledWith(
                expect.objectContaining({ texto: textoAviso(2, "2026-11-06", "Manzana") })
            );
        });
    });
});
