import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { db } from "@/infraestructura/persistencia/prisma/db";

const registrarEstadisticaMock = vi.hoisted(() => vi.fn());
vi.mock("@/modulos/administracion/estadisticas/registrar-estadisticas", () => ({
    registrarContacto: registrarEstadisticaMock,
    obtenerFechaEstadistica: () => "2026-11-06",
}));

vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({
    obtenerSesion: vi.fn(),
}));

vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
    db: {
        orm: {
            public: {
                Operador: { where: vi.fn() },
                Productor: { where: vi.fn() },
                Usuario: { select: vi.fn() },
                EstadisticaContacto: { where: vi.fn(), create: vi.fn() },
            },
        },
    },
}));

describe("POST /api/estadisticas/whatsapp", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    registrarEstadisticaMock.mockReset().mockResolvedValue(undefined);
    });

    it("debería omitir el registro si el usuario es administrador", async () => {
        vi.mocked(obtenerSesion).mockResolvedValueOnce({ rol: "ADMINISTRADOR" } as unknown as Awaited<ReturnType<typeof obtenerSesion>>);
        const req = new Request("http://localhost/api/estadisticas/whatsapp", {
            method: "POST",
            body: JSON.stringify({ tipo: "OPERADOR", entidadId: 1 }),
        });

        const res = await POST(req);
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data).toEqual({ ok: true });
    });

    it("debería retornar 400 si faltan datos en el body", async () => {
        vi.mocked(obtenerSesion).mockResolvedValueOnce(null);
        const req = new Request("http://localhost/api/estadisticas/whatsapp", {
            method: "POST",
            body: JSON.stringify({ tipo: "OPERADOR" }),
        });

        const res = await POST(req);
        const data = await res.json();
        expect(res.status).toBe(400);
        expect(data).toEqual({ error: "Datos inválidos" });
    });

    it("debería retornar 404 si la entidad no tiene usuarioId (Operador)", async () => {
        vi.mocked(obtenerSesion).mockResolvedValueOnce(null);
        const mockWhere = {
            select: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue(null),
        };
        vi.mocked(db.orm.public.Operador.where).mockReturnValue(mockWhere as unknown as ReturnType<typeof db.orm.public.Operador.where>);

        const req = new Request("http://localhost/api/estadisticas/whatsapp", {
            method: "POST",
            body: JSON.stringify({ tipo: "OPERADOR", entidadId: 99 }),
        });

        const res = await POST(req);
        const data = await res.json();
        expect(res.status).toBe(404);
        expect(data).toEqual({ error: "Entidad no encontrada" });
    });

    it("debería retornar 404 si la entidad no tiene usuarioId (Productor)", async () => {
        vi.mocked(obtenerSesion).mockResolvedValueOnce(null);
        const mockWhere = {
            select: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue(null),
        };
        vi.mocked(db.orm.public.Productor.where).mockReturnValue(mockWhere as unknown as ReturnType<typeof db.orm.public.Productor.where>);

        const req = new Request("http://localhost/api/estadisticas/whatsapp", {
            method: "POST",
            body: JSON.stringify({ tipo: "PRODUCTOR", entidadId: 99 }),
        });

        const res = await POST(req);
        const data = await res.json();
        expect(res.status).toBe(404);
        expect(data).toEqual({ error: "Entidad no encontrada" });
    });

    it("debería actualizar la estadística de contacto existente si ya existe para hoy (Operador)", async () => {
        vi.mocked(obtenerSesion).mockResolvedValueOnce(null);
        
        const mockOperadorWhere = {
            select: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue({ usuarioId: 10 }),
        };
        vi.mocked(db.orm.public.Operador.where).mockReturnValue(mockOperadorWhere as unknown as ReturnType<typeof db.orm.public.Operador.where>);

        const mockUsuarioWhere = {
            select: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue({ username: "operador1" }),
        };
        vi.mocked(db.orm.public.Usuario.select).mockReturnValue(mockUsuarioWhere as unknown as ReturnType<typeof db.orm.public.Usuario.select>);

        const mockEstadisticaWhere = {
            where: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue({ id: 1, cantidad: 5 }),
            update: vi.fn().mockResolvedValue({}),
        };
        vi.mocked(db.orm.public.EstadisticaContacto.where).mockReturnValue(mockEstadisticaWhere as unknown as ReturnType<typeof db.orm.public.EstadisticaContacto.where>);

        const req = new Request("http://localhost/api/estadisticas/whatsapp", {
            method: "POST",
            body: JSON.stringify({ tipo: "OPERADOR", entidadId: 1 }),
        });

        const res = await POST(req);
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data).toEqual({ ok: true });
        expect(registrarEstadisticaMock).toHaveBeenCalledExactlyOnceWith("operador1");
    });

    it("debería crear la estadística de contacto si no existe para hoy (Productor)", async () => {
        vi.mocked(obtenerSesion).mockResolvedValueOnce(null);
        
        const mockProductorWhere = {
            select: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue({ usuarioId: 20 }),
        };
        vi.mocked(db.orm.public.Productor.where).mockReturnValue(mockProductorWhere as unknown as ReturnType<typeof db.orm.public.Productor.where>);

        const mockUsuarioWhere = {
            select: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue({ username: "productor1" }),
        };
        vi.mocked(db.orm.public.Usuario.select).mockReturnValue(mockUsuarioWhere as unknown as ReturnType<typeof db.orm.public.Usuario.select>);

        const mockEstadisticaWhere = {
            where: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue(null),
        };
        vi.mocked(db.orm.public.EstadisticaContacto.where).mockReturnValue(mockEstadisticaWhere as unknown as ReturnType<typeof db.orm.public.EstadisticaContacto.where>);
        vi.mocked(db.orm.public.EstadisticaContacto.create).mockResolvedValue({} as unknown as Awaited<ReturnType<typeof db.orm.public.EstadisticaContacto.create>>);

        const req = new Request("http://localhost/api/estadisticas/whatsapp", {
            method: "POST",
            body: JSON.stringify({ tipo: "PRODUCTOR", entidadId: 2 }),
        });

        const res = await POST(req);
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data).toEqual({ ok: true });
        expect(registrarEstadisticaMock).toHaveBeenCalledExactlyOnceWith("productor1");
    });

    it("debería retornar 500 si ocurre un error interno", async () => {
        vi.mocked(obtenerSesion).mockRejectedValueOnce(new Error("DB Error"));

        const req = new Request("http://localhost/api/estadisticas/whatsapp", {
            method: "POST",
            body: JSON.stringify({ tipo: "OPERADOR", entidadId: 1 }),
        });

        const res = await POST(req);
        const data = await res.json();
        expect(res.status).toBe(500);
        expect(data).toEqual({ error: "Error interno" });
    });
});