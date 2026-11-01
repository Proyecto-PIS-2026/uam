import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { cookies } from "next/headers";
import { db } from "@/infraestructura/persistencia/prisma/db";

vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({
    obtenerSesion: vi.fn(),
}));

vi.mock("next/headers", () => ({
    cookies: vi.fn(),
}));

vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
    db: {
        orm: {
            public: {
                EstadisticaVisita: { where: vi.fn(), create: vi.fn() },
            },
        },
    },
}));

describe("GET /api/estadisticas/visitas", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("debería omitir el conteo si hay una sesión activa", async () => {
        vi.mocked(obtenerSesion).mockResolvedValueOnce({ rol: "OPERADOR" } as unknown as Awaited<ReturnType<typeof obtenerSesion>>);

        const res = await GET();
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data).toEqual({ ok: true, omitido: true });
    });

    it("debería omitir el conteo si ya existe la cookie de visita del día", async () => {
        vi.mocked(obtenerSesion).mockResolvedValueOnce(null);
        const mockCookieStore = {
            get: vi.fn().mockReturnValue({ value: "1" }),
        };
        vi.mocked(cookies).mockResolvedValueOnce(mockCookieStore as unknown as Awaited<ReturnType<typeof cookies>>);

        const res = await GET();
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data).toEqual({ ok: true, registrado: false });
    });

    it("debería actualizar la cantidad si ya existe registro en la base de datos para hoy", async () => {
        vi.mocked(obtenerSesion).mockResolvedValueOnce(null);
        const mockCookieStore = {
            get: vi.fn().mockReturnValue(undefined),
        };
        vi.mocked(cookies).mockResolvedValueOnce(mockCookieStore as unknown as Awaited<ReturnType<typeof cookies>>);

        const mockEstadisticaWhere = {
            where: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue({ id: 1, cantidad: 10 }),
            update: vi.fn().mockResolvedValue({}),
        };
        vi.mocked(db.orm.public.EstadisticaVisita.where).mockReturnValue(mockEstadisticaWhere as unknown as ReturnType<typeof db.orm.public.EstadisticaVisita.where>);

        const res = await GET();
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data).toEqual({ ok: true, registrado: true });
        expect(mockEstadisticaWhere.update).toHaveBeenCalledWith({ cantidad: 11 });
    });

    it("debería crear el registro si no existe en la base de datos para hoy", async () => {
        vi.mocked(obtenerSesion).mockResolvedValueOnce(null);
        const mockCookieStore = {
            get: vi.fn().mockReturnValue(undefined),
        };
        vi.mocked(cookies).mockResolvedValueOnce(mockCookieStore as unknown as Awaited<ReturnType<typeof cookies>>);

        const mockEstadisticaWhere = {
            where: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue(null),
        };
        vi.mocked(db.orm.public.EstadisticaVisita.where).mockReturnValue(mockEstadisticaWhere as unknown as ReturnType<typeof db.orm.public.EstadisticaVisita.where>);
        vi.mocked(db.orm.public.EstadisticaVisita.create).mockResolvedValue({} as unknown as Awaited<ReturnType<typeof db.orm.public.EstadisticaVisita.create>>);

        const res = await GET();
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data).toEqual({ ok: true, registrado: true });
        expect(db.orm.public.EstadisticaVisita.create).toHaveBeenCalled();
    });

    it("debería retornar 500 si ocurre un error interno", async () => {
        vi.mocked(obtenerSesion).mockRejectedValueOnce(new Error("Error DB"));

        const res = await GET();
        const data = await res.json();

        expect(res.status).toBe(500);
        expect(data).toEqual({ error: "Error interno" });
    });
});