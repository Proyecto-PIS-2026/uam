import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerTareasDiarias } from "./registro";
import type { ContextoTareaDiaria } from "./tipos";

const configuracion = vi.hoisted(() => ({ habilitado: false, diasVigencia: 30, diasAnticipacionAviso: 5 }));
vi.mock("../../modulos/publicaciones/configuracion-aging-fotos", () => ({ CONFIGURACION_AGING_FOTOS: configuracion }));

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
    Object.assign(configuracion, { habilitado: false, diasVigencia: 30, diasAnticipacionAviso: 5 });
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("registro de tareas con aging opcional", () => {
    it("registra las tareas aunque el aging esté deshabilitado", async () => {
        const [tarea] = obtenerTareasDiarias();

        expect(tarea.nombre).toBe("publicaciones.eliminar-fotos-vencidas");
        expect(tarea.habilitada?.()).toBe(false);
        await expect(tarea.ejecutar(contexto)).resolves.toBe(0);
        expect(mocks.procesar).toHaveBeenCalledWith(contexto, { habilitado: false });
    });

    it("vuelve a leer la configuración antes de cada ejecución", async () => {
        const [tarea] = obtenerTareasDiarias();
        expect(tarea.habilitada?.()).toBe(false);
        await tarea.ejecutar(contexto);
        configuracion.habilitado = true;
        mocks.procesar.mockResolvedValue(7);

        expect(tarea.habilitada?.()).toBe(true);
        await expect(tarea.ejecutar(contexto)).resolves.toBe(7);
        expect(mocks.procesar).toHaveBeenNthCalledWith(1, contexto, { habilitado: false });
        expect(mocks.procesar).toHaveBeenNthCalledWith(2, contexto, {
            habilitado: true, diasVigencia: 30, diasAnticipacionAviso: 5,
        });
    });

    it("rechaza y registra la configuración inválida sin procesar fotos", async () => {
        Object.assign(configuracion, { habilitado: true, diasVigencia: 0 });
        const registrar = vi.spyOn(console, "error").mockImplementation(() => undefined);
        const [tarea] = obtenerTareasDiarias();

        expect(() => tarea.habilitada?.()).toThrow("La vigencia de las fotos");
        await expect(tarea.ejecutar(contexto)).rejects.toThrow("La vigencia de las fotos");
        expect(mocks.procesar).not.toHaveBeenCalled();
        expect(registrar).toHaveBeenCalledWith(expect.stringContaining("No se ejecutó el aging de fotos"), expect.any(Error));
    });
});
