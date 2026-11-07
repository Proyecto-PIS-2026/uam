import argon2 from "argon2";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { autenticarUsuario } from "./autenticarUsuario";

const consultasSimuladas = vi.hoisted(() => ({
    obtenerUsuarioAdministradorPorCorreo: vi.fn(),
    obtenerUsuarioOperadorPorNombre: vi.fn(),
    obtenerUsuarioProductorPorNombre: vi.fn(),
}));

const vigenciaContratoSimulada = vi.hoisted(() => ({
    operadorTieneContratoVigente: vi.fn(),
}));

vi.mock("./consultasAutenticacion", () => consultasSimuladas);
vi.mock("@/compartido/vigenciaContrato", () => vigenciaContratoSimulada);

const hashContrasena = await argon2.hash("contrasena-de-prueba", {
    type: argon2.argon2id,
});

describe("autenticarUsuario", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        consultasSimuladas.obtenerUsuarioAdministradorPorCorreo.mockResolvedValue(null);
        consultasSimuladas.obtenerUsuarioOperadorPorNombre.mockResolvedValue(null);
        consultasSimuladas.obtenerUsuarioProductorPorNombre.mockResolvedValue(null);
        vigenciaContratoSimulada.operadorTieneContratoVigente.mockResolvedValue(true);
    });

    it("autentica al administrador por correo y toma su rol de la base", async () => {
        consultasSimuladas.obtenerUsuarioAdministradorPorCorreo.mockResolvedValue({
            id: 1,
            passwordHash: hashContrasena,
            rol: "ADMINISTRADOR",
            habilitado: true,
        });

        const resultado = await autenticarUsuario({
            identificador: "administrador@ejemplo.com",
            contrasena: "contrasena-de-prueba",
        });

        expect(resultado).toEqual({ usuarioId: 1, rol: "ADMINISTRADOR" });
        expect(consultasSimuladas.obtenerUsuarioAdministradorPorCorreo)
            .toHaveBeenCalledWith("administrador@ejemplo.com");
    });

    it("autentica al operador por usuario sin solicitar un rol", async () => {
        consultasSimuladas.obtenerUsuarioOperadorPorNombre.mockResolvedValue({
            id: 2,
            passwordHash: hashContrasena,
            rol: "OPERADOR",
            habilitado: true,
        });

        const resultado = await autenticarUsuario({
            identificador: "mercado_verde",
            contrasena: "contrasena-de-prueba",
        });

        expect(resultado).toEqual({ usuarioId: 2, rol: "OPERADOR" });
        expect(consultasSimuladas.obtenerUsuarioOperadorPorNombre)
            .toHaveBeenCalledWith("mercado_verde");
    });

    it("rechaza un identificador inexistente", async () => {
        const resultado = await autenticarUsuario({
            identificador: "inexistente",
            contrasena: "contrasena-de-prueba",
        });

        expect(resultado).toBeNull();
    });

    it("autentica al productor por usuario y conserva su rol", async () => {
        consultasSimuladas.obtenerUsuarioProductorPorNombre.mockResolvedValue({
            id: 3,
            passwordHash: hashContrasena,
            rol: "PRODUCTOR",
            habilitado: true,
        });

        const resultado = await autenticarUsuario({
            identificador: "huerta_productora",
            contrasena: "contrasena-de-prueba",
        });

        expect(resultado).toEqual({ usuarioId: 3, rol: "PRODUCTOR" });
        expect(consultasSimuladas.obtenerUsuarioProductorPorNombre)
            .toHaveBeenCalledWith("huerta_productora");
    });

    it.each(["ADMINISTRADOR", "OPERADOR", "PRODUCTOR"])(
        "rechaza la contrasena incorrecta de un %s",
        async (rol) => {
            const consultasPorRol = {
                ADMINISTRADOR: consultasSimuladas.obtenerUsuarioAdministradorPorCorreo,
                OPERADOR: consultasSimuladas.obtenerUsuarioOperadorPorNombre,
                PRODUCTOR: consultasSimuladas.obtenerUsuarioProductorPorNombre,
            };
            const consulta = consultasPorRol[rol as keyof typeof consultasPorRol];
            consulta.mockResolvedValue({ id: 1, passwordHash: hashContrasena, rol, habilitado: true });

            const resultado = await autenticarUsuario({
                identificador: "identificador-de-prueba",
                contrasena: "incorrecta",
            });

            expect(resultado).toBeNull();
        },
    );

    describe.each([
        { rol: "ADMINISTRADOR", consultar: consultasSimuladas.obtenerUsuarioAdministradorPorCorreo },
        { rol: "OPERADOR", consultar: consultasSimuladas.obtenerUsuarioOperadorPorNombre },
        { rol: "PRODUCTOR", consultar: consultasSimuladas.obtenerUsuarioProductorPorNombre },
    ])("cuenta deshabilitada de $rol", ({ rol, consultar }) => {
        beforeEach(() => {
            consultar.mockResolvedValue({ id: 4, passwordHash: hashContrasena, rol, habilitado: false });
        });

        it("informa su estado solo después de verificar la contraseña", async () => {
            expect(await autenticarUsuario({ identificador: "cuenta", contrasena: "contrasena-de-prueba" }))
                .toEqual({ error: "CUENTA_DESHABILITADA" });
            expect(vigenciaContratoSimulada.operadorTieneContratoVigente).not.toHaveBeenCalled();
        });

        it("mantiene el rechazo genérico cuando la contraseña es incorrecta", async () => {
            expect(await autenticarUsuario({ identificador: "cuenta", contrasena: "incorrecta" })).toBeNull();
            expect(vigenciaContratoSimulada.operadorTieneContratoVigente).not.toHaveBeenCalled();
        });
    });

    it("mantiene el rechazo por contrato vencido de un operador habilitado", async () => {
        consultasSimuladas.obtenerUsuarioOperadorPorNombre.mockResolvedValue({
            id: 2,
            passwordHash: hashContrasena,
            rol: "OPERADOR",
            habilitado: true,
        });
        vigenciaContratoSimulada.operadorTieneContratoVigente.mockResolvedValue(false);
        expect(await autenticarUsuario({ identificador: "cuenta", contrasena: "contrasena-de-prueba" }))
            .toEqual({ error: "SIN_CONTRATO_VIGENTE" });
    });

    it("rechaza roles que la sesion no admite", async () => {
        consultasSimuladas.obtenerUsuarioOperadorPorNombre.mockResolvedValue({
            id: 3,
            passwordHash: hashContrasena,
            rol: "DESCONOCIDO",
        });

        const resultado = await autenticarUsuario({
            identificador: "productor",
            contrasena: "contrasena-de-prueba",
        });

        expect(resultado).toBeNull();
    });
});
