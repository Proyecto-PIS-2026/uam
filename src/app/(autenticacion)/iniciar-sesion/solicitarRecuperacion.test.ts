// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { solicitarRecuperacion } from "./acciones";

const mocks = vi.hoisted(() => ({
    existeUsuario: vi.fn(),
    where: vi.fn(),
    update: vi.fn(),
}));

vi.mock(
    "@/modulos/identidad-acceso/autenticacion/consultasAutenticacion",
    () => ({
        existeUsuarioPorNombre: mocks.existeUsuario,
    }),
);

vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
    db: {
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
        mocks.where.mockReturnValue({ update: mocks.update });
        mocks.update.mockResolvedValue(undefined);
    });

    it("rechaza un nombre de usuario vacío", async () => {
        const resultado = await solicitarRecuperacion("   ");

        expect(resultado.error).toBeDefined();
        expect(mocks.update).not.toHaveBeenCalled();
    });

    it("informa cuando el usuario no existe", async () => {
        mocks.existeUsuario.mockResolvedValue(false);

        const resultado = await solicitarRecuperacion("inexistente");

        expect(resultado.error).toBe(
            "No existe ningún usuario con ese nombre.",
        );
        expect(mocks.update).not.toHaveBeenCalled();
    });

    it("registra la solicitud del usuario existente", async () => {
        mocks.existeUsuario.mockResolvedValue(true);

        const resultado = await solicitarRecuperacion("  mercado_verde  ");

        expect(mocks.where).toHaveBeenCalledWith({
            username: "mercado_verde",
        });
        expect(mocks.update).toHaveBeenCalledWith({
            solicitoRestablecimiento: true,
        });
        expect(resultado.exito).toBe(
            "La solicitud de recuperación fue realizada correctamente.",
        );
    });

    it("no informa éxito si falla la base de datos", async () => {
        mocks.existeUsuario.mockResolvedValue(true);
        mocks.update.mockRejectedValue(new Error("Error de base de datos"));

        const resultado = await solicitarRecuperacion("mercado_verde");

        expect(resultado.error).toBeDefined();
        expect(resultado.exito).toBeUndefined();
    });
});