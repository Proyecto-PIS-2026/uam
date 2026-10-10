import { beforeEach, describe, expect, it, vi } from "vitest";
import { cargarHistoricosIniciales } from "./acciones";

const mocks = vi.hoisted(() => ({
    obtenerSesion: vi.fn(),
    inicializarHistoricosPrecios: vi.fn(),
}));

vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({
    obtenerSesion: mocks.obtenerSesion,
}));

vi.mock("./consultas-precios-historicos", () => ({
    inicializarHistoricosPrecios: mocks.inicializarHistoricosPrecios,
}));

describe("cargarHistoricosIniciales", () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it("rechaza la carga sin una sesión", async () => {
        mocks.obtenerSesion.mockResolvedValue(null);

        await expect(cargarHistoricosIniciales()).rejects.toThrow("Sólo un administrador");

        expect(mocks.inicializarHistoricosPrecios).not.toHaveBeenCalled();
    });

    it.each(["OPERADOR", "PRODUCTOR"])("rechaza el rol %s", async (rol) => {
        mocks.obtenerSesion.mockResolvedValue({ usuarioId: 1, rol, expiraEn: 2_000_000_000 });

        await expect(cargarHistoricosIniciales()).rejects.toThrow("Sólo un administrador");

        expect(mocks.inicializarHistoricosPrecios).not.toHaveBeenCalled();
    });

    it("permite al administrador cargar y devuelve el resumen", async () => {
        const resumen = { total: 3, actualizadas: 2, omitidas: 1, errores: [] };
        mocks.obtenerSesion.mockResolvedValue({ usuarioId: 1, rol: "ADMINISTRADOR", expiraEn: 2_000_000_000 });
        mocks.inicializarHistoricosPrecios.mockResolvedValue(resumen);

        await expect(cargarHistoricosIniciales()).resolves.toEqual(resumen);

        expect(mocks.obtenerSesion).toHaveBeenCalledOnce();
        expect(mocks.inicializarHistoricosPrecios).toHaveBeenCalledExactlyOnceWith();
    });

    it("devuelve los fallos por especie junto con el progreso de la carga", async () => {
        const resumen = {
            total: 3,
            actualizadas: 1,
            omitidas: 1,
            errores: [{ speciesId: 8, mensaje: "El webservice respondió con estado 503." }],
        };
        mocks.obtenerSesion.mockResolvedValue({ usuarioId: 1, rol: "ADMINISTRADOR", expiraEn: 2_000_000_000 });
        mocks.inicializarHistoricosPrecios.mockResolvedValue(resumen);

        await expect(cargarHistoricosIniciales()).resolves.toEqual(resumen);

        expect(mocks.inicializarHistoricosPrecios).toHaveBeenCalledOnce();
    });
});
