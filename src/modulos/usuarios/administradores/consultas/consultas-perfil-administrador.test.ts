import { beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerPerfilAdministrador } from "./consultas-perfil-administrador";

const mockDb = vi.hoisted(() => {
    const administrador = {
        select: vi.fn(),
        include: vi.fn(),
        where: vi.fn(),
        first: vi.fn(),
    };
    return { administrador, usuarioSelect: vi.fn() };
});

vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
    db: {
        orm: {
            public: {
                Administrador: mockDb.administrador,
            },
        },
    },
}));

const administradorBase = {
    id: 101,
    usuarioId: 1,
    email: "admin123@uam.com",
    usuario: {
        username: "admin123",
        twoFactorEnabled: true,
        solicitoRestablecimiento: false,
    },
};

describe("obtenerPerfilAdministrador", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.administrador.select.mockReturnValue(mockDb.administrador);
        mockDb.administrador.where.mockReturnValue(mockDb.administrador);
        mockDb.administrador.include.mockImplementation(
            (_relacion: string, construir: (usuario: { select: typeof mockDb.usuarioSelect }) => unknown) => {
                construir({ select: mockDb.usuarioSelect });
                return mockDb.administrador;
            },
        );
        mockDb.administrador.first.mockResolvedValue(administradorBase);
    });

    it.each([0, -1, 1.5, Number.NaN])("devuelve null para el id %j sin consultar", async (id) => {
        expect(await obtenerPerfilAdministrador(id)).toBeNull();
        expect(mockDb.administrador.first).not.toHaveBeenCalled();
    });

    it("devuelve null si el administrador no existe", async () => {
        mockDb.administrador.first.mockResolvedValue(null);

        expect(await obtenerPerfilAdministrador(999)).toBeNull();
        expect(mockDb.administrador.where).toHaveBeenCalledWith({ id: 999 });
    });

    it("devuelve el nombre de usuario, el correo y el estado de la cuenta", async () => {
        expect(await obtenerPerfilAdministrador(101)).toEqual({
            id: 101,
            usuarioId: 1,
            nombreUsuario: "admin123",
            email: "admin123@uam.com",
            segundoFactorActivado: true,
            solicitoRestablecimiento: false,
        });
    });

    // Nunca se piden la contraseña ni el secreto del segundo factor
    it("no pide la contraseña ni el secreto del segundo factor", async () => {
        await obtenerPerfilAdministrador(101);

        const columnasUsuario = mockDb.usuarioSelect.mock.calls.flat();
        expect(columnasUsuario).not.toContain("passwordHash");
        expect(columnasUsuario).not.toContain("twoFactorSecret");
        expect(columnasUsuario).toEqual(["username", "twoFactorEnabled", "solicitoRestablecimiento"]);
    });
});