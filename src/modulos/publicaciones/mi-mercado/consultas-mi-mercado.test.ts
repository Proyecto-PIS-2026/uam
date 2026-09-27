import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    actualizarPrecioPublicacion,
    obtenerPublicacionesDeOperador,
} from "./consultas-mi-mercado";

const mocks = vi.hoisted(() => {
    const publicacionOperadorWhere = vi.fn();
    const publicacionOperadorInclude = vi.fn();
    const publicacionOperadorAll = vi.fn();

    const publicacionWhere = vi.fn();
    const publicacionUpdate = vi.fn();

    const relationInclude = vi.fn();

    const relationBuilder = {
        include: relationInclude,
    };

    relationInclude.mockImplementation(
        (
            _relacion: string,
            callback?: (builder: typeof relationBuilder) => unknown
        ) => {
            callback?.(relationBuilder);
            return relationBuilder;
        }
    );

    const publicacionOperadorBuilder = {
        where: publicacionOperadorWhere,
        include: publicacionOperadorInclude,
        all: publicacionOperadorAll,
    };

    publicacionOperadorWhere.mockReturnValue(
        publicacionOperadorBuilder
    );

    publicacionOperadorInclude.mockImplementation(
        (
            _relacion: string,
            callback?: (builder: typeof relationBuilder) => unknown
        ) => {
            callback?.(relationBuilder);
            return publicacionOperadorBuilder;
        }
    );

    const publicacionBuilder = {
        where: publicacionWhere,
        update: publicacionUpdate,
    };

    publicacionWhere.mockReturnValue(publicacionBuilder);

    return {
        publicacionOperadorWhere,
        publicacionOperadorInclude,
        publicacionOperadorAll,
        publicacionWhere,
        publicacionUpdate,
        relationInclude,
    };
});

vi.mock(
    "../../../infraestructura/persistencia/prisma/db",
    () => ({
        db: {
            orm: {
                public: {
                    PublicacionOperador: {
                        where: mocks.publicacionOperadorWhere,
                    },
                    Publicacion: {
                        where: mocks.publicacionWhere,
                    },
                },
            },
        },
    })
);

describe("consultas-mi-mercado", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("obtiene las publicaciones del operador", async () => {
        const publicaciones = [
            { id: 1 },
            { id: 2 },
        ];

        mocks.publicacionOperadorAll.mockResolvedValue(
            publicaciones
        );

        const resultado =
            await obtenerPublicacionesDeOperador(10);

        expect(
            mocks.publicacionOperadorWhere
        ).toHaveBeenCalledWith({
            operadorId: 10,
        });

        expect(
            mocks.publicacionOperadorInclude
        ).toHaveBeenCalledWith(
            "publicacion",
            expect.any(Function)
        );

        expect(resultado).toBe(publicaciones);
    });

    it("actualiza el precio de una publicación del operador", async () => {
        mocks.publicacionOperadorAll.mockResolvedValue([
            { id: 1 },
        ]);

        mocks.publicacionUpdate.mockResolvedValue(
            undefined
        );

        await actualizarPrecioPublicacion(
            10,
            20,
            125.5
        );

        expect(
            mocks.publicacionOperadorWhere
        ).toHaveBeenCalledWith({
            operadorId: 10,
            publicacionId: 20,
        });

        expect(
            mocks.publicacionWhere
        ).toHaveBeenCalledWith({
            id: 20,
        });

        expect(
            mocks.publicacionUpdate
        ).toHaveBeenCalledWith({
            precio: "125.5",
        });
    });

    it("rechaza actualizar una publicación que no pertenece al operador", async () => {
        mocks.publicacionOperadorAll.mockResolvedValue(
            []
        );

        await expect(
            actualizarPrecioPublicacion(
                10,
                20,
                125.5
            )
        ).rejects.toThrow(
            "La publicación no existe o no pertenece al operador."
        );

        expect(
            mocks.publicacionWhere
        ).not.toHaveBeenCalled();

        expect(
            mocks.publicacionUpdate
        ).not.toHaveBeenCalled();
    });
});