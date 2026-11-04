import { describe, it, expect, vi, beforeEach } from "vitest";
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

        vi.mocked(obtenerSesion).mockResolvedValue(null);

        mocks.operador.first.mockResolvedValue(null);
        mocks.productor.first.mockResolvedValue(null);
        mocks.usuario.first.mockResolvedValue(null);

        mocks.publicacionOperador.first.mockResolvedValue(null);
        mocks.publicacionProductor.first.mockResolvedValue(null);
        mocks.publicacion.first.mockResolvedValue(null);

        mocks.estadisticaContacto.first.mockResolvedValue(null);
        mocks.estadisticaContactoPublicacion.first.mockResolvedValue(null);
    });

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
    });

    it("retorna 404 si el operador no tiene usuario asociado", async () => {
        const res = await POST(crearRequest({
            tipo: "OPERADOR",
            entidadId: 99,
        }));

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: "Entidad no encontrada" });
    });

    it("retorna 404 si el productor no tiene usuario asociado", async () => {
        const res = await POST(crearRequest({
            tipo: "PRODUCTOR",
            entidadId: 99,
        }));

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: "Entidad no encontrada" });
    });

    describe("contactos desde el perfil", () => {
        it("incrementa la estadística de contacto existente para un operador", async () => {
            configurarUsuario("OPERADOR", 10, "operador1");

            mocks.estadisticaContacto.first.mockResolvedValue({
                id: 1,
                cantidad: 5,
            });

            const res = await POST(crearRequest({
                tipo: "OPERADOR",
                entidadId: 1,
            }));

            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ ok: true });

            expect(mocks.estadisticaContacto.update).toHaveBeenCalledWith({
                cantidad: 6,
            });

            expect(mocks.estadisticaContactoPublicacion.first).not.toHaveBeenCalled();
            expect(mocks.estadisticaContactoPublicacion.create).not.toHaveBeenCalled();
        });

        it("crea la estadística de contacto para un productor si todavía no existe", async () => {
            configurarUsuario("PRODUCTOR", 20, "productor1");

            const res = await POST(crearRequest({
                tipo: "PRODUCTOR",
                entidadId: 2,
            }));

            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ ok: true });

            expect(mocks.estadisticaContacto.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    username: "productor1",
                    cantidad: 1,
                    fecha: expect.anything(),
                }),
            );

            expect(mocks.estadisticaContactoPublicacion.create).not.toHaveBeenCalled();
        });
    });

    describe("contactos desde el drawer de una publicación", () => {
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

            expect(mocks.estadisticaContactoPublicacion.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    username: "productor1",
                    especie: "Manzana",
                    cantidad: 1,
                    fecha: expect.anything(),
                }),
            );

            expect(mocks.estadisticaContacto.create).not.toHaveBeenCalled();
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
    });
});