import { beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerProductorActual } from "./productor-actual";

const mocks = vi.hoisted(() => ({
    obtenerSesion: vi.fn(),
    select: vi.fn(),
    where: vi.fn(),
    first: vi.fn(),
}));

vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({ obtenerSesion: mocks.obtenerSesion }));
vi.mock("../../../infraestructura/persistencia/prisma/db", () => ({
    db: { orm: { public: { Productor: { select: mocks.select } } } },
}));

describe("productor autenticado de Mi Mercado", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.select.mockReturnValue({ where: mocks.where });
        mocks.where.mockReturnValue({ first: mocks.first });
        mocks.obtenerSesion.mockResolvedValue({ usuarioId: 10, rol: "PRODUCTOR", expiraEn: 2000000000 });
    });

    it("obtiene el perfil asociado al usuario de la sesión", async () => {
        const productor = { id: 23, usuarioId: 10, nombreFantasia: "Mi quinta" };
        mocks.first.mockResolvedValue(productor);

        await expect(obtenerProductorActual()).resolves.toBe(productor);
        expect(mocks.where).toHaveBeenCalledExactlyOnceWith({ usuarioId: 10 });
        expect(mocks.obtenerSesion).toHaveBeenCalledOnce();
    });

    it.each([null, "OPERADOR", "ADMINISTRADOR"] as const)("rechaza el acceso de %s antes de consultar perfiles", async (rol) => {
        mocks.obtenerSesion.mockResolvedValue(rol === null ? null : { usuarioId: 10, rol, expiraEn: 2000000000 });

        await expect(obtenerProductorActual()).rejects.toMatchObject({ status: rol === null ? 401 : 403 });
        expect(mocks.select).not.toHaveBeenCalled();
    });

    it("no elige otro productor cuando la sesión no tiene un perfil asociado", async () => {
        mocks.first.mockResolvedValue(null);

        await expect(obtenerProductorActual()).rejects.toThrow("No se encontró ningún productor de Mi Mercado.");
        expect(mocks.where).toHaveBeenCalledExactlyOnceWith({ usuarioId: 10 });
    });
});
