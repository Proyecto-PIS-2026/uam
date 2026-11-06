// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { solicitarRecuperacion } from "./acciones";

const mocks = vi.hoisted(() => ({
    existeUsuario: vi.fn(),
    where: vi.fn(),
    updateAndCount: vi.fn(),
    enviarNotificacion: vi.fn(),
    transaction: vi.fn(),
}));

vi.mock(
    "@/modulos/identidad-acceso/autenticacion/consultasAutenticacion",
    () => ({
        existeUsuarioPorNombre: mocks.existeUsuario,
    }),
);

vi.mock("@/modulos/notificaciones/notificaciones", () => ({
    enviarNotificacion: mocks.enviarNotificacion,
}));

vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
    db: {
        transaction: mocks.transaction,
        orm: {
            public: {
                Usuario: {
                    where: mocks.where,
                },
            },
        },
    },
}));

describe("BP-16.1 - Solicitar restablecimiento", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mocks.where.mockReturnValue({ updateAndCount: mocks.updateAndCount });
        mocks.updateAndCount.mockResolvedValue(1);
        mocks.enviarNotificacion.mockResolvedValue({ enviadas: 2 });
        mocks.transaction.mockImplementation(async (operacion) =>
            operacion({ orm: { public: { Usuario: { where: mocks.where } } } }));
    });

    it("rechaza un nombre de usuario vacío", async () => {
        const resultado = await solicitarRecuperacion("   ");

        expect(resultado.error).toBeDefined();
        expect(mocks.updateAndCount).not.toHaveBeenCalled();
        expect(mocks.enviarNotificacion).not.toHaveBeenCalled();
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("informa cuando el usuario no existe", async () => {
        mocks.existeUsuario.mockResolvedValue(false);

        const resultado = await solicitarRecuperacion("inexistente");

        expect(resultado.error).toBe(
            "No existe ningún usuario con ese nombre.",
        );
        expect(mocks.updateAndCount).not.toHaveBeenCalled();
        expect(mocks.enviarNotificacion).not.toHaveBeenCalled();
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("registra la solicitud del usuario existente", async () => {
        mocks.existeUsuario.mockResolvedValue(true);

        const resultado = await solicitarRecuperacion("  mercado_verde  ");

        expect(mocks.where).toHaveBeenCalledWith({
            username: "mercado_verde",
            solicitoRestablecimiento: false,
        });
        expect(mocks.updateAndCount).toHaveBeenCalledWith({
            solicitoRestablecimiento: true,
        });
        expect(resultado.exito).toBe(
            "La solicitud de recuperación fue realizada correctamente.",
        );
        expect(mocks.enviarNotificacion).toHaveBeenCalledWith({
            texto: "El usuario mercado_verde solicitó restablecer su contraseña.",
            url: "/administracion#usuarios",
            roles: ["ADMINISTRADOR"],
        }, { orm: { public: { Usuario: { where: mocks.where } } } });
    });

    it("no informa éxito si falla la base de datos", async () => {
        mocks.existeUsuario.mockResolvedValue(true);
        mocks.updateAndCount.mockRejectedValue(new Error("Error de base de datos"));

        const resultado = await solicitarRecuperacion("mercado_verde");

        expect(resultado.error).toBeDefined();
        expect(resultado.exito).toBeUndefined();
        expect(resultado.tipoError).toBe("operacion");
        expect(mocks.enviarNotificacion).not.toHaveBeenCalled();
    });
});
