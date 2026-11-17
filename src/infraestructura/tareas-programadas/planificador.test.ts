// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { iniciarPlanificadorTareas, type ControlPlanificador } from "./planificador";

const mocks = vi.hoisted(() => ({ ejecutar: vi.fn() }));
vi.mock("./ejecutar-tareas", () => ({ ejecutarTareasDiarias: mocks.ejecutar }));

let control: ControlPlanificador | undefined;

beforeEach(() => {
    vi.useFakeTimers();
    mocks.ejecutar.mockReset().mockResolvedValue([]);
});

afterEach(async () => {
    await control?.detener();
    control = undefined;
    vi.useRealTimers();
});

describe("horario de las tareas diarias en Uruguay", () => {
    it.each([
        ["2026-11-17T23:59:00Z", "2026-11-18T03:00:00.000Z"],
        ["2026-12-31T23:59:00Z", "2027-01-01T03:00:00.000Z"],
    ])("espera a las 00 de Montevideo tras arrancar en %s", async (inicio, medianocheUruguay) => {
        vi.setSystemTime(new Date(inicio));
        const tareas = [{ nombre: "vencimientos", ejecutar: vi.fn() }];
        control = iniciarPlanificadorTareas(tareas);
        await vi.advanceTimersByTimeAsync(0);
        expect(mocks.ejecutar).toHaveBeenCalledExactlyOnceWith(tareas);

        await vi.advanceTimersByTimeAsync(60_000);
        expect(mocks.ejecutar).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(3 * 60 * 60 * 1000 - 1);
        expect(mocks.ejecutar).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1);
        expect(new Date().toISOString()).toBe(medianocheUruguay);
        expect(mocks.ejecutar).toHaveBeenCalledTimes(2);

        await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
        expect(mocks.ejecutar).toHaveBeenCalledTimes(3);
    });

    it("reintenta un fallo a los cinco minutos y después conserva la próxima medianoche de Uruguay", async () => {
        vi.setSystemTime(new Date("2026-11-17T15:00:00Z"));
        mocks.ejecutar.mockResolvedValueOnce([{ nombre: "vencimientos", estado: "error" }]);
        control = iniciarPlanificadorTareas([]);
        await vi.advanceTimersByTimeAsync(0);
        await vi.advanceTimersByTimeAsync(5 * 60 * 1000 - 1);
        expect(mocks.ejecutar).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1);
        expect(mocks.ejecutar).toHaveBeenCalledTimes(2);

        await vi.advanceTimersByTimeAsync(12 * 60 * 60 * 1000 - 5 * 60 * 1000);
        expect(new Date().toISOString()).toBe("2026-11-18T03:00:00.000Z");
        expect(mocks.ejecutar).toHaveBeenCalledTimes(3);
    });
});
