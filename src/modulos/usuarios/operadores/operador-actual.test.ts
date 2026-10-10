// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerOperadorActual, obtenerOperadorPorId, obtenerOperadorPorNombre } from "./operador-actual";

const operadorMock = vi.hoisted(() => ({
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    first: vi.fn(),
}));

const sesionMock = vi.hoisted(() => vi.fn());
vi.mock("../../identidad-acceso/autenticacion/sesiones", () => ({ obtenerSesion: sesionMock }));

vi.mock("../../../infraestructura/persistencia/prisma/db", () => ({
    db: { orm: { public: { Operador: operadorMock } } },
}));

describe("selección del operador de Mi Mercado", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sesionMock.mockResolvedValue({ usuarioId: 10, rol: "OPERADOR", expiraEn: 2000000000 });
    });

    it("consulta el operador del usuario autenticado", async () => {
        const operador = { id: 13, usuarioId: 10, nombreFantasia: "Operador 13" };
        operadorMock.first.mockResolvedValue(operador);

        await expect(obtenerOperadorActual()).resolves.toBe(operador);
        expect(operadorMock.where).toHaveBeenCalledExactlyOnceWith({ usuarioId: 10 });
        expect(operadorMock.first).toHaveBeenCalledOnce();
    });

    it("informa cuando no hay operadores", async () => {
        operadorMock.first.mockResolvedValue(null);

        await expect(obtenerOperadorActual()).rejects.toThrow("No se encontr");
        expect(operadorMock.where).toHaveBeenCalledExactlyOnceWith({ usuarioId: 10 });
    });

    it("no consulta operadores sin sesión", async () => {
        sesionMock.mockResolvedValue(null);

        await expect(obtenerOperadorActual()).rejects.toThrow("Debe iniciar sesión.");
        expect(operadorMock.select).not.toHaveBeenCalled();
    });

    it("consulta al operador indicado por su ID", async () => {
        const operador = { id: 37, usuarioId: 11, nombreFantasia: "Operador 37" };
        operadorMock.first.mockResolvedValue(operador);

        await expect(obtenerOperadorPorId(37)).resolves.toBe(operador);
        expect(operadorMock.where).toHaveBeenCalledExactlyOnceWith({ id: 37 });
    });

    it("devuelve null si el operador indicado no existe", async () => {
        operadorMock.first.mockResolvedValue(null);

        await expect(obtenerOperadorPorId(37)).resolves.toBeNull();
        expect(operadorMock.where).toHaveBeenCalledExactlyOnceWith({ id: 37 });
    });

    it("consulta al operador indicado por su nombre de fantasía", async () => {
        const operador = { id: 37, usuarioId: 11, nombreFantasia: "Frutas & Más" };
        operadorMock.first.mockResolvedValue(operador);

        await expect(obtenerOperadorPorNombre("Frutas & Más")).resolves.toBe(operador);
        expect(operadorMock.where).toHaveBeenCalledExactlyOnceWith({ nombreFantasia: "Frutas & Más" });
    });

    it("devuelve null si el nombre indicado no existe", async () => {
        operadorMock.first.mockResolvedValue(null);

        await expect(obtenerOperadorPorNombre("No existe")).resolves.toBeNull();
        expect(operadorMock.where).toHaveBeenCalledExactlyOnceWith({ nombreFantasia: "No existe" });
    });
});
