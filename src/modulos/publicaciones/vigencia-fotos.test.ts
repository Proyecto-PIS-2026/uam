import { beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerConfiguracionAgingFotos, obtenerLimiteAntiguedadFotos } from "./vigencia-fotos";

const configuracion = vi.hoisted(() => ({
    habilitado: true as unknown,
    diasVigencia: 30 as unknown,
    diasAnticipacionAviso: 5 as unknown,
}));
vi.mock("./configuracion-aging-fotos", () => ({ CONFIGURACION_AGING_FOTOS: configuracion }));

beforeEach(() => {
    Object.assign(configuracion, { habilitado: true, diasVigencia: 30, diasAnticipacionAviso: 5 });
});

describe("configuración del aging de fotos", () => {
    it("queda deshabilitado aunque los plazos sean inválidos", () => {
        Object.assign(configuracion, { habilitado: false, diasVigencia: "inválido", diasAnticipacionAviso: "inválido" });

        expect(obtenerConfiguracionAgingFotos()).toEqual({ habilitado: false });
    });

    it.each([undefined, null, "", "true", "false", 1, 0, {}])("rechaza una habilitación inválida: %s", (habilitado) => {
        configuracion.habilitado = habilitado;

        expect(obtenerConfiguracionAgingFotos).toThrow("La habilitación del aging de fotos debe ser verdadera o falsa.");
    });

    it.each([
        [30, 5],
        [2, 1],
        [36500, 36499],
    ])("habilita el aging con vigencia %s y anticipación %s", (diasVigencia, diasAnticipacionAviso) => {
        Object.assign(configuracion, { diasVigencia, diasAnticipacionAviso });

        expect(obtenerConfiguracionAgingFotos()).toEqual({ habilitado: true, diasVigencia, diasAnticipacionAviso });
    });

    it.each([undefined, null, "", "30", 0, -1, 1.5, 36501, Number.MAX_SAFE_INTEGER + 1, Number.NaN, Number.POSITIVE_INFINITY])(
        "rechaza la vigencia inválida %s cuando está habilitado", (vigencia) => {
            configuracion.diasVigencia = vigencia;

            expect(obtenerConfiguracionAgingFotos).toThrow("La vigencia de las fotos debe contener un número entero de días entre 1 y 36500.");
        },
    );

    it.each([undefined, null, "", "5", 0, -1, 1.5, 30, 31, Number.MAX_SAFE_INTEGER + 1, Number.NaN, Number.POSITIVE_INFINITY])(
        "rechaza la anticipación inválida %s cuando está habilitado", (anticipacion) => {
            configuracion.diasAnticipacionAviso = anticipacion;

            expect(obtenerConfiguracionAgingFotos).toThrow("La anticipación del aviso debe ser un número entero de días mayor que cero y menor que la vigencia.");
        },
    );

    it("rechaza una vigencia de un día porque no admite una anticipación positiva menor", () => {
        Object.assign(configuracion, { diasVigencia: 1, diasAnticipacionAviso: 1 });

        expect(obtenerConfiguracionAgingFotos).toThrow("La anticipación del aviso debe ser un número entero de días mayor que cero y menor que la vigencia.");
    });
});

describe("límite de antigüedad de fotos", () => {
    it("resta días de calendario en Montevideo", () => {
        expect(obtenerLimiteAntiguedadFotos(30, "2026-11-04T12:00:00Z")).toBe("2026-10-05T12:00:00Z");
    });
});
