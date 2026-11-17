import { Temporal } from "temporal-polyfill";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    calcularFechaMaximaVigencia,
    convertirFechaVigenciaAInstant,
    convertirInstantAFechaVigencia,
    validarFechaVigencia,
} from "./vigencia-publicacion";

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-07T15:00:00Z"));
});

afterEach(() => vi.useRealTimers());

describe("calcularFechaMaximaVigencia", () => {
    it.each([
        ["2026-11-08T02:59:59Z", "2026-12-07"],
        ["2026-11-08T03:00:00Z", "2026-12-08"],
    ])("calcula desde el día de Montevideo al ser %s en UTC", (instante, esperado) => {
        vi.setSystemTime(new Date(instante));

        expect(calcularFechaMaximaVigencia(30)).toBe(esperado);
    });

    it.each([
        ["2026-01-31", "2026-02-01"],
        ["2028-02-28", "2028-02-29"],
        ["2028-02-29", "2028-03-01"],
        ["2026-12-31", "2027-01-01"],
    ])("suma un día a %s respetando los límites del calendario", (hoy, esperado) => {
        expect(calcularFechaMaximaVigencia(1, Temporal.PlainDate.from(hoy))).toBe(esperado);
    });

    it("suma exactamente 30 días, aunque cruce febrero", () => {
        expect(calcularFechaMaximaVigencia(30, Temporal.PlainDate.from("2026-01-31"))).toBe("2026-03-02");
    });

    it("acepta 36501 días cuando la fecha resultante conserva cuatro dígitos de año", () => {
        expect(calcularFechaMaximaVigencia(36501, Temporal.PlainDate.from("2000-01-01"))).toBe("2099-12-08");
    });

    it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
        "rechaza una configuración de días inválida: %s",
        (dias) => {
            expect(() => calcularFechaMaximaVigencia(dias)).toThrow("La configuración de vigencia de publicaciones no es válida.");
        },
    );

    it("informa un error de configuración si la suma supera el rango de Temporal", () => {
        expect(() => calcularFechaMaximaVigencia(Number.MAX_SAFE_INTEGER)).toThrow("La configuración de vigencia de publicaciones no es válida.");
    });

    it("rechaza una fecha máxima que requeriría cinco dígitos de año", () => {
        expect(() => calcularFechaMaximaVigencia(1, Temporal.PlainDate.from("9999-12-31"))).toThrow("La configuración de vigencia de publicaciones no es válida.");
    });
});

describe("conversión de fechas de vigencia", () => {
    it.each([
        ["2026-11-07", "2026-11-08T02:59:59Z"],
        ["2028-02-29", "2028-03-01T02:59:59Z"],
    ])("vence a las 23:59:59 de Montevideo el %s y conserva la fecha al volver", (fecha, esperado) => {
        const instante = convertirFechaVigenciaAInstant(fecha);

        expect(instante?.toString()).toBe(esperado);
        expect(convertirInstantAFechaVigencia(instante)).toBe(fecha);
    });

    it("interpreta un instante UTC anterior a la medianoche local como el día anterior", () => {
        expect(convertirInstantAFechaVigencia(Temporal.Instant.from("2026-11-08T02:30:00Z"))).toBe("2026-11-07");
    });

    it.each([null, undefined, "", "no-es-fecha", "2026-02-30"])("no convierte una fecha ausente o inválida: %s", (fecha) => {
        expect(convertirFechaVigenciaAInstant(fecha)).toBeNull();
    });

    it.each([null, undefined])("conserva la ausencia de instante: %s", (instante) => {
        expect(convertirInstantAFechaVigencia(instante)).toBeNull();
    });
});

describe("validarFechaVigencia", () => {
    it.each([undefined, null, ""])("permite omitir la fecha: %s", (fecha) => {
        expect(validarFechaVigencia(fecha)).toEqual({ esValido: true, fechaVigencia: null });
    });

    it.each([42, true, {}, "2026-1-07", "07/11/2026", "2026-11-07T00:00:00Z", " 2026-11-07 ", "+010000-01-01"])(
        "rechaza un formato de fecha incorrecto: %j",
        (fecha) => {
            expect(validarFechaVigencia(fecha)).toEqual({ esValido: false, error: "La fecha de vigencia debe tener el formato AAAA-MM-DD." });
        },
    );

    it.each(["2026-02-29", "2026-11-31", "2026-13-01"])("rechaza la fecha inexistente %s", (fecha) => {
        expect(validarFechaVigencia(fecha)).toEqual({ esValido: false, error: "La fecha de vigencia no es una fecha válida." });
    });

    it("rechaza el día anterior y acepta hoy y una fecha futura", () => {
        expect(validarFechaVigencia("2026-11-06")).toEqual({ esValido: false, error: "La fecha de vigencia no puede ser anterior a la fecha actual." });
        expect(validarFechaVigencia("2026-11-07")).toEqual({ esValido: true, fechaVigencia: "2026-11-07" });
        expect(validarFechaVigencia("2026-11-08")).toEqual({ esValido: true, fechaVigencia: "2026-11-08" });
    });

    it("no considera pasada la fecha local cuando UTC ya cambió de día", () => {
        vi.setSystemTime(new Date("2026-11-08T02:59:59Z"));

        expect(validarFechaVigencia("2026-11-07")).toEqual({ esValido: true, fechaVigencia: "2026-11-07" });
    });
});
