// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import argon2 from "argon2";
import { cambiarMiContrasena } from "./cambiarMiContrasena";

const m = vi.hoisted(() => ({ sesion: vi.fn(), habilitado: vi.fn(), where: vi.fn(), select: vi.fn(), first: vi.fn(), update: vi.fn() }));
vi.mock("../autorizacion/control-acciones", () => ({ exigirSesionEnAccion: m.sesion }));
vi.mock("./configuracion", () => ({ estaHabilitadoCambioContrasena: m.habilitado }));
vi.mock("@/infraestructura/persistencia/prisma/db", () => ({ db: { orm: { public: { Usuario: { where: m.where } } } } }));
vi.mock("argon2", () => ({ default: { verify: vi.fn(), hash: vi.fn(), argon2id: 2 } }));
const datos = { actual: "Anterior123", nueva: "Nueva1234", confirmacion: "Nueva1234" };

describe("cambio protegido de la contraseña propia", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        m.sesion.mockResolvedValue({ usuarioId: 7, rol: "PRODUCTOR" });
        m.habilitado.mockReturnValue(true);
        m.where.mockReturnValue({ select: m.select });
        m.select.mockReturnValue({ first: m.first, update: m.update });
        m.first.mockResolvedValue({ passwordHash: "hash-anterior" });
        m.update.mockResolvedValue({ id: 7 });
        vi.mocked(argon2.verify).mockResolvedValue(true);
        vi.mocked(argon2.hash).mockResolvedValue("hash-nuevo");
    });

    it.each(["ADMINISTRADOR", "OPERADOR", "PRODUCTOR"])("cambia solo la cuenta autenticada para %s", async rol => {
        m.sesion.mockResolvedValue({ usuarioId: 7, rol });
        expect(await cambiarMiContrasena({ ...datos, usuarioId: 99, id: 99, rol: "OTRO" })).toEqual({ esValido: true, mensaje: "Tu contraseña se actualizó correctamente." });
        expect(m.where.mock.calls).toEqual([
            [{ id: 7, rol }], [{ id: 7, rol, passwordHash: "hash-anterior" }],
        ]);
        expect(argon2.verify).toHaveBeenCalledWith("hash-anterior", datos.actual);
        expect(argon2.hash).toHaveBeenCalledWith(datos.nueva, { type: argon2.argon2id });
        expect(m.update).toHaveBeenCalledWith({ passwordHash: "hash-nuevo", solicitoRestablecimiento: false });
    });
    it("rechaza sin sesión antes de leer configuraciones o credenciales", async () => {
        m.sesion.mockRejectedValue(new Error("NEXT_REDIRECT"));
        await expect(cambiarMiContrasena(datos)).rejects.toThrow("NEXT_REDIRECT");
        expect(m.habilitado).not.toHaveBeenCalled();
        expect(m.where).not.toHaveBeenCalled();
    });
    it("impide una petición directa con funcionalidad deshabilitada", async () => {
        m.habilitado.mockReturnValue(false);
        expect((await cambiarMiContrasena(datos)).esValido).toBe(false);
        expect(m.where).not.toHaveBeenCalled();
    });
    it.each([null, { ...datos, confirmacion: "distinta" }, { ...datos, nueva: "corta" }])("rechaza campos inválidos antes de consultar contraseñas", async valor => {
        expect((await cambiarMiContrasena(valor)).esValido).toBe(false);
        expect(m.where).not.toHaveBeenCalled();
    });
    it("informa que la cuenta ya no existe", async () => {
        m.first.mockResolvedValue(null);
        expect(await cambiarMiContrasena(datos)).toMatchObject({ esValido: false, errores: ["No se encontró tu cuenta."] });
        expect(argon2.verify).not.toHaveBeenCalled();
        expect(m.update).not.toHaveBeenCalled();
    });
    it("informa contraseña actual incorrecta y mantiene las credenciales", async () => {
        vi.mocked(argon2.verify).mockResolvedValue(false);
        expect(await cambiarMiContrasena(datos)).toMatchObject({ esValido: false, errores: ["La contraseña actual no es válida."] });
        expect(argon2.hash).not.toHaveBeenCalled();
        expect(m.update).not.toHaveBeenCalled();
    });
    it("respeta la deshabilitación mientras se procesa el cambio", async () => {
        m.habilitado.mockReturnValueOnce(true).mockReturnValueOnce(false);
        expect((await cambiarMiContrasena(datos)).esValido).toBe(false);
        expect(m.update).not.toHaveBeenCalled();
    });
    it("no sobrescribe credenciales modificadas por otra petición", async () => {
        m.update.mockResolvedValue(null);
        expect(await cambiarMiContrasena(datos)).toMatchObject({ esValido: false, errores: [expect.stringContaining("credenciales cambiaron")] });
    });
    it("no actualiza si falla el cálculo del hash", async () => {
        vi.mocked(argon2.hash).mockRejectedValue(new Error("fallo hash"));
        await expect(cambiarMiContrasena(datos)).rejects.toThrow("fallo hash");
        expect(m.update).not.toHaveBeenCalled();
    });
});
