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
    const rawSql = vi.fn();
    const rawReturnsRow = vi.fn();
    const rawBuild = vi.fn();
    const execute = vi.fn();

    const relationInclude = vi.fn();
    const relationSelect = vi.fn();
    const relationBuilder = {select: relationSelect, include: relationInclude};

    relationSelect.mockReturnValue(relationBuilder);

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

    rawSql.mockReturnValue({ returnsRow: rawReturnsRow });
    rawReturnsRow.mockReturnValue({ build: rawBuild });
    rawBuild.mockReturnValue({ tipo: "bloqueo" });

    const tx = {
        execute,
        orm: {
            public: {
                PublicacionOperador: { where: publicacionOperadorWhere },
                Publicacion: { where: publicacionWhere },
            },
        },
    };
    const transaction = vi.fn((callback: (cliente: typeof tx) => Promise<unknown>) => callback(tx));

    return {
        publicacionOperadorWhere,
        publicacionOperadorInclude,
        publicacionOperadorAll,
        publicacionWhere,
        publicacionUpdate,
        relationInclude,
        rawSql,
        rawReturnsRow,
        rawBuild,
        execute,
        transaction,
        tx,
    };
});

vi.mock(
    "../../../infraestructura/persistencia/prisma/db",
    () => ({
        db: {
            transaction: mocks.transaction,
            raw: { sql: mocks.rawSql },
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

        mocks.publicacionUpdate.mockResolvedValue({ id: 20 });

        await actualizarPrecioPublicacion(
            10,
            20,
            125
        );

        expect(
            mocks.publicacionOperadorWhere
        ).toHaveBeenCalledWith({
            operadorId: 10,
            publicacionId: 20,
        });
        expect(mocks.transaction).toHaveBeenCalledOnce();
        expect(mocks.rawSql.mock.calls[0]?.[0].join("")).toContain("pg_advisory_xact_lock(1719,");
        expect(mocks.rawSql.mock.calls[0]?.[1]).toBe(10);
        expect(mocks.rawReturnsRow).toHaveBeenCalledWith({ locked: "pg/int4@1" });
        expect(mocks.execute).toHaveBeenCalledWith({ tipo: "bloqueo" });
        expect(mocks.execute.mock.invocationCallOrder[0]).toBeLessThan(
            mocks.publicacionOperadorWhere.mock.invocationCallOrder[0]
        );

        expect(
            mocks.publicacionWhere
        ).toHaveBeenCalledWith({
            id: 20,
        });

        expect(
            mocks.publicacionUpdate
        ).toHaveBeenCalledWith({
            precio: "125.00",
        });
    });

    it("rechaza el cambio si la publicación desaparece antes del update", async () => {
        mocks.publicacionOperadorAll.mockResolvedValue([{ id: 1 }]);
        mocks.publicacionUpdate.mockResolvedValue(null);

        await expect(actualizarPrecioPublicacion(10, 20, 125)).rejects.toThrow(
            "La publicación no existe o no pertenece al operador."
        );

        expect(mocks.publicacionUpdate).toHaveBeenCalledWith({ precio: "125.00" });
    });

    it("rechaza actualizar una publicación que no pertenece al operador", async () => {
        mocks.publicacionOperadorAll.mockResolvedValue(
            []
        );

        await expect(
            actualizarPrecioPublicacion(
                10,
                20,
                125
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

    it("rechaza precios decimales antes de consultar la base de datos", async () => {
        await expect(
            actualizarPrecioPublicacion(10, 20, 125.5)
        ).rejects.toThrow(
            "El precio debe ser un número entero, sin decimales."
        );

        expect(mocks.publicacionOperadorWhere).not.toHaveBeenCalled();
        expect(mocks.transaction).not.toHaveBeenCalled();
        expect(mocks.publicacionWhere).not.toHaveBeenCalled();
        expect(mocks.publicacionUpdate).not.toHaveBeenCalled();
    });

    it("rechaza precios que superan el límite antes de consultar la base de datos", async () => {
        await expect(
            actualizarPrecioPublicacion(10, 20, 10_000_000_000)
        ).rejects.toThrow();

        expect(mocks.publicacionOperadorWhere).not.toHaveBeenCalled();
        expect(mocks.transaction).not.toHaveBeenCalled();
        expect(mocks.publicacionWhere).not.toHaveBeenCalled();
        expect(mocks.publicacionUpdate).not.toHaveBeenCalled();
    });
});
