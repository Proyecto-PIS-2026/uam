import "temporal-polyfill/full/global";
import "temporal-polyfill/types/global";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";
import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";

const mocks = vi.hoisted(() => {
    const consulta = () => {
        const builder = {
            where: vi.fn(),
            select: vi.fn(),
            include: vi.fn(),
            first: vi.fn(),
            update: vi.fn(),
            create: vi.fn(),
        };

        builder.where.mockReturnValue(builder);
        builder.select.mockReturnValue(builder);
        builder.include.mockImplementation((_nombre, callback) => {
            callback?.(builder);
            return builder;
        });

        return builder;
    };

    return {
        operador: consulta(),
        productor: consulta(),
        usuario: consulta(),
        publicacionOperador: consulta(),
        publicacionProductor: consulta(),
        publicacion: consulta(),
        estadisticaContacto: consulta(),
        estadisticaContactoPublicacion: consulta(),
    };
});

const registrarEstadisticaMock = vi.hoisted(() => vi.fn());

vi.mock("@/modulos/administracion/estadisticas/registrar-estadisticas", () => ({
    registrarContacto: registrarEstadisticaMock,
}));

vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({
    obtenerSesion: vi.fn(),
}));

vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
    db: {
        orm: {
            public: {
                Operador: mocks.operador,
                Productor: mocks.productor,
                Usuario: mocks.usuario,
                PublicacionOperador: mocks.publicacionOperador,
                PublicacionProductor: mocks.publicacionProductor,
                Publicacion: mocks.publicacion,
                EstadisticaContacto: mocks.estadisticaContacto,
                EstadisticaContactoPublicacion: mocks.estadisticaContactoPublicacion,
            },
        },
    },
}));

function crearRequest(body: unknown) {
    return new Request("http://localhost/api/estadisticas/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

function configurarUsuario(
    tipo: "OPERADOR" | "PRODUCTOR",
    usuarioId: number,
    username: string,
) {
    const entidad = tipo === "OPERADOR" ? mocks.operador : mocks.productor;

    entidad.first.mockResolvedValue({ usuarioId });
    mocks.usuario.first.mockResolvedValue({ username });
}

describe("POST /api/estadisticas/whatsapp", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-11-06T15:00:00Z"));

        vi.mocked(obtenerSesion).mockResolvedValue(null);

        mocks.operador.first.mockResolvedValue(null);
        mocks.productor.first.mockResolvedValue(null);
        mocks.usuario.first.mockResolvedValue(null);

        mocks.publicacionOperador.first.mockResolvedValue(null);
        mocks.publicacionProductor.first.mockResolvedValue(null);
        mocks.publicacion.first.mockResolvedValue(null);

        mocks.estadisticaContacto.first.mockResolvedValue(null);
        mocks.estadisticaContactoPublicacion.first.mockResolvedValue(null);

        registrarEstadisticaMock.mockReset().mockResolvedValue(undefined);
    });

    afterEach(() => vi.useRealTimers());

    it("omite el registro si el usuario es administrador", async () => {
        vi.mocked(obtenerSesion).mockResolvedValueOnce({
            rol: "ADMINISTRADOR",
        } as unknown as Awaited<ReturnType<typeof obtenerSesion>>);

        const res = await POST(crearRequest({
            tipo: "OPERADOR",
            entidadId: 1,
        }));

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ ok: true });

        expect(mocks.operador.where).not.toHaveBeenCalled();
        expect(registrarEstadisticaMock).not.toHaveBeenCalled();
        expect(mocks.estadisticaContacto.create).not.toHaveBeenCalled();
        expect(mocks.estadisticaContactoPublicacion.create).not.toHaveBeenCalled();
    });

    it.each([
        { tipo: "OPERADOR" },
        { tipo: "INVALIDO", entidadId: 1 },
        { tipo: "OPERADOR", entidadId: 0 },
        { tipo: "OPERADOR", entidadId: -1 },
        { tipo: "OPERADOR", entidadId: 1.5 },
        { tipo: "OPERADOR", entidadId: 1, publicacionId: 0 },
        { tipo: "OPERADOR", entidadId: 1, publicacionId: -1 },
        { tipo: "OPERADOR", entidadId: 1, publicacionId: 1.5 },
    ])("retorna 400 si los datos son inválidos: %o", async (body) => {
        const res = await POST(crearRequest(body));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "Datos inválidos" });

        expect(registrarEstadisticaMock).not.toHaveBeenCalled();
    });

    it("retorna 404 si el operador no tiene usuario asociado", async () => {
        const res = await POST(crearRequest({
            tipo: "OPERADOR",
            entidadId: 99,
        }));

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: "Entidad no encontrada" });

        expect(registrarEstadisticaMock).not.toHaveBeenCalled();
    });

    it("retorna 404 si el productor no tiene usuario asociado", async () => {
        const res = await POST(crearRequest({
            tipo: "PRODUCTOR",
            entidadId: 99,
        }));

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: "Entidad no encontrada" });

        expect(registrarEstadisticaMock).not.toHaveBeenCalled();
    });

    describe("contactos desde el perfil", () => {
        it("registra el contacto general para un operador", async () => {
            configurarUsuario("OPERADOR", 10, "operador1");

            const res = await POST(crearRequest({
                tipo: "OPERADOR",
                entidadId: 1,
            }));

            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ ok: true });

            expect(registrarEstadisticaMock).toHaveBeenCalledExactlyOnceWith("operador1", "2026-11-06");

            expect(mocks.publicacionOperador.where).not.toHaveBeenCalled();
            expect(mocks.publicacionProductor.where).not.toHaveBeenCalled();
            expect(mocks.estadisticaContactoPublicacion.create).not.toHaveBeenCalled();
            expect(mocks.estadisticaContactoPublicacion.update).not.toHaveBeenCalled();
        });

        it("registra el contacto general para un productor", async () => {
            configurarUsuario("PRODUCTOR", 20, "productor1");

            const res = await POST(crearRequest({
                tipo: "PRODUCTOR",
                entidadId: 2,
            }));

            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ ok: true });

            expect(registrarEstadisticaMock).toHaveBeenCalledExactlyOnceWith("productor1", "2026-11-06");

            expect(mocks.publicacionOperador.where).not.toHaveBeenCalled();
            expect(mocks.publicacionProductor.where).not.toHaveBeenCalled();
            expect(mocks.estadisticaContactoPublicacion.create).not.toHaveBeenCalled();
            expect(mocks.estadisticaContactoPublicacion.update).not.toHaveBeenCalled();
        });
    });

    describe("contactos desde el drawer de una publicación", () => {
        it.each([
            { tipo: "OPERADOR" as const, instante: "2026-11-13T00:00:00Z", dia: "2026-11-12" },
            { tipo: "PRODUCTOR" as const, instante: "2026-11-13T02:59:59Z", dia: "2026-11-12" },
            { tipo: "OPERADOR" as const, instante: "2026-11-13T03:00:00Z", dia: "2026-11-13" },
            { tipo: "PRODUCTOR" as const, instante: "2026-11-13T15:00:00Z", dia: "2026-11-13" },
        ])("registra ambos contactos de $tipo a las $instante en el día uruguayo $dia", async ({ tipo, instante, dia }) => {
            vi.setSystemTime(new Date(instante));
            configurarUsuario(tipo, 10, "usuario1");
            mocks.publicacionOperador.first.mockResolvedValue({ publicacionId: 20 });
            mocks.publicacionProductor.first.mockResolvedValue({ publicacionId: 20 });
            mocks.publicacion.first.mockResolvedValue({ especie: { nombreEspecie: "Tomate" } });

            const res = await POST(crearRequest({ tipo, entidadId: 1, publicacionId: 20 }));

            expect(res.status).toBe(200);
            expect(mocks.estadisticaContactoPublicacion.where.mock.calls[0][0].fecha.toString()).toBe(`${dia}T00:00:00Z`);
            expect(mocks.estadisticaContactoPublicacion.create.mock.calls[0][0].fecha.toString()).toBe(`${dia}T00:00:00Z`);
            expect(registrarEstadisticaMock).toHaveBeenCalledExactlyOnceWith("usuario1", dia);
        });

        it("conserva el mismo día para ambos conteos si la operación cruza medianoche", async () => {
            vi.setSystemTime(new Date("2026-11-13T02:59:59Z"));
            configurarUsuario("OPERADOR", 10, "operador1");
            mocks.publicacionOperador.first.mockResolvedValue({ publicacionId: 20 });
            mocks.publicacion.first.mockResolvedValue({ especie: { nombreEspecie: "Tomate" } });
            mocks.estadisticaContactoPublicacion.create.mockImplementationOnce(async () => {
                vi.setSystemTime(new Date("2026-11-13T03:00:01Z"));
            });

            const res = await POST(crearRequest({ tipo: "OPERADOR", entidadId: 1, publicacionId: 20 }));

            expect(res.status).toBe(200);
            expect(mocks.estadisticaContactoPublicacion.create.mock.calls[0][0].fecha.toString()).toBe("2026-11-12T00:00:00Z");
            expect(registrarEstadisticaMock).toHaveBeenCalledExactlyOnceWith("operador1", "2026-11-12");
        });

        it("incrementa la estadística existente por especie para un operador", async () => {
            configurarUsuario("OPERADOR", 10, "operador1");

            mocks.publicacionOperador.first.mockResolvedValue({
                id: 1,
                operadorId: 1,
                publicacionId: 20,
            });

            mocks.publicacion.first.mockResolvedValue({
                especie: {
                    nombreEspecie: "Tomate",
                },
            });

            mocks.estadisticaContactoPublicacion.first.mockResolvedValue({
                id: 5,
                cantidad: 3,
            });

            const res = await POST(crearRequest({
                tipo: "OPERADOR",
                entidadId: 1,
                publicacionId: 20,
            }));

            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ ok: true });

            expect(mocks.publicacionOperador.where).toHaveBeenCalledWith({
                operadorId: 1,
                publicacionId: 20,
            });

            expect(mocks.estadisticaContactoPublicacion.where).toHaveBeenCalledWith(
                expect.objectContaining({
                    username: "operador1",
                    especie: "Tomate",
                    fecha: expect.anything(),
                }),
            );

            expect(mocks.estadisticaContactoPublicacion.update).toHaveBeenCalledWith({
                cantidad: 4,
            });

            expect(registrarEstadisticaMock).toHaveBeenCalledExactlyOnceWith("operador1", "2026-11-06");

            expect(mocks.estadisticaContacto.create).not.toHaveBeenCalled();
            expect(mocks.estadisticaContacto.update).not.toHaveBeenCalled();
        });

        it("crea la estadística por especie para un productor si todavía no existe", async () => {
            configurarUsuario("PRODUCTOR", 20, "productor1");

            mocks.publicacionProductor.first.mockResolvedValue({
                publicacionId: 30,
                productorId: 2,
            });

            mocks.publicacion.first.mockResolvedValue({
                especie: {
                    nombreEspecie: "Manzana",
                },
            });

            const res = await POST(crearRequest({
                tipo: "PRODUCTOR",
                entidadId: 2,
                publicacionId: 30,
            }));

            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ ok: true });

            expect(mocks.publicacionProductor.where).toHaveBeenCalledWith({
                publicacionId: 30,
            });

            expect(mocks.estadisticaContactoPublicacion.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    username: "productor1",
                    especie: "Manzana",
                    cantidad: 1,
                    fecha: expect.anything(),
                }),
            );

            expect(registrarEstadisticaMock).toHaveBeenCalledExactlyOnceWith("productor1", "2026-11-06");

            expect(mocks.estadisticaContacto.create).not.toHaveBeenCalled();
            expect(mocks.estadisticaContacto.update).not.toHaveBeenCalled();
        });

        it("retorna 404 si la publicación no pertenece al operador", async () => {
            configurarUsuario("OPERADOR", 10, "operador1");

            mocks.publicacionOperador.first.mockResolvedValue(null);

            const res = await POST(crearRequest({
                tipo: "OPERADOR",
                entidadId: 1,
                publicacionId: 20,
            }));

            expect(res.status).toBe(404);
            expect(await res.json()).toEqual({
                error: "La publicación no pertenece a la entidad seleccionada",
            });

            expect(mocks.publicacion.first).not.toHaveBeenCalled();
            expect(mocks.estadisticaContactoPublicacion.create).not.toHaveBeenCalled();
            expect(registrarEstadisticaMock).not.toHaveBeenCalled();
        });

        it("retorna 404 si la publicación no pertenece al productor", async () => {
            configurarUsuario("PRODUCTOR", 20, "productor1");

            mocks.publicacionProductor.first.mockResolvedValue(null);

            const res = await POST(crearRequest({
                tipo: "PRODUCTOR",
                entidadId: 2,
                publicacionId: 30,
            }));

            expect(res.status).toBe(404);
            expect(await res.json()).toEqual({
                error: "La publicación no pertenece a la entidad seleccionada",
            });

            expect(mocks.publicacion.first).not.toHaveBeenCalled();
            expect(mocks.estadisticaContactoPublicacion.create).not.toHaveBeenCalled();
            expect(registrarEstadisticaMock).not.toHaveBeenCalled();
        });

        it("retorna 404 si la publicación no tiene una especie asociada", async () => {
            configurarUsuario("OPERADOR", 10, "operador1");

            mocks.publicacionOperador.first.mockResolvedValue({
                id: 1,
                operadorId: 1,
                publicacionId: 20,
            });

            mocks.publicacion.first.mockResolvedValue({
                especie: null,
            });

            const res = await POST(crearRequest({
                tipo: "OPERADOR",
                entidadId: 1,
                publicacionId: 20,
            }));

            expect(res.status).toBe(404);
            expect(await res.json()).toEqual({
                error: "No se encontró la especie de la publicación",
            });

            expect(mocks.estadisticaContactoPublicacion.create).not.toHaveBeenCalled();
            expect(registrarEstadisticaMock).not.toHaveBeenCalled();
        });
    });

    it("retorna 500 si ocurre un error interno", async () => {
        vi.mocked(obtenerSesion).mockRejectedValueOnce(new Error("DB Error"));

        const res = await POST(crearRequest({
            tipo: "OPERADOR",
            entidadId: 1,
        }));

        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({ error: "Error interno" });

        expect(registrarEstadisticaMock).not.toHaveBeenCalled();
    });
});
