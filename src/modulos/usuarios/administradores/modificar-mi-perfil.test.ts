import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    exigir: vi.fn(),
    revalidate: vi.fn(),
    tx: vi.fn(),
    administrador: { select: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), first: vi.fn(), update: vi.fn() },
    usuario: { select: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), first: vi.fn(), update: vi.fn() },
}));
vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => ({ exigirAdministrador: mocks.exigir }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
    db: { transaction: mocks.tx },
}));

import { modificarMiPerfilAdministrador } from "./modificar-mi-perfil";

const datos = { nombre: "mi_admin", correo: "mi@uam.com" };

describe("edición propia vinculada a BP-11.1", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.exigir.mockResolvedValue({ usuarioId: 7, rol: "ADMINISTRADOR" });
        mocks.tx.mockImplementation((cb: (tx: unknown) => unknown) => cb({ orm: { public: { Administrador: mocks.administrador, Usuario: mocks.usuario } } }));
        mocks.administrador.first.mockResolvedValueOnce({ id: 14 }).mockResolvedValueOnce(null);
        mocks.usuario.first.mockResolvedValue(null);
    });

    it("exige administrador antes de procesar datos", async () => {
        mocks.exigir.mockRejectedValueOnce(new Error("No autorizado"));
        await expect(modificarMiPerfilAdministrador(datos)).rejects.toThrow("No autorizado");
        expect(mocks.tx).not.toHaveBeenCalled();
    });

    it("rechaza datos inválidos sin usar la base", async () => {
        expect(await modificarMiPerfilAdministrador({ nombre: "a", correo: "no-es-mail" })).toMatchObject({ esValido: false });
        expect(mocks.tx).not.toHaveBeenCalled();
    });

    it("solo modifica el usuario autenticado, ignorando IDs y credenciales inyectadas", async () => {
        const resultado = await modificarMiPerfilAdministrador({ ...datos, usuarioId: 99, administradorId: 123, rol: "OPERADOR", passwordHash: "malicioso" });
        expect(resultado).toEqual({ esValido: true, mensaje: "Perfil actualizado correctamente." });
        expect(mocks.administrador.where).toHaveBeenCalledWith({ usuarioId: 7 });
        expect(mocks.administrador.update).toHaveBeenCalledWith({ email: datos.correo });
        expect(mocks.usuario.where).toHaveBeenCalledWith({ id: 7 });
        expect(mocks.usuario.update).toHaveBeenCalledWith({ username: datos.nombre });
        expect(mocks.usuario.update).not.toHaveBeenCalledWith(expect.objectContaining({ passwordHash: "malicioso" }));
        expect(mocks.revalidate).toHaveBeenCalledWith("/mi-perfil");
    });

    it("rechaza correos duplicados", async () => {
        mocks.administrador.first.mockReset().mockResolvedValueOnce({ id: 14 }).mockResolvedValueOnce({ id: 50 });
        expect(await modificarMiPerfilAdministrador(datos)).toEqual({ esValido: false, errores: ["Ya existe un administrador con ese correo electrónico."] });
        expect(mocks.administrador.update).not.toHaveBeenCalled();
    });

    it("rechaza nombres duplicados", async () => {
        mocks.usuario.first.mockResolvedValueOnce({ id: 99 });
        expect(await modificarMiPerfilAdministrador(datos)).toEqual({ esValido: false, errores: ["Ya existe un usuario con ese nombre."] });
        expect(mocks.usuario.update).not.toHaveBeenCalled();
    });

    it("informa error si falla el guardado sin emitir éxito", async () => {
        mocks.tx.mockRejectedValueOnce(new Error("DB caída"));
        expect(await modificarMiPerfilAdministrador(datos)).toEqual({ esValido: false, errores: ["No se pudieron guardar los cambios. Intentá nuevamente."] });
        expect(mocks.revalidate).not.toHaveBeenCalled();
    });
});
