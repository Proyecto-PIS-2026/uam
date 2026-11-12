import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Temporal } from "temporal-polyfill";
import { bloquearCambioVigenciaPublicaciones, obtenerFechaMaximaVigenciaOperador, obtenerFechaMaximaVigenciaProductor } from "./configuracion-vigencia-publicaciones";

vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
    db: { raw: { sql: (partes: TemplateStringsArray) => ({
        returnsRow: () => ({ build: () => ({ sql: partes.join("?") }) }),
    }) } },
}));

const ejecutar = vi.fn();
const consultar = vi.fn();
const valores = new Map<string, string>();
const tx = {
    execute: ejecutar,
    orm: { public: { Configuracion: {
        where: ({ nombreConfiguracion }: { nombreConfiguracion: string }) => ({
            select: () => ({ first: () => consultar(nombreConfiguracion) }),
        }),
    } } },
} as unknown as Parameters<typeof obtenerFechaMaximaVigenciaOperador>[0];

beforeEach(() => {
    vi.resetAllMocks();
    valores.clear();
    valores.set("vigencia_publicaciones_operador_habilitada", "true");
    valores.set("vigencia_publicaciones_operador", "5");
    valores.set("vigencia_publicaciones_productor_habilitada", "true");
    valores.set("vigencia_publicaciones_productor", "30");
    consultar.mockImplementation(async (nombre: string) => valores.has(nombre) ? { valorConfiguracion: valores.get(nombre) } : null);
    ejecutar.mockResolvedValue(undefined);
    vi.spyOn(Temporal.Now, "plainDateISO").mockReturnValue(Temporal.PlainDate.from("2026-11-12"));
});

afterEach(() => vi.restoreAllMocks());

describe("vigencia general de publicaciones por rol", () => {
    it("usa el plazo de cada rol y coordina la lectura con cambios administrativos", async () => {
        await expect(obtenerFechaMaximaVigenciaOperador(tx)).resolves.toBe("2026-11-17");
        await expect(obtenerFechaMaximaVigenciaProductor(tx)).resolves.toBe("2026-12-12");

        expect(consultar.mock.calls.map(([nombre]) => nombre)).toEqual([
            "vigencia_publicaciones_operador_habilitada", "vigencia_publicaciones_operador",
            "vigencia_publicaciones_productor_habilitada", "vigencia_publicaciones_productor",
        ]);
        expect(ejecutar).toHaveBeenCalledWith({ sql: expect.stringContaining("pg_advisory_xact_lock_shared(1722, 0)") });
        expect(ejecutar.mock.invocationCallOrder[0]).toBeLessThan(consultar.mock.invocationCallOrder[0]);
        expect(Temporal.Now.plainDateISO).toHaveBeenCalledWith("America/Montevideo");
    });

    it("desactivar la política de operadores no desactiva la de productores", async () => {
        valores.set("vigencia_publicaciones_operador_habilitada", "false");

        await expect(obtenerFechaMaximaVigenciaOperador(tx)).resolves.toBeNull();
        await expect(obtenerFechaMaximaVigenciaProductor(tx)).resolves.toBe("2026-12-12");
    });

    it.each(["vigencia_publicaciones_operador_habilitada", "vigencia_publicaciones_operador"])("no hereda valores de productores cuando falta %s", async (clave) => {
        valores.delete(clave);

        await expect(obtenerFechaMaximaVigenciaOperador(tx)).rejects.toThrow("No se pudo consultar la configuración de vigencia de publicaciones.");
    });

    it.each(["0", "-1", "1.5", "inválido"])("rechaza un plazo activo inválido de operadores: %s", async (dias) => {
        valores.set("vigencia_publicaciones_operador", dias);

        await expect(obtenerFechaMaximaVigenciaOperador(tx)).rejects.toThrow("La configuración de vigencia de publicaciones no es válida.");
    });

    it("rechaza una habilitación inválida", async () => {
        valores.set("vigencia_publicaciones_operador_habilitada", "yes");

        await expect(obtenerFechaMaximaVigenciaOperador(tx)).rejects.toThrow("La configuración de vigencia de publicaciones no es válida.");
    });

    it("toma el bloqueo exclusivo al modificar las políticas", async () => {
        await bloquearCambioVigenciaPublicaciones(tx);

        expect(ejecutar).toHaveBeenCalledExactlyOnceWith({ sql: expect.stringContaining("pg_advisory_xact_lock(1722, 0)") });
        expect(consultar).not.toHaveBeenCalled();
    });
});
