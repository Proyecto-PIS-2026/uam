import { beforeEach, describe, expect, it, vi } from "vitest";
import { actualizarPrecioPublicacion, ConflictoPublicacionError, incrementarPrecioPublicacion, obtenerPublicacionesDeOperador } from "./consultas-mi-mercado";

const mocks = vi.hoisted(() => {
    const consulta = () => {
        const builder = { where: vi.fn(), include: vi.fn(), select: vi.fn(), all: vi.fn(), first: vi.fn(), update: vi.fn() };
        builder.where.mockReturnValue(builder);
        builder.select.mockReturnValue(builder);
        builder.include.mockImplementation((_nombre, callback) => { callback?.(builder); return builder; });
        return builder;
    };
    return { relacion: consulta(), publicacion: consulta(), transaction: vi.fn(), execute: vi.fn(), notificar: vi.fn() };
});

vi.mock("../../../infraestructura/persistencia/prisma/db", () => ({ db: {
    orm: { public: { PublicacionOperador: mocks.relacion, Publicacion: mocks.publicacion } },
    transaction: mocks.transaction,
    raw: { sql: () => ({ returnsRow: () => ({ build: () => ({}) }) }) },
} }));
vi.mock("@/infraestructura/tiempo-real/publicaciones", () => ({ notificarCambioPublicacion: mocks.notificar }));

describe("precios de Mi Mercado", () => {
    let fila: { id: number; precio: string | null; version: number; fecha: string };
    beforeEach(() => {
        vi.clearAllMocks();
        fila = { id: 20, precio: "100.00", version: 1, fecha: "2026-10-10T16:30:00Z" };
        let turno = Promise.resolve();
        mocks.transaction.mockImplementation((callback) => {
            const resultado = turno.then(() => callback({ orm: { public: { PublicacionOperador: mocks.relacion, Publicacion: mocks.publicacion } }, execute: mocks.execute }));
            turno = resultado.then(() => {}, () => {});
            return resultado;
        });
        mocks.relacion.all.mockResolvedValue([{ id: 1, publicacionId: 20 }]);
        mocks.publicacion.first.mockImplementation(async () => ({ ...fila }));
        mocks.publicacion.update.mockImplementation(async (cambios) => { fila = { ...fila, ...cambios }; return { ...fila }; });
    });

    it("consulta solamente las publicaciones del operador", async () => {
        expect(await obtenerPublicacionesDeOperador(10)).toEqual([{ id: 1, publicacionId: 20 }]);
        expect(mocks.relacion.where).toHaveBeenCalledWith({ operadorId: 10 });
    });

    it("guarda el precio con la revisión esperada y notifica dentro de la transacción", async () => {
        expect(await actualizarPrecioPublicacion(10, 20, 125, 1)).toEqual({ precio: 125, version: 2, fecha: fila.fecha });
        expect(mocks.publicacion.where).toHaveBeenCalledWith({ id: 20, version: 1 });
        expect(mocks.notificar).toHaveBeenCalledWith(expect.anything(), { operadorId: 10, publicacionId: 20 });
        expect(mocks.notificar.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.publicacion.update.mock.invocationCallOrder[0]);
    });

    it("guarda y devuelve null al quitar el precio, conservando revisión y notificación", async () => {
        expect(await actualizarPrecioPublicacion(10, 20, null, 1)).toEqual({ precio: null, version: 2, fecha: fila.fecha });
        expect(fila).toMatchObject({ precio: null, version: 2 });
        expect(mocks.notificar).toHaveBeenCalledWith(expect.anything(), { operadorId: 10, publicacionId: 20 });
        await expect(actualizarPrecioPublicacion(10, 20, 125, 1)).rejects.toMatchObject({ actual: { precio: null, version: 2 } });
        expect(fila.precio).toBeNull();
    });

    it("incrementa desde un precio ausente sin persistir cero", async () => {
        fila.precio = null;
        expect(await incrementarPrecioPublicacion(10, 20, 10)).toMatchObject({ precio: 10, version: 2 });
        expect(fila.precio).toBe("10.00");
    });

    it("rechaza la segunda edición de la misma revisión sin sobrescribir", async () => {
        const resultados = await Promise.allSettled([actualizarPrecioPublicacion(10, 20, 125, 1), actualizarPrecioPublicacion(10, 20, 200, 1)]);
        expect(resultados[0].status).toBe("fulfilled");
        expect(resultados[1]).toMatchObject({ status: "rejected", reason: expect.any(ConflictoPublicacionError) });
        expect(fila.precio).toBe("125.00");
        expect(mocks.publicacion.update).toHaveBeenCalledOnce();
    });

    it("acumula dos incrementos concurrentes sobre el último precio guardado", async () => {
        await Promise.all([incrementarPrecioPublicacion(10, 20, 10), incrementarPrecioPublicacion(10, 20, 10)]);
        expect(fila).toMatchObject({ precio: "120.00", version: 3 });
    });

    it("rechaza ediciones sin revisión", async () => {
        await expect(actualizarPrecioPublicacion(10, 20, 125)).rejects.toBeInstanceOf(ConflictoPublicacionError);
        expect(mocks.publicacion.update).not.toHaveBeenCalled();
    });

    it("rechaza publicaciones ajenas y no emite eventos", async () => {
        mocks.relacion.all.mockResolvedValue([]);
        await expect(incrementarPrecioPublicacion(10, 20, 10)).rejects.toThrow("no pertenece");
        expect(mocks.publicacion.first).not.toHaveBeenCalled();
        expect(mocks.notificar).not.toHaveBeenCalled();
    });

    it.each([0, -1, 125.5, 10_000_000_000, Number.NaN])("rechaza precio inválido %s antes de consultar", async (precio) => {
        await expect(actualizarPrecioPublicacion(10, 20, precio, 1)).rejects.toThrow();
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("valida el resultado del incremento sobre la base actual", async () => {
        await expect(incrementarPrecioPublicacion(10, 20, -100)).rejects.toThrow("mayor a cero");
        expect(mocks.notificar).not.toHaveBeenCalled();
    });
});
