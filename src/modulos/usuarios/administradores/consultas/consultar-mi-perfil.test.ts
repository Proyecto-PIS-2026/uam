import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
    const first = vi.fn();
    const where = vi.fn(() => ({ first }));
    const include = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ include }));
    return { select, include, where, first };
});

vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
    db: { orm: { public: { Administrador: { select: mocks.select } } } },
}));

import { consultarMiPerfilAdministrador } from "./consultar-mi-perfil";

describe("BP-11.1: consulta del perfil propio del administrador", () => {
    beforeEach(() => vi.clearAllMocks());

    it("consulta por usuarioId y selecciona únicamente los datos permitidos", async () => {
        mocks.first.mockResolvedValue({ email: "admin@uam.com", usuario: { username: "admin" } });
        expect(await consultarMiPerfilAdministrador(15)).toEqual({ nombre: "admin", correo: "admin@uam.com" });
        expect(mocks.select).toHaveBeenCalledExactlyOnceWith("email");
        expect(mocks.include).toHaveBeenCalledOnce();
        expect(mocks.where).toHaveBeenCalledExactlyOnceWith({ usuarioId: 15 });
    });

    it("no devuelve contraseña ni secretos de 2FA aunque se encuentren en la consulta simulada", async () => {
        mocks.first.mockResolvedValue({ email: "admin@uam.com", usuario: { username: "admin", passwordHash: "secreto", twoFactorSecret: "secreto2", twoFactorEnabled: true } });
        const perfil = await consultarMiPerfilAdministrador(15);
        expect(perfil).toEqual({ nombre: "admin", correo: "admin@uam.com" });
        expect(perfil).not.toHaveProperty("passwordHash");
        expect(perfil).not.toHaveProperty("twoFactorSecret");
        expect(perfil).not.toHaveProperty("twoFactorEnabled");
    });

    it("no consulta la base si el identificador es inválido", async () => {
        expect(await consultarMiPerfilAdministrador(0)).toBeNull();
        expect(await consultarMiPerfilAdministrador(NaN)).toBeNull();
        expect(mocks.select).not.toHaveBeenCalled();
    });

    it("devuelve null si no existe el administrador", async () => {
        mocks.first.mockResolvedValue(null);
        expect(await consultarMiPerfilAdministrador(999)).toBeNull();
    });

    it("propaga errores para que la ruta muestre su límite de error", async () => {
        mocks.first.mockRejectedValue(new Error("DB no disponible"));
        await expect(consultarMiPerfilAdministrador(15)).rejects.toThrow("DB no disponible");
    });
});
