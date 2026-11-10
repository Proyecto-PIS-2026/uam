
import { beforeEach, describe, expect, it, vi } from "vitest";
import consultarDatosModificarUsuarios from "./ConsultaUsuarios";

const mocks = vi.hoisted(() => ({
    administradorSelect: vi.fn(),
    administradorInclude: vi.fn(),
    administradorAll: vi.fn(),
    operadorSelect: vi.fn(),
    operadorInclude: vi.fn(),
    operadorAll: vi.fn(),
    productorSelect: vi.fn(),
    productorInclude: vi.fn(),
    productorAll: vi.fn(),
    usuarioSelect: vi.fn(),
}));

vi.mock("../../../../../infraestructura/persistencia/prisma/db", () => ({
    db: {
        orm: {
            public: {
                Administrador: {
                    select: mocks.administradorSelect,
                },
                Operador: {
                    select: mocks.operadorSelect,
                },
                Productor: {
                    select: mocks.productorSelect,
                },
            },
        },
    },
}));

function configurarConsulta(
    selectMock: typeof mocks.administradorSelect,
    includeMock: typeof mocks.administradorInclude,
    allMock: typeof mocks.administradorAll,
) {
    selectMock.mockReturnValue({
        include: includeMock,
    });

    includeMock.mockImplementation(
        (
            _relacion: string,
            configurarUsuario: (
                usuario: {
                    select: (...columnas: string[]) => unknown;
                },
            ) => unknown,
        ) => {
            configurarUsuario({
                select: mocks.usuarioSelect,
            });

            return {
                all: allMock,
            };
        },
    );

    allMock.mockResolvedValue([]);
}

describe("consultarDatosModificarUsuarios", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        configurarConsulta(
            mocks.administradorSelect,
            mocks.administradorInclude,
            mocks.administradorAll,
        );

        configurarConsulta(
            mocks.operadorSelect,
            mocks.operadorInclude,
            mocks.operadorAll,
        );

        configurarConsulta(
            mocks.productorSelect,
            mocks.productorInclude,
            mocks.productorAll,
        );
    });

    it("incluye usuarios habilitados y deshabilitados de los tres roles y el administrador actual", async () => {
        mocks.administradorAll.mockResolvedValue([
            {
                id: 101,
                email: "ana@example.com",
                usuario: {
                    id: 1,
                    username: "ana.admin",
                    rol: "ADMINISTRADOR",
                    solicitoRestablecimiento: false,
                    habilitado: false,
                },
            },
        ]);

        mocks.operadorAll.mockResolvedValue([
            {
                id: 201,
                nombreFantasia: "La Huerta",
                usuario: {
                    id: 2,
                    username: "beto.operador",
                    rol: "OPERADOR",
                    solicitoRestablecimiento: true,
                    habilitado: true,
                },
            },
        ]);

        mocks.productorAll.mockResolvedValue([
            {
                id: 301,
                nombreFantasia: "Granja Carla",
                usuario: {
                    id: 3,
                    username: "carla.productor",
                    rol: "PRODUCTOR",
                    solicitoRestablecimiento: false,
                    habilitado: false,
                },
            },
        ]);

        const resultado = await consultarDatosModificarUsuarios(1);

        expect(mocks.administradorSelect).toHaveBeenCalledTimes(1);
        expect(mocks.administradorSelect).toHaveBeenCalledWith("id", "email");

        expect(mocks.operadorSelect).toHaveBeenCalledTimes(1);
        expect(mocks.operadorSelect).toHaveBeenCalledWith(
            "id",
            "nombreFantasia",
        );

        expect(mocks.productorSelect).toHaveBeenCalledTimes(1);
        expect(mocks.productorSelect).toHaveBeenCalledWith("id", "nombreFantasia");

        expect(mocks.administradorInclude).toHaveBeenCalledWith(
            "usuario",
            expect.any(Function),
        );

        expect(mocks.operadorInclude).toHaveBeenCalledWith(
            "usuario",
            expect.any(Function),
        );

        expect(mocks.productorInclude).toHaveBeenCalledWith(
            "usuario",
            expect.any(Function),
        );

        expect(mocks.usuarioSelect).toHaveBeenCalledTimes(3);

        expect(mocks.usuarioSelect).toHaveBeenNthCalledWith(
            1,
            "id",
            "username",
            "rol",
            "solicitoRestablecimiento",
            "habilitado",
        );

        expect(mocks.usuarioSelect).toHaveBeenNthCalledWith(
            2,
            "id",
            "username",
            "rol",
            "solicitoRestablecimiento",
            "habilitado",
        );

        expect(mocks.usuarioSelect).toHaveBeenNthCalledWith(
            3,
            "id",
            "username",
            "rol",
            "solicitoRestablecimiento",
            "habilitado",
        );

        expect(mocks.administradorAll).toHaveBeenCalledTimes(1);
        expect(mocks.operadorAll).toHaveBeenCalledTimes(1);
        expect(mocks.productorAll).toHaveBeenCalledTimes(1);

        expect(resultado).toEqual({
            usuarioActualId: 1,
            usuarios: [
                {
                    id: 1,
                    username: "ana.admin",
                    rol: "ADMINISTRADOR",
                    administradorId: 101,
                    email: "ana@example.com",
                    solicitoRestablecimiento: false,
                    habilitado: false,
                },
                {
                    id: 2,
                    username: "beto.operador",
                    rol: "OPERADOR",
                    operadorId: 201,
                    nombreFantasia: "La Huerta",
                    solicitoRestablecimiento: true,
                    habilitado: true,
                },
                {
                    id: 3,
                    username: "carla.productor",
                    rol: "PRODUCTOR",
                    productorId: 301,
                    nombreFantasia: "Granja Carla",
                    solicitoRestablecimiento: false,
                    habilitado: false,
                },
            ],
        });
    });

    it("devuelve una lista vacía cuando no hay usuarios en ninguna entidad", async () => {
        const resultado = await consultarDatosModificarUsuarios();

        expect(resultado).toEqual({
            usuarios: [],
        });

        expect(mocks.administradorAll).toHaveBeenCalledTimes(1);
        expect(mocks.operadorAll).toHaveBeenCalledTimes(1);
        expect(mocks.productorAll).toHaveBeenCalledTimes(1);
    });
});
