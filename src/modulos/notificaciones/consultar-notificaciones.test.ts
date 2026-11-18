import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DatosSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { consultarNotificaciones, contarNotificacionesNoLeidas } from "./notificaciones";

const mocks = vi.hoisted(() => ({ where: vi.fn(), orderBy: vi.fn(), all: vi.fn(), aggregate: vi.fn(), transaction: vi.fn() }));
vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
    db: { transaction: mocks.transaction, orm: { public: { Notificacion: { where: mocks.where } } } },
}));

beforeEach(() => {
    vi.resetAllMocks();
    mocks.where.mockReturnValue({ orderBy: mocks.orderBy, aggregate: mocks.aggregate });
    mocks.orderBy.mockReturnValue({ all: mocks.all });
});

describe("lectura de notificaciones independiente del procesamiento de vencimientos", () => {
    it.each(["OPERADOR", "PRODUCTOR", "ADMINISTRADOR"] as const)("consulta los avisos existentes de %s sin modificar publicaciones", async (rol) => {
        const sesion: DatosSesion = { usuarioId: 12, rol, expiraEn: 2147483647 };
        mocks.all.mockResolvedValue([
            { id: 1, descripcion: "Aviso guardado por la tarea diaria", titulo: "Notificación", url: "/notificaciones", vista: false, fecha: "2026-11-17T03:00:00Z" },
            { id: 2, descripcion: "Aviso leído", titulo: "Notificación", url: null, vista: true, fecha: "2026-11-16T03:00:00Z" },
        ]);

        const resultado = await consultarNotificaciones(sesion);

        expect(resultado.noLeidas).toBe(1);
        expect(resultado.notificaciones.map(({ id, leida }) => ({ id, leida }))).toEqual([{ id: 1, leida: false }, { id: 2, leida: true }]);
        expect(mocks.where).toHaveBeenCalledExactlyOnceWith({ usuarioId: 12 });
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it.each(["OPERADOR", "PRODUCTOR", "ADMINISTRADOR"] as const)("el contador de %s puede leer sin acceder a publicaciones ni configuración", async (rol) => {
        const sesion: DatosSesion = { usuarioId: 12, rol, expiraEn: 2147483647 };
        mocks.aggregate.mockResolvedValue({ noLeidas: 3 });

        await expect(contarNotificacionesNoLeidas(sesion)).resolves.toBe(3);

        expect(mocks.where).toHaveBeenCalledExactlyOnceWith({ usuarioId: 12, vista: false });
        expect(mocks.transaction).not.toHaveBeenCalled();
    });
});
