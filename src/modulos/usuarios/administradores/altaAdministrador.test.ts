import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { altaAdministrador } from "./altaAdministrador";

const mocks = vi.hoisted(() => ({
    exigir: vi.fn(), validar: vi.fn(), hash: vi.fn(), revalidar: vi.fn(), guardar: vi.fn(),
    usuarioExistente: vi.fn(), emailExistente: vi.fn(), crearUsuario: vi.fn(), crearAdministrador: vi.fn(),
}));

vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => ({ exigirAdministrador: mocks.exigir }));
vi.mock("./validarAltaAdministrador", () => ({ validarAltaAdministrador: mocks.validar }));
vi.mock("argon2", () => ({ default: { hash: mocks.hash, argon2id: 2 } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidar }));
vi.mock("../guardar-usuario-atomico", () => {
    const tx = {
        orm: { public: {
            Usuario: { where: () => ({ first: mocks.usuarioExistente }), create: mocks.crearUsuario },
            Administrador: { where: () => ({ first: mocks.emailExistente }), create: mocks.crearAdministrador },
        } },
    };
    return {
        guardarUsuarioAtomico: (callback: (tx: unknown) => Promise<unknown>, tipo: string) => mocks.guardar(() => callback(tx), tipo),
    };
});

const DATOS = { nombreUsuario: "admin_nuevo", contraseña: "clave12345", email: "admin@example.com" };

beforeEach(() => {
    vi.resetAllMocks();
    mocks.exigir.mockResolvedValue({ usuarioId: 1, rol: "ADMINISTRADOR", expiraEn: 9999999999 });
    mocks.validar.mockReturnValue({ esValido: true, datos: DATOS });
    mocks.hash.mockResolvedValue("HASH_FALSO");
    mocks.guardar.mockImplementation((callback) => callback());
    mocks.usuarioExistente.mockResolvedValue(null);
    mocks.emailExistente.mockResolvedValue(null);
    mocks.crearUsuario.mockResolvedValue({ id: 10 });
    mocks.crearAdministrador.mockResolvedValue({ id: 20 });
});

afterEach(() => vi.restoreAllMocks());

describe("altaAdministrador", () => {
    it("exige un administrador antes de validar o guardar nada", async () => {
        const error = new Error("No tenés permiso para realizar esta operación.");
        mocks.exigir.mockRejectedValue(error);

        await expect(altaAdministrador(DATOS)).rejects.toBe(error);
        expect(mocks.validar).not.toHaveBeenCalled();
        expect(mocks.hash).not.toHaveBeenCalled();
        expect(mocks.guardar).not.toHaveBeenCalled();
    });

    it("devuelve los errores del validador sin hashear ni guardar", async () => {
        mocks.validar.mockReturnValue({ esValido: false, errores: ["Inválida"] });

        expect(await altaAdministrador(null)).toEqual({ esValido: false, errores: ["Inválida"] });
        expect(mocks.hash).not.toHaveBeenCalled();
        expect(mocks.guardar).not.toHaveBeenCalled();
        expect(mocks.revalidar).not.toHaveBeenCalled();
    });

    it("hashea la contraseña con argon2id", async () => {
        await altaAdministrador(DATOS);

        expect(mocks.hash).toHaveBeenCalledExactlyOnceWith("clave12345", { type: 2 });
    });

    it("guarda el usuario con el hash y no con la contraseña en texto plano", async () => {
        await altaAdministrador(DATOS);

        expect(mocks.crearUsuario).toHaveBeenCalledExactlyOnceWith({
            username: "admin_nuevo",
            passwordHash: "HASH_FALSO",
            rol: "ADMINISTRADOR",
        });
    });

    it("crea el administrador enlazado al usuario y devuelve su id", async () => {
        expect(await altaAdministrador(DATOS)).toEqual({
            esValido: true,
            id: 20,
            mensaje: "Administrador creado correctamente.",
        });
        expect(mocks.crearAdministrador).toHaveBeenCalledExactlyOnceWith({
            usuarioId: 10,
            email: "admin@example.com",
        });
    });

    it("ejecuta el alta de tipo administrador", async () => {
        await altaAdministrador(DATOS);

        expect(mocks.guardar).toHaveBeenCalledExactlyOnceWith(expect.any(Function), "administrador");
    });

    it("rechaza un nombre de usuario que ya existe sin crear registros", async () => {
        mocks.usuarioExistente.mockResolvedValue({ id: 99 });

        expect(await altaAdministrador(DATOS)).toEqual({
            esValido: false,
            errores: ["Ya existe un usuario con ese nombre de usuario."],
        });
        expect(mocks.crearUsuario).not.toHaveBeenCalled();
        expect(mocks.crearAdministrador).not.toHaveBeenCalled();
        expect(mocks.revalidar).not.toHaveBeenCalled();
    });

    it("rechaza un email que ya existe sin crear registros", async () => {
        mocks.emailExistente.mockResolvedValue({ id: 99 });

        expect(await altaAdministrador(DATOS)).toEqual({
            esValido: false,
            errores: ["Ya existe un administrador con ese email."],
        });
        expect(mocks.crearUsuario).not.toHaveBeenCalled();
        expect(mocks.crearAdministrador).not.toHaveBeenCalled();
        expect(mocks.revalidar).not.toHaveBeenCalled();
    });

    it("revalida la página de administración cuando el alta sale bien", async () => {
        await altaAdministrador(DATOS);

        expect(mocks.revalidar).toHaveBeenCalledExactlyOnceWith("/administracion");
    });

    it("propaga el error de la transacción sin revalidar", async () => {
        const error = new Error("Fallo de base de datos");
        mocks.crearAdministrador.mockRejectedValue(error);

        await expect(altaAdministrador(DATOS)).rejects.toBe(error);
        expect(mocks.revalidar).not.toHaveBeenCalled();
    });
});