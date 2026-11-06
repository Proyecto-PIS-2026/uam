import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerTareasDiarias } from "./registro";
import type { ContextoTareaDiaria } from "./tipos";

const mocksConfiguracion = vi.hoisted(() => ({ obtener: vi.fn() }));
vi.mock("../../modulos/publicaciones/configuracion-aging-fotos", () => ({ obtenerConfiguracionAgingFotos: mocksConfiguracion.obtener }));

const mocks = vi.hoisted(() => ({ procesar: vi.fn() }));
vi.mock("../../modulos/publicaciones/procesar-vencimientos-fotos", () => ({ procesarVencimientosFotos: mocks.procesar }));

const contexto = {
    tx: {} as ContextoTareaDiaria["tx"],
    fecha: "2026-11-04",
    limite: "2026-11-04T12:00:00Z",
};

beforeEach(() => {
    vi.resetAllMocks();
    mocks.procesar.mockResolvedValue(0);
    mocksConfiguracion.obtener.mockResolvedValue({ habilitado: false });
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("registro de tareas con aging opcional", () => {
    it("registra las tareas aunque el aging esté deshabilitado", async () => {
        const [tarea] = obtenerTareasDiarias();

        expect(tarea.nombre).toBe("publicaciones.eliminar-fotos-vencidas");
        await expect(tarea.habilitada?.()).resolves.toBe(false);
        await expect(tarea.ejecutar(contexto)).resolves.toBe("deshabilitada");
        expect(mocks.procesar).not.toHaveBeenCalled();
    });

    it("vuelve a leer la configuración antes de cada ejecución", async () => {
        const [tarea] = obtenerTareasDiarias();
        await expect(tarea.habilitada?.()).resolves.toBe(false);
        await tarea.ejecutar(contexto);
        mocksConfiguracion.obtener.mockResolvedValue({ habilitado: true, diasVigencia: 30, avisosHabilitados: true, diasAnticipacionAviso: 5 });
        mocks.procesar.mockResolvedValue(7);

        await expect(tarea.habilitada?.()).resolves.toBe(true);
        await expect(tarea.ejecutar(contexto)).resolves.toBe(7);
        expect(mocks.procesar).toHaveBeenCalledExactlyOnceWith(contexto, {
            habilitado: true, diasVigencia: 30, avisosHabilitados: true, diasAnticipacionAviso: 5,
        });
    });

    it.each(["La vigencia de las fotos no es válida", "No se pudo conectar a la base de datos"])("no procesa fotos ante un error de configuración: %s", async (mensaje) => {
        mocksConfiguracion.obtener.mockRejectedValue(new Error(mensaje));
        const registrar = vi.spyOn(console, "error").mockImplementation(() => undefined);
        const [tarea] = obtenerTareasDiarias();

        await expect(tarea.habilitada?.()).rejects.toThrow(mensaje);
        await expect(tarea.ejecutar(contexto)).rejects.toThrow(mensaje);
        expect(mocks.procesar).not.toHaveBeenCalled();
        expect(registrar).toHaveBeenCalledWith(expect.stringContaining("No se ejecutó el aging de fotos"), expect.any(Error));
    });

    it("relee también al ejecutar por si el administrador lo deshabilitó después del chequeo", async () => {
        mocksConfiguracion.obtener.mockResolvedValueOnce({ habilitado: true, diasVigencia: 3, avisosHabilitados: true, diasAnticipacionAviso: 1 });
        const [tarea] = obtenerTareasDiarias();

        await expect(tarea.habilitada?.()).resolves.toBe(true);
        await expect(tarea.ejecutar(contexto)).resolves.toBe("deshabilitada");

        expect(mocks.procesar).not.toHaveBeenCalled();
    });
});
