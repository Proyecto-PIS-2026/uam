import { afterEach, describe, expect, it, vi } from "vitest";
import { obtenerFechaEstadistica } from "./registrar-estadisticas";

vi.mock("@/infraestructura/persistencia/prisma/db", () => ({ db: {} }));

afterEach(() => vi.useRealTimers());

describe("día de las estadísticas en Uruguay", () => {
    it.each([
        ["2026-11-07T02:59:59Z", "2026-11-06"],
        ["2026-11-07T03:00:00Z", "2026-11-07"],
    ])("registra %s en el día %s", (instante, esperado) => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(instante));
        expect(obtenerFechaEstadistica()).toBe(esperado);
    });
});
