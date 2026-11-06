// @vitest-environment node
import { expect, it, vi } from "vitest";
import argon2 from "argon2";
import { cambiarMiContrasena } from "./cambiarMiContrasena";
import { autenticarUsuario } from "../autenticacion/autenticarUsuario";

const m = vi.hoisted(() => ({ hash: "", where: vi.fn(), first: vi.fn(), update: vi.fn() }));
vi.mock("../autorizacion/control-acciones", () => ({ exigirSesionEnAccion: async () => ({ usuarioId: 7, rol: "PRODUCTOR" }) }));
vi.mock("./configuracion", () => ({ estaHabilitadoCambioContrasena: async () => true }));
vi.mock("@/compartido/vigenciaContrato", () => ({ operadorTieneContratoVigente: vi.fn() }));
vi.mock("../autenticacion/consultasAutenticacion", () => ({
    obtenerUsuarioAdministradorPorCorreo: async () => null,
    obtenerUsuarioOperadorPorNombre: async () => null,
    obtenerUsuarioProductorPorNombre: async () => ({ id: 7, rol: "PRODUCTOR", passwordHash: m.hash }),
}));
vi.mock("@/infraestructura/persistencia/prisma/db", () => ({ db: { orm: { public: { Usuario: { where: m.where } } } } }));

it("con Argon2 real, tras guardar solo autentica con la nueva contraseña", async () => {
    m.hash = await argon2.hash("Anterior123");
    const anterior = m.hash;
    m.where.mockImplementation(({ passwordHash }) => ({ select: () => ({
        first: async () => ({ passwordHash: m.hash }),
        update: async (datos: { passwordHash: string }) => {
            if (passwordHash !== m.hash) return null;
            m.hash = datos.passwordHash;
            return { id: 7 };
        },
    }) }));
    expect(await autenticarUsuario({ identificador: "productor", contrasena: "Anterior123" })).toMatchObject({ usuarioId: 7 });
    expect((await cambiarMiContrasena({ actual: "Incorrecta", nueva: "Nueva1234", confirmacion: "Nueva1234" })).esValido).toBe(false);
    expect(m.hash).toBe(anterior);
    expect(await autenticarUsuario({ identificador: "productor", contrasena: "Anterior123" })).toMatchObject({ usuarioId: 7 });
    expect((await cambiarMiContrasena({ actual: "Anterior123", nueva: "Nueva1234", confirmacion: "Nueva1234" })).esValido).toBe(true);
    expect(m.hash).not.toBe(anterior);
    expect(m.hash).toMatch(/^\$argon2id\$/);
    expect(await autenticarUsuario({ identificador: "productor", contrasena: "Anterior123" })).toBeNull();
    expect(await autenticarUsuario({ identificador: "productor", contrasena: "Nueva1234" })).toMatchObject({ usuarioId: 7 });
});
