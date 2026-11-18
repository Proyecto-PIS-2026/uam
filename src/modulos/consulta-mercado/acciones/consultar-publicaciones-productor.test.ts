import { beforeEach, describe, expect, it, vi } from "vitest";
import obtenerPublicacionesProductores from "./consultar-publicaciones-productor";

const mocks = vi.hoisted(() => ({ autorizar: vi.fn(), consultar: vi.fn() }));
vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => ({ exigirConsultaProductores: mocks.autorizar }));
vi.mock("@/modulos/identidad-acceso/autorizacion/control-acciones", () => ({ controlarSesionEnAccion: (control: () => Promise<unknown>) => control() }));
vi.mock("../consultas/consultas-publicaciones-productor", () => ({ consultarPublicacionesProductores: mocks.consultar }));

beforeEach(() => vi.resetAllMocks());

describe("obtenerPublicacionesProductores", () => {
    it.each(["OPERADOR", "ADMINISTRADOR"])("consulta con la sesión autorizada vigente de %s", async (rol) => {
        const sesion = { usuarioId: 3, rol, expiraEn: 2000000000 };
        const resultado = { publicaciones: [] };
        mocks.autorizar.mockResolvedValue(sesion);
        mocks.consultar.mockResolvedValue(resultado);
        await expect(obtenerPublicacionesProductores()).resolves.toBe(resultado);
        expect(mocks.consultar).toHaveBeenCalledExactlyOnceWith(sesion);
        expect(mocks.autorizar.mock.invocationCallOrder[0]).toBeLessThan(mocks.consultar.mock.invocationCallOrder[0]);
    });

    it("vuelve a comprobar la sesión en cada actualización y no consulta datos al perder el acceso", async () => {
        const sesion = { usuarioId: 3, rol: "OPERADOR", expiraEn: 2000000000 };
        const rechazo = new Error("La sesión expiró.");
        mocks.autorizar.mockResolvedValueOnce(sesion).mockRejectedValueOnce(rechazo);
        mocks.consultar.mockResolvedValue({ publicaciones: [] });
        await obtenerPublicacionesProductores();
        await expect(obtenerPublicacionesProductores()).rejects.toBe(rechazo);
        expect(mocks.autorizar).toHaveBeenCalledTimes(2);
        expect(mocks.consultar).toHaveBeenCalledOnce();
    });

    it("propaga errores de consulta para que el cliente conserve los datos y permita reintentar", async () => {
        mocks.autorizar.mockResolvedValue({ rol: "OPERADOR" });
        const error = new Error("Base no disponible");
        mocks.consultar.mockRejectedValue(error);
        await expect(obtenerPublicacionesProductores()).rejects.toBe(error);
    });
});
