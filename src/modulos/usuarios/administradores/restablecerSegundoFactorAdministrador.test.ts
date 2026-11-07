// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { restablecerSegundoFactorAdministrador } from "./restablecerSegundoFactorAdministrador";

const mocks = vi.hoisted(() => ({
    exigirAdministrador: vi.fn(), revalidatePath: vi.fn(), execute: vi.fn(), transaction: vi.fn(),
    administrador: { where: vi.fn().mockReturnThis(), first: vi.fn() },
    usuario: { where: vi.fn().mockReturnThis(), first: vi.fn(), update: vi.fn() },
}));
vi.mock("@/modulos/identidad-acceso/autorizacion/control-acciones", () => ({ controlarSesionEnAccion: (control: () => Promise<unknown>) => control() }));
vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => ({ exigirAdministrador: mocks.exigirAdministrador }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/infraestructura/persistencia/prisma/db", () => ({ db: {
    transaction: mocks.transaction,
    raw: { sql: () => ({ returnsRow: () => ({ build: () => ({}) }) }) },
} }));

beforeEach(() => {
    vi.clearAllMocks();
    mocks.exigirAdministrador.mockResolvedValue({ usuarioId: 1 });
    mocks.administrador.first.mockResolvedValue({ id: 20, usuarioId: 2 });
    mocks.usuario.first.mockResolvedValue({ id: 2, rol: "ADMINISTRADOR" });
    mocks.usuario.update.mockResolvedValue(undefined);
    mocks.transaction.mockImplementation(async (operacion) => operacion({ execute: mocks.execute, orm: { public: { Administrador: mocks.administrador, Usuario: mocks.usuario } } }));
});

describe("restablecerSegundoFactorAdministrador", () => {
    it("exige una sesión administrativa antes de modificar datos", async () => {
        mocks.exigirAdministrador.mockRejectedValue(new Error("Sin permiso"));
        await expect(restablecerSegundoFactorAdministrador(20)).rejects.toThrow("Sin permiso");
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it.each([0, NaN, 1.5, 2147483648])("rechaza el identificador inválido %s", async (id) => {
        expect((await restablecerSegundoFactorAdministrador(id)).esValido).toBe(false);
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("impide restablecer el segundo factor propio aunque se invoque directamente", async () => {
        mocks.administrador.first.mockResolvedValue({ id: 20, usuarioId: 1 });
        expect(await restablecerSegundoFactorAdministrador(20)).toEqual({ esValido: false, errores: ["No podés restablecer tu propio segundo factor."] });
        expect(mocks.usuario.update).not.toHaveBeenCalled();
    });

    it("no modifica una cuenta inexistente", async () => {
        mocks.administrador.first.mockResolvedValue(null);
        expect((await restablecerSegundoFactorAdministrador(20)).esValido).toBe(false);
        expect(mocks.usuario.update).not.toHaveBeenCalled();
    });

    it("elimina la vinculación, el desafío pendiente y el bloqueo de la cuenta consultada", async () => {
        expect((await restablecerSegundoFactorAdministrador(20)).esValido).toBe(true);
        expect(mocks.administrador.where).toHaveBeenCalledWith({ id: 20 });
        expect(mocks.usuario.where).toHaveBeenCalledWith({ id: 2, rol: "ADMINISTRADOR" });
        expect(mocks.execute).toHaveBeenCalledOnce();
        expect(mocks.usuario.update).toHaveBeenCalledExactlyOnceWith({
            twoFactorEnabled: false, twoFactorSecret: null, twoFactorPendingSecret: null,
            twoFactorChallengeHash: null, twoFactorExpiresAt: null, twoFactorLastStep: null,
            twoFactorFailedAttempts: 0, twoFactorLockedUntil: null,
        });
        expect(mocks.revalidatePath).toHaveBeenCalledWith("/gestion-administradores/20");
    });
});
