// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { guardarConfiguracionAjustePrecios, obtenerImporteAjusteRapido } from "./acciones-ajuste-precios";

const mocks = vi.hoisted(() => ({ consultar: vi.fn(), guardar: vi.fn() }));
vi.mock("./configuracion-ajuste-precios", () => ({
    consultarImporteAjuste: mocks.consultar,
    guardarImporteAjuste: mocks.guardar,
}));

describe("BP-18.2: acciones de configuración", () => {
    beforeEach(() => vi.resetAllMocks());

    it.each(["", " ", "0", "-1", "1.5", "1,5", "abc", "12abc", "1e2", "+10", " 10 ", "9007199254740992"])(
        "rechaza %j sin modificar la configuración", async (valor) => {
            expect(await guardarConfiguracionAjustePrecios(valor)).toEqual({
                ok: false, error: expect.stringContaining("entero mayor que cero"),
            });
            expect(mocks.guardar).not.toHaveBeenCalled();
        },
    );

    it("guarda un entero positivo", async () => {
        mocks.guardar.mockResolvedValue("25");
        expect(await guardarConfiguracionAjustePrecios("25")).toEqual({ ok: true, importe: "25" });
        expect(mocks.guardar).toHaveBeenCalledExactlyOnceWith("25");
    });

    it("informa un fallo de persistencia sin confirmar el nuevo importe", async () => {
        mocks.guardar.mockRejectedValue(new Error("Error de base de datos"));
        expect(await guardarConfiguracionAjustePrecios("25")).toEqual({
            ok: false, error: expect.stringContaining("Se mantiene la configuración anterior"),
        });
    });

    it("consulta nuevamente el importe para cada operación", async () => {
        mocks.consultar.mockResolvedValueOnce(10).mockResolvedValueOnce(25);
        expect(await obtenerImporteAjusteRapido()).toBe(10);
        expect(await obtenerImporteAjusteRapido()).toBe(25);
        expect(mocks.consultar).toHaveBeenCalledTimes(2);
    });
});
