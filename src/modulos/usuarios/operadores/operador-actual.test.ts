// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerOperadorActual, obtenerOperadorAutorizado, obtenerOperadorPorNombre } from "./operador-actual";

const sesionMock = vi.hoisted(() => vi.fn());
vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({ obtenerSesion: sesionMock }));

const operadorMock = vi.hoisted(() => ({
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn((ordenar: (operador: { id: { asc: () => string } }) => string) => ordenar).mockReturnThis(),
    first: vi.fn(),
}));

vi.mock("../../../infraestructura/persistencia/prisma/db", () => ({
    db: { orm: { public: { Operador: operadorMock } } },
}));

describe("selección del operador de Mi Mercado", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sesionMock.mockResolvedValue({ usuarioId: 10, rol: "OPERADOR", expiraEn: 2000000000 });
    });

    it("selecciona el operador del usuario autenticado", async () => {
        const operador = { id: 13, usuarioId: 10, nombreFantasia: "Operador 13" };
        operadorMock.first.mockResolvedValue(operador);

        await expect(obtenerOperadorActual()).resolves.toBe(operador);
        expect(operadorMock.where).toHaveBeenCalledExactlyOnceWith({ usuarioId: 10 });
        expect(operadorMock.orderBy).not.toHaveBeenCalled();
        expect(operadorMock.first).toHaveBeenCalledOnce();
    });

    it("informa cuando no hay operadores", async () => {
        operadorMock.first.mockResolvedValue(null);

        await expect(obtenerOperadorActual()).rejects.toThrow("No se encontr");
        expect(operadorMock.where).toHaveBeenCalledExactlyOnceWith({ usuarioId: 10 });
    });

    it.each([null, { usuarioId: 10, rol: "PRODUCTOR", expiraEn: 2000000000 }, { usuarioId: 10, rol: "ADMINISTRADOR", expiraEn: 2000000000 }])("rechaza una sesión ajena al rol operador antes de consultar datos: %j", async (sesion) => {
        sesionMock.mockResolvedValue(sesion);
        await expect(obtenerOperadorActual()).rejects.toMatchObject({ status: sesion ? 403 : 401 });
        expect(operadorMock.select).not.toHaveBeenCalled();
    });

    it("rechaza un ID de operador distinto al del usuario autenticado", async () => {
        operadorMock.first.mockResolvedValue({ id: 13, usuarioId: 10, nombreFantasia: "Operador 13" });
        await expect(obtenerOperadorAutorizado(37)).rejects.toMatchObject({ status: 403 });
        expect(operadorMock.where).toHaveBeenCalledExactlyOnceWith({ usuarioId: 10 });
    });

    it("acepta el ID del operador propio", async () => {
        const operador = { id: 13, usuarioId: 10, nombreFantasia: "Operador 13" };
        operadorMock.first.mockResolvedValue(operador);
        await expect(obtenerOperadorAutorizado(13)).resolves.toBe(operador);
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