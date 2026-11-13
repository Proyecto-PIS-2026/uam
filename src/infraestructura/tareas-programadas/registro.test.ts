import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerTareasDiarias } from "./registro";
import type { ContextoTareaDiaria } from "./tipos";

const mocksConfiguracion = vi.hoisted(() => ({ obtener: vi.fn() }));
vi.mock("../../modulos/publicaciones/configuracion-aging-fotos", () => ({ obtenerConfiguracionAgingFotos: mocksConfiguracion.obtener }));

const mocks = vi.hoisted(() => ({ procesar: vi.fn() }));
vi.mock("../../modulos/publicaciones/procesar-vencimientos-fotos", () => ({ procesarVencimientosFotos: mocks.procesar }));
const locales = vi.hoisted(() => ({ configurar: vi.fn(), procesar: vi.fn() }));
vi.mock("../../modulos/usuarios/operadores/configuracion-avisos-locales", () => ({ obtenerConfiguracionAvisosLocales: locales.configurar }));
vi.mock("../../modulos/usuarios/operadores/procesar-vencimientos-locales", () => ({ procesarVencimientosLocales: locales.procesar }));

const contexto = {
    tx: {} as ContextoTareaDiaria["tx"],
    fecha: "2026-11-04",
    limite: "2026-11-04T12:00:00Z",
};

beforeEach(() => {
    vi.resetAllMocks();
    mocks.procesar.mockResolvedValue(0);
    mocksConfiguracion.obtener.mockResolvedValue({ habilitado: false });
    locales.configurar.mockReturnValue({ habilitado: true, diasAnticipacionAviso: 3 });
    locales.procesar.mockResolvedValue(2);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("registro de tareas con aging opcional", () => {
    it("revisa los locales aunque el aging de fotos esté deshabilitado", async () => {
        const tareas = obtenerTareasDiarias();
        expect(new Set(tareas.map((tarea) => tarea.nombre)).size).toBe(tareas.length);
        const tarea = tareas.find((tarea) => tarea.nombre === "operadores.avisar-vencimientos-locales")!;

        expect(await tarea.habilitada?.()).toBe(true);
        await expect(tarea.ejecutar(contexto)).resolves.toBe(2);
        expect(locales.procesar).toHaveBeenCalledExactlyOnceWith(contexto, { habilitado: true, diasAnticipacionAviso: 3 });
        expect(mocksConfiguracion.obtener).not.toHaveBeenCalled();
    });

    it("permite apagar los avisos de locales sin ejecutar su procesador", async () => {
        locales.configurar.mockReturnValue({ habilitado: false, diasAnticipacionAviso: 3 });
        const tarea = obtenerTareasDiarias().find((tarea) => tarea.nombre === "operadores.avisar-vencimientos-locales")!;

        expect(await tarea.habilitada?.()).toBe(false);
        await expect(tarea.ejecutar(contexto)).resolves.toBe("deshabilitada");
        expect(locales.procesar).not.toHaveBeenCalled();
    });

    it("toma la anticipación configurada al ejecutar la revisión de locales", async () => {
        const tarea = obtenerTareasDiarias().find((tarea) => tarea.nombre === "operadores.avisar-vencimientos-locales")!;
        locales.configurar.mockReturnValue({ habilitado: true, diasAnticipacionAviso: 7 });

        await tarea.ejecutar(contexto);
        expect(locales.procesar).toHaveBeenCalledWith(contexto, { habilitado: true, diasAnticipacionAviso: 7 });
    });

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
        }, "OPERADOR");
    });

    it.each(["OPERADOR", "PRODUCTOR"] as const)("ejecuta solo el aging habilitado de %s con sus propios plazos", async (tipo) => {
        const activa = { habilitado: true, diasVigencia: tipo === "OPERADOR" ? 10 : 30, avisosHabilitados: true, diasAnticipacionAviso: tipo === "OPERADOR" ? 2 : 7 };
        mocksConfiguracion.obtener.mockImplementation(async (rol) => rol === tipo ? activa : { habilitado: false });
        const [operadores, productores] = obtenerTareasDiarias();

        expect(operadores.nombre).not.toBe(productores.nombre);
        expect(await operadores.habilitada?.()).toBe(tipo === "OPERADOR");
        expect(await productores.habilitada?.()).toBe(tipo === "PRODUCTOR");
        await operadores.ejecutar(contexto);
        await productores.ejecutar(contexto);

        expect(mocks.procesar).toHaveBeenCalledExactlyOnceWith(contexto, activa, tipo);
    });

    it("un error en la configuración de operadores no impide procesar productores", async () => {
        const activa = { habilitado: true, diasVigencia: 15, avisosHabilitados: false, diasAnticipacionAviso: 0 };
        mocksConfiguracion.obtener.mockImplementation(async (tipo) => {
            if (tipo === "OPERADOR") throw new Error("Configuración de operadores inválida");
            return activa;
        });
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        const [operadores, productores] = obtenerTareasDiarias();

        await expect(operadores.ejecutar(contexto)).rejects.toThrow("Configuración de operadores inválida");
        await productores.ejecutar(contexto);

        expect(mocks.procesar).toHaveBeenCalledExactlyOnceWith(contexto, activa, "PRODUCTOR");
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
