import { beforeEach, describe, expect, it, vi } from "vitest";
import { cambiarHabilitacionUsuario } from "./cambiarHabilitacionUsuario";

const mocks = vi.hoisted(() => ({
    obtenerSesion: vi.fn(), cerrarSesion: vi.fn(), redirect: vi.fn(),
    transaction: vi.fn(), usuarioWhere: vi.fn(), select: vi.fn(), update: vi.fn(),
    operadorWhere: vi.fn(), operadorSelect: vi.fn(), first: vi.fn(),
    revalidatePath: vi.fn(), notificar: vi.fn(),
    execute: vi.fn(), usuarioFirst: vi.fn(), usuarioAll: vi.fn(),
}));

vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({
    obtenerSesion: mocks.obtenerSesion, cerrarSesion: mocks.cerrarSesion,
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/infraestructura/tiempo-real/publicaciones", () => ({ notificarCambioCatalogoOperador: mocks.notificar }));
vi.mock("@/infraestructura/persistencia/prisma/db", () => ({ db: {
    transaction: mocks.transaction,
    raw: { sql: (partes: TemplateStringsArray) => ({ returnsRow: () => ({ build: () => partes.join("") }) }) },
} }));

const usuario = { where: mocks.usuarioWhere, select: mocks.select, update: mocks.update, first: mocks.usuarioFirst, all: mocks.usuarioAll };
const operador = { select: mocks.operadorSelect, where: mocks.operadorWhere, first: mocks.first };
const tx = { execute: mocks.execute, orm: { public: { Usuario: usuario, Operador: operador } } };

describe("cambiarHabilitacionUsuario — BP-18.12", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mocks.obtenerSesion.mockResolvedValue({ usuarioId: 1, rol: "ADMINISTRADOR", expiraEn: 2000000000 });
        mocks.redirect.mockImplementation(() => { throw new Error("Redirección al inicio de sesión"); });
        mocks.transaction.mockImplementation(async (operacion: (cliente: typeof tx) => Promise<unknown>) => operacion(tx));
        mocks.usuarioWhere.mockReturnValue(usuario);
        mocks.select.mockReturnValue(usuario);
        mocks.update.mockResolvedValue({ id: 2, rol: "OPERADOR" });
        mocks.usuarioFirst.mockResolvedValue({ id: 1 });
        mocks.usuarioAll.mockResolvedValue([{ id: 1 }, { id: 2 }]);
        mocks.operadorSelect.mockReturnValue(operador);
        mocks.operadorWhere.mockReturnValue(operador);
        mocks.first.mockResolvedValue({ id: 20 });
    });

    it.each(["OPERADOR", "PRODUCTOR"])("rechaza el cambio solicitado por un %s", async (rol) => {
        mocks.obtenerSesion.mockResolvedValue({ usuarioId: 1, rol });

        await expect(cambiarHabilitacionUsuario({ usuarioId: 2, habilitado: false }))
            .rejects.toMatchObject({ status: 403 });
        expect(mocks.transaction).not.toHaveBeenCalled();
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("no modifica usuarios si la sesión ya no es válida", async () => {
        mocks.obtenerSesion.mockResolvedValue(null);

        await expect(cambiarHabilitacionUsuario({ usuarioId: 2, habilitado: false }))
            .rejects.toThrow("Redirección al inicio de sesión");
        expect(mocks.cerrarSesion).toHaveBeenCalledOnce();
        expect(mocks.redirect).toHaveBeenCalledWith("/iniciar-sesion");
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it.each([
        null, [], "usuario", {},
        { usuarioId: "2", habilitado: false },
        { usuarioId: 0, habilitado: false },
        { usuarioId: -1, habilitado: false },
        { usuarioId: 1.5, habilitado: false },
        { usuarioId: 2147483648, habilitado: false },
        { usuarioId: 2, habilitado: "false" },
        { usuarioId: 2 },
    ])("rechaza datos inválidos sin guardar cambios: %j", async (datos) => {
        expect(await cambiarHabilitacionUsuario(datos)).toMatchObject({ esValido: false });
        expect(mocks.transaction).not.toHaveBeenCalled();
        expect(mocks.notificar).not.toHaveBeenCalled();
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("impide que un administrador se deshabilite a sí mismo", async () => {
        expect(await cambiarHabilitacionUsuario({ usuarioId: 1, habilitado: false })).toEqual({
            esValido: false, errores: ["No podés deshabilitarte a vos mismo."],
        });
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it.each(["ADMINISTRADOR", "OPERADOR", "PRODUCTOR"])("habilita y deshabilita a otro %s sin modificar sus publicaciones", async (rol) => {
        mocks.update.mockResolvedValue({ id: 2, rol });

        for (const habilitado of [false, true]) {
            await expect(cambiarHabilitacionUsuario({ usuarioId: 2, habilitado })).resolves.toEqual({
                esValido: true, mensaje: `Usuario ${habilitado ? "habilitado" : "deshabilitado"} correctamente.`,
            });
            expect(mocks.usuarioWhere).toHaveBeenLastCalledWith({ id: 2 });
            expect(mocks.update).toHaveBeenLastCalledWith({ habilitado });
        }
        expect(mocks.transaction).toHaveBeenCalledTimes(2);
        expect(mocks.revalidatePath).toHaveBeenCalledWith("/administracion");
        expect(mocks.revalidatePath).toHaveBeenCalledWith("/publicaciones");
        expect(mocks.revalidatePath).toHaveBeenCalledWith("/operadores");
        expect(mocks.revalidatePath).toHaveBeenCalledWith("/productores");
        if (rol === "OPERADOR") {
            expect(mocks.operadorWhere).toHaveBeenCalledWith({ usuarioId: 2 });
            expect(mocks.notificar).toHaveBeenCalledWith(tx, 20);
        } else {
            expect(mocks.notificar).not.toHaveBeenCalled();
        }
    });

    it("informa si el usuario fue eliminado antes de confirmar", async () => {
        mocks.update.mockResolvedValue(null);

        await expect(cambiarHabilitacionUsuario({ usuarioId: 2, habilitado: false })).resolves.toEqual({
            esValido: false, errores: ["El usuario seleccionado ya no existe."],
        });
        expect(mocks.notificar).not.toHaveBeenCalled();
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("propaga un error de persistencia sin anunciar un cambio exitoso", async () => {
        mocks.update.mockRejectedValue(new Error("No se pudo guardar"));

        await expect(cambiarHabilitacionUsuario({ usuarioId: 2, habilitado: false }))
            .rejects.toThrow("No se pudo guardar");
        expect(mocks.notificar).not.toHaveBeenCalled();
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("comparte el bloqueo de bajas antes de revalidar al administrador", async () => {
        let liberar!: () => void;
        mocks.execute.mockReturnValueOnce(new Promise<void>((resolve) => { liberar = resolve; }));
        const cambio = cambiarHabilitacionUsuario({ usuarioId: 2, habilitado: false });
        await vi.waitFor(() => expect(mocks.execute).toHaveBeenCalledOnce());
        expect(mocks.execute).toHaveBeenCalledWith(expect.stringContaining("pg_advisory_xact_lock(1721, 0)"));
        expect(mocks.usuarioFirst).not.toHaveBeenCalled();
        expect(mocks.update).not.toHaveBeenCalled();
        liberar();
        await expect(cambio).resolves.toMatchObject({ esValido: true });
    });

    it("rechaza la segunda deshabilitación si el emisor fue deshabilitado por la primera", async () => {
        mocks.usuarioFirst.mockResolvedValue(null);
        expect(await cambiarHabilitacionUsuario({ usuarioId: 2, habilitado: false })).toEqual({
            esValido: false, errores: ["Tu cuenta de administrador ya no está habilitada."],
        });
        expect(mocks.usuarioWhere).toHaveBeenCalledWith({ id: 1, rol: "ADMINISTRADOR", habilitado: true });
        expect(mocks.update).not.toHaveBeenCalled();
    });

    it("impide deshabilitar al último administrador habilitado", async () => {
        mocks.usuarioAll.mockResolvedValue([{ id: 2 }]);
        expect(await cambiarHabilitacionUsuario({ usuarioId: 2, habilitado: false })).toEqual({
            esValido: false, errores: ["No podés deshabilitar al último administrador habilitado."],
        });
        expect(mocks.update).not.toHaveBeenCalled();
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });
});
