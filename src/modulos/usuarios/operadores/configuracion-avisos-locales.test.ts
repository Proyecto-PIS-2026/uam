import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TransaccionTarea } from "@/infraestructura/tareas-programadas/tipos";
import {
    CLAVE_ANTICIPACION_AVISO_LOCALES,
    CLAVE_HABILITACION_AVISO_LOCALES,
    obtenerConfiguracionAvisosLocales,
    validarAnticipacionAvisoLocales,
} from "./configuracion-avisos-locales";

const consultar = vi.fn();
const seleccionar = vi.fn();
const filtrar = vi.fn();
const tx = {
    orm: { public: { Configuracion: { where: filtrar } } },
} as unknown as TransaccionTarea;

beforeEach(() => {
    vi.resetAllMocks();
    filtrar.mockReturnValue({ select: seleccionar });
    seleccionar.mockReturnValue({ all: consultar });
});

function filasConfiguracion(anticipacion: string | null, habilitacion: string | null = "true") {
    return [
        { nombreConfiguracion: CLAVE_HABILITACION_AVISO_LOCALES, valorConfiguracion: habilitacion },
        { nombreConfiguracion: CLAVE_ANTICIPACION_AVISO_LOCALES, valorConfiguracion: anticipacion },
    ];
}

describe("configuración administrativa de avisos de vencimientos de locales", () => {
    it.each(["0", "3", "30", "365"])("lee %s días de la transacción de la tarea", async (valor) => {
        consultar.mockResolvedValue(filasConfiguracion(valor));

        await expect(obtenerConfiguracionAvisosLocales(tx)).resolves.toEqual({
            habilitado: true, diasAnticipacionAviso: Number(valor),
        });
        expect(consultar).toHaveBeenCalledOnce();
    });

    it.each([{ filas: [] }, { filas: filasConfiguracion(null, null) }])("conserva los valores predeterminados si aún faltan: %j", async ({ filas }) => {
        consultar.mockResolvedValue(filas);

        await expect(obtenerConfiguracionAvisosLocales(tx)).resolves.toEqual({ habilitado: true, diasAnticipacionAviso: 3 });
    });

    it("mantiene los avisos habilitados cuando solo existe la anticipación anterior", async () => {
        consultar.mockResolvedValue([{ nombreConfiguracion: CLAVE_ANTICIPACION_AVISO_LOCALES, valorConfiguracion: "12" }]);

        await expect(obtenerConfiguracionAvisosLocales(tx)).resolves.toEqual({ habilitado: true, diasAnticipacionAviso: 12 });
    });

    it("deshabilita los avisos conservando la anticipación configurada", async () => {
        consultar.mockResolvedValue(filasConfiguracion("12", "false"));

        await expect(obtenerConfiguracionAvisosLocales(tx)).resolves.toEqual({ habilitado: false, diasAnticipacionAviso: 12 });
    });

    it("conserva la deshabilitación aunque todavía falte la anticipación", async () => {
        consultar.mockResolvedValue([{ nombreConfiguracion: CLAVE_HABILITACION_AVISO_LOCALES, valorConfiguracion: "false" }]);

        await expect(obtenerConfiguracionAvisosLocales(tx)).resolves.toEqual({ habilitado: false, diasAnticipacionAviso: 3 });
    });

    it("relee ambas opciones al deshabilitar y volver a habilitar los avisos", async () => {
        consultar.mockResolvedValueOnce(filasConfiguracion("3"))
            .mockResolvedValueOnce(filasConfiguracion("12", "false"))
            .mockResolvedValueOnce(filasConfiguracion("12", "true"));

        await expect(obtenerConfiguracionAvisosLocales(tx)).resolves.toEqual({ habilitado: true, diasAnticipacionAviso: 3 });
        await expect(obtenerConfiguracionAvisosLocales(tx)).resolves.toEqual({ habilitado: false, diasAnticipacionAviso: 12 });
        await expect(obtenerConfiguracionAvisosLocales(tx)).resolves.toEqual({ habilitado: true, diasAnticipacionAviso: 12 });
        expect(consultar).toHaveBeenCalledTimes(3);
    });

    it.each(["", "TRUE", "1", " false", "abc"])("rechaza una habilitación inválida: %j", async (valor) => {
        consultar.mockResolvedValue(filasConfiguracion("3", valor));

        await expect(obtenerConfiguracionAvisosLocales(tx)).rejects.toThrow("La habilitación de los avisos de locales debe ser verdadera o falsa.");
    });

    it.each(["", "-1", "1.5", "366", "9007199254740992", " 3", "3 ", "1e1", "abc"])("rechaza la anticipación inválida %s", async (valor) => {
        consultar.mockResolvedValue(filasConfiguracion(valor));

        expect(() => validarAnticipacionAvisoLocales(valor)).toThrow("La anticipación de los avisos de locales debe ser un entero entre 0 y 365 días.");
        await expect(obtenerConfiguracionAvisosLocales(tx)).rejects.toThrow("La anticipación de los avisos de locales debe ser un entero entre 0 y 365 días.");
    });

    it("propaga un fallo de lectura para que el planificador pueda reintentar", async () => {
        const error = new Error("No se pudo consultar la configuración");
        consultar.mockRejectedValue(error);

        await expect(obtenerConfiguracionAvisosLocales(tx)).rejects.toBe(error);
    });
});
