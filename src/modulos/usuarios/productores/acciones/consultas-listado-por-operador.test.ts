import { beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerProductoresPorOperador } from "./consultas-listado-por-operador";

const mocks = vi.hoisted(() => ({
    obtenerSesion: vi.fn(),
    select: vi.fn(),
    include: vi.fn(),
    all: vi.fn(),
}));

vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({
    obtenerSesion: mocks.obtenerSesion,
}));

vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
    db: {
        orm: {
            public: {
                Productor: {
                    select: mocks.select,
                },
            },
        },
    },
}));

function crearConstructor() {
    const constructor = {
        select: mocks.select,
        include: mocks.include,
        all: mocks.all,
    };
    mocks.select.mockReturnValue(constructor);
    mocks.include.mockImplementation(
        (_relacion: string, callback: (consulta: typeof constructor) => unknown) => {
            callback(constructor);
            return constructor;
        }
    );
}

function crearRelacion(activa = true, disponible = true, tipoPublicacion = "PRODUCTOR") {
    return {
        publicacion: {
            publicacionActiva: activa,
            publicacionDisponible: disponible,
            tipoPublicacion,
        },
    };
}

describe("obtenerProductoresPorOperador", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        crearConstructor();
        mocks.obtenerSesion.mockResolvedValue({usuarioId: 5, rol: "OPERADOR", expiraEn: 2000000000});
        mocks.all.mockResolvedValue([]);
    });

    it.each([null, "PRODUCTOR", "ADMINISTRADOR"] as const)("rechaza la consulta con sesión %s antes de acceder a datos",
        async (rol) => {
            mocks.obtenerSesion.mockResolvedValue(rol ? { usuarioId: 5, rol, expiraEn: 2000000000 } : null);
            await expect(obtenerProductoresPorOperador()).rejects.toThrow("No tiene permisos para consultar productores y sus publicaciones.");
            expect(mocks.select).not.toHaveBeenCalled();
            expect(mocks.all).not.toHaveBeenCalled();
        }
    );

    it("devuelve una lista vacía cuando no hay productores", async () => {
        await expect(obtenerProductoresPorOperador()).resolves.toEqual([]);
    });

    it("cuenta solo publicaciones activas y disponibles de productores y ordena por nombre", async () => {
        mocks.all.mockResolvedValue([
            {
                id: 1,
                nombreFantasia: "Zeta",
                fotoPerfil: "/zeta.jpg",
                publicacionesProductor: [
                    crearRelacion(),
                    crearRelacion(),
                    crearRelacion(false),
                    crearRelacion(true, false),
                    crearRelacion(true, true, "OPERADOR"),
                ],
            },
            {
                id: 2,
                nombreFantasia: "Álamo",
                fotoPerfil: null,
                publicacionesProductor: [],
            },
        ]);

        await expect(obtenerProductoresPorOperador()).resolves.toEqual([
            {
                id: 2,
                nombreFantasia: "Álamo",
                fotoPerfil: null,
                cantidadProductos: 0,
            },
            {
                id: 1,
                nombreFantasia: "Zeta",
                fotoPerfil: "/zeta.jpg",
                cantidadProductos: 2,
            },
        ]);
    });

    it("propaga errores de la consulta", async () => {
        mocks.all.mockRejectedValue(new Error("Error de base de datos"));
        await expect(obtenerProductoresPorOperador()).rejects.toThrow("Error de base de datos");
    });
});