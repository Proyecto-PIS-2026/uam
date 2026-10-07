// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { consultarImporteAjuste, guardarImporteAjuste } from "./configuracion-ajuste-precios";

const mocks = vi.hoisted(() => ({
    where: vi.fn(), first: vi.fn(), transaction: vi.fn(), execute: vi.fn(), sql: vi.fn(),
}));

vi.mock("../../infraestructura/persistencia/prisma/db", () => ({
    db: {
        orm: { public: { Configuracion: { where: mocks.where } } },
        transaction: mocks.transaction,
        raw: { sql: mocks.sql },
    },
}));

describe("BP-18.2: persistencia de la configuración global", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mocks.where.mockReturnValue({ first: mocks.first });
        mocks.transaction.mockImplementation(async (operacion) => operacion({ execute: mocks.execute }));
        mocks.sql.mockImplementation((partes, ...valores) => ({
            affectedCount: () => ({ build: () => ({ sql: partes.join("?"), valores }) }),
        }));
    });

    it("consulta el importe global por su clave", async () => {
        mocks.first.mockResolvedValue({ valorConfiguracion: "25" });
        expect(await consultarImporteAjuste()).toBe(25);
        expect(mocks.where).toHaveBeenCalledExactlyOnceWith({ nombreConfiguracion: "incremento_precio" });
    });

    it("informa si no existe el importe en lugar de usar un valor fijo", async () => {
        mocks.first.mockResolvedValue(null);
        await expect(consultarImporteAjuste()).rejects.toThrow("No se encontró el importe configurado");
    });

    it.each(["0", "-10", "1.5", "abc"])("rechaza el importe inválido persistido %s", async (valor) => {
        mocks.first.mockResolvedValue({ valorConfiguracion: valor });
        await expect(consultarImporteAjuste()).rejects.toThrow("entero mayor que cero");
    });

    it("guarda únicamente la configuración global con una sentencia atómica", async () => {
        expect(await guardarImporteAjuste("025")).toBe("25");
        expect(mocks.execute).toHaveBeenCalledExactlyOnceWith({
            sql: expect.stringContaining("INSERT INTO public.configuracion"),
            valores: ["incremento_precio", "25"],
        });
        expect(mocks.execute.mock.calls[0][0].sql).toContain('ON CONFLICT ("nombreConfiguracion")');
        expect(mocks.execute.mock.calls[0][0].sql).not.toContain("publicacion");
    });

    it("valida antes de iniciar una escritura", async () => {
        await expect(guardarImporteAjuste("1.5")).rejects.toThrow("entero mayor que cero");
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("propaga el fallo de guardado sin devolver un importe confirmado", async () => {
        mocks.execute.mockRejectedValue(new Error("Error de base de datos"));
        await expect(guardarImporteAjuste("25")).rejects.toThrow("Error de base de datos");
    });
});
