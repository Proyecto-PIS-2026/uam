import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TransaccionTarea } from "@/infraestructura/tareas-programadas/tipos";
import {
    CLAVE_ANTICIPACION_AVISO_LOCALES,
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
    seleccionar.mockReturnValue({ first: consultar });
});

describe("anticipación administrativa de vencimientos de locales", () => {
    it.each(["0", "3", "30", "365"])("lee %s días de la transacción de la tarea", async (valor) => {
        consultar.mockResolvedValue({ valorConfiguracion: valor });

        await expect(obtenerConfiguracionAvisosLocales(tx)).resolves.toEqual({
            habilitado: true, diasAnticipacionAviso: Number(valor),
        });
        expect(filtrar).toHaveBeenCalledExactlyOnceWith({ nombreConfiguracion: CLAVE_ANTICIPACION_AVISO_LOCALES });
        expect(seleccionar).toHaveBeenCalledExactlyOnceWith("valorConfiguracion");
    });

    it.each([undefined, null, { valorConfiguracion: null }])("conserva tres días si aún falta el valor: %j", async (fila) => {
        consultar.mockResolvedValue(fila);

        await expect(obtenerConfiguracionAvisosLocales(tx)).resolves.toEqual({ habilitado: true, diasAnticipacionAviso: 3 });
    });

    it("relee la anticipación en cada ejecución sin conservar el valor anterior", async () => {
        consultar.mockResolvedValueOnce({ valorConfiguracion: "3" }).mockResolvedValueOnce({ valorConfiguracion: "12" });

        await expect(obtenerConfiguracionAvisosLocales(tx)).resolves.toMatchObject({ diasAnticipacionAviso: 3 });
        await expect(obtenerConfiguracionAvisosLocales(tx)).resolves.toMatchObject({ diasAnticipacionAviso: 12 });
        expect(consultar).toHaveBeenCalledTimes(2);
    });

    it.each(["", "-1", "1.5", "366", "9007199254740992", " 3", "3 ", "1e1", "abc"])("rechaza la anticipación inválida %s", async (valor) => {
        consultar.mockResolvedValue({ valorConfiguracion: valor });

        expect(() => validarAnticipacionAvisoLocales(valor)).toThrow("La anticipación de los avisos de locales debe ser un entero entre 0 y 365 días.");
        await expect(obtenerConfiguracionAvisosLocales(tx)).rejects.toThrow("La anticipación de los avisos de locales debe ser un entero entre 0 y 365 días.");
    });

    it("propaga un fallo de lectura para que el planificador pueda reintentar", async () => {
        const error = new Error("No se pudo consultar la configuración");
        consultar.mockRejectedValue(error);

        await expect(obtenerConfiguracionAvisosLocales(tx)).rejects.toBe(error);
    });
});
