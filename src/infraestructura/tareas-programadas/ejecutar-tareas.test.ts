import { Temporal } from "@js-temporal/polyfill";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ejecutarTareasDiarias } from "./ejecutar-tareas";

const mocks = vi.hoisted(() => ({ transaction: vi.fn(), execute: vi.fn(), query: vi.fn() }));

vi.mock("../persistencia/prisma/db", () => ({
    db: {
        transaction: mocks.transaction,
        raw: {
            sql: (fragmentos: TemplateStringsArray, ...valores: unknown[]) => ({
                returnsRow: () => ({ build: () => ({ sql: fragmentos.join("?"), valores }) }),
            }),
        },
    },
}));

describe("registro de ejecución de tareas diarias", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.spyOn(console, "info").mockImplementation(() => {});
        vi.spyOn(console, "error").mockImplementation(() => {});
        mocks.transaction.mockImplementation((accion) => accion({ execute: mocks.execute, query: mocks.query }));
        mocks.query.mockResolvedValueOnce([{ adquirida: true }])
            .mockResolvedValueOnce([{ fecha: "2026-11-04", limite: Temporal.Instant.from("2026-11-04T03:00:00Z") }])
            .mockResolvedValueOnce([]);
    });

    afterEach(() => vi.restoreAllMocks());

    it("no consulta ni registra una tarea deshabilitada, y puede ejecutarla al habilitarla ese mismo día", async () => {
        let habilitada = false;
        const ejecutar = vi.fn().mockResolvedValue(2);
        const tarea = { nombre: "fotos", habilitada: () => habilitada, ejecutar };
        expect(await ejecutarTareasDiarias([tarea])).toEqual([{ nombre: "fotos", estado: "deshabilitada" }]);
        expect(mocks.transaction).not.toHaveBeenCalled();
        expect(ejecutar).not.toHaveBeenCalled();

        habilitada = true;
        expect(await ejecutarTareasDiarias([tarea])).toEqual([
            { nombre: "fotos", estado: "completada", fecha: "2026-11-04", elementosProcesados: 2 },
        ]);
        expect(ejecutar).toHaveBeenCalledOnce();
        expect(mocks.execute.mock.calls.at(-1)?.[0].sql).toContain('INSERT INTO "ejecucionTareaProgramada"');
    });

    it("no vuelve a procesar un día completado", async () => {
        mocks.query.mockReset().mockResolvedValueOnce([{ adquirida: true }])
            .mockResolvedValueOnce([{ fecha: "2026-11-04", limite: Temporal.Instant.from("2026-11-04T03:00:00Z") }])
            .mockResolvedValueOnce([{ nombre: "fotos" }]);
        const ejecutar = vi.fn();
        expect(await ejecutarTareasDiarias([{ nombre: "fotos", ejecutar }])).toEqual([
            { nombre: "fotos", estado: "ya-completada", fecha: "2026-11-04" },
        ]);
        expect(ejecutar).not.toHaveBeenCalled();
        expect(mocks.execute).toHaveBeenCalledTimes(1);
    });

    it("respeta el bloqueo de otra réplica", async () => {
        mocks.query.mockReset().mockResolvedValueOnce([{ adquirida: false }]);
        const ejecutar = vi.fn();
        expect(await ejecutarTareasDiarias([{ nombre: "fotos", ejecutar }])).toEqual([{ nombre: "fotos", estado: "ocupada" }]);
        expect(ejecutar).not.toHaveBeenCalled();
        expect(mocks.query).toHaveBeenCalledOnce();
    });

    it("no guarda una ejecución exitosa cuando el procesamiento falla", async () => {
        const ejecutar = vi.fn().mockRejectedValue(new Error("Fallo al guardar el aviso"));
        expect(await ejecutarTareasDiarias([{ nombre: "fotos", ejecutar }])).toEqual([{ nombre: "fotos", estado: "error" }]);
        expect(mocks.execute).toHaveBeenCalledTimes(1);
        expect(mocks.execute.mock.calls[0][0].sql).not.toContain("INSERT");
    });

    it("informa configuración inválida sin escribir ni impedir otras tareas", async () => {
        const ejecutarInvalida = vi.fn();
        const ejecutarOtra = vi.fn().mockResolvedValue(0);
        expect(await ejecutarTareasDiarias([
            { nombre: "fotos", habilitada: () => { throw new Error("Configuración inválida"); }, ejecutar: ejecutarInvalida },
            { nombre: "otra", ejecutar: ejecutarOtra },
        ])).toEqual([
            { nombre: "fotos", estado: "error" },
            { nombre: "otra", estado: "completada", fecha: "2026-11-04", elementosProcesados: 0 },
        ]);
        expect(ejecutarInvalida).not.toHaveBeenCalled();
        expect(mocks.transaction).toHaveBeenCalledOnce();
        expect(ejecutarOtra).toHaveBeenCalledOnce();
    });
});
