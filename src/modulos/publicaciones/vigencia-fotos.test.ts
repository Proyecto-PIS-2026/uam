import { beforeEach, describe, expect, it } from "vitest";
import { validarConfiguracionAgingFotos, obtenerLimiteAntiguedadFotos, type ConfiguracionAgingFotos } from "./vigencia-fotos";

const configuracion = {
    habilitado: true as unknown,
    diasVigencia: 30 as unknown,
    avisosHabilitados: true as unknown,
    diasAnticipacionAviso: 5 as unknown,
};

const validar = () => validarConfiguracionAgingFotos(configuracion as ConfiguracionAgingFotos);

beforeEach(() => {
    Object.assign(configuracion, { habilitado: true, diasVigencia: 30, avisosHabilitados: true, diasAnticipacionAviso: 5 });
});

describe("configuración del aging de fotos", () => {
    it("queda deshabilitado aunque los plazos sean inválidos", () => {
        Object.assign(configuracion, { habilitado: false, diasVigencia: "inválido", diasAnticipacionAviso: "inválido" });

        expect(validar()).toEqual({ habilitado: false });
    });

    it.each([undefined, null, "", "true", "false", 1, 0, {}])("rechaza una habilitación inválida: %s", (habilitado) => {
        configuracion.habilitado = habilitado;

        expect(validar).toThrow("La habilitación del aging de fotos debe ser verdadera o falsa.");
    });

    it.each([
        [30, 5],
        [2, 1],
        [36500, 36499],
    ])("habilita el aging con vigencia %s y anticipación %s", (diasVigencia, diasAnticipacionAviso) => {
        Object.assign(configuracion, { diasVigencia, diasAnticipacionAviso });

        expect(validar()).toEqual({ habilitado: true, diasVigencia, avisosHabilitados: true, diasAnticipacionAviso });
    });

    it.each([undefined, null, "", "30", 0, -1, 1.5, 36501, Number.MAX_SAFE_INTEGER + 1, Number.NaN, Number.POSITIVE_INFINITY])(
        "rechaza la vigencia inválida %s cuando está habilitado", (vigencia) => {
            configuracion.diasVigencia = vigencia;

            expect(validar).toThrow("La vigencia de las fotos debe contener un número entero de días entre 1 y 36500.");
        },
    );

    it.each([undefined, null, "", "5", 0, -1, 1.5, 30, 31, Number.MAX_SAFE_INTEGER + 1, Number.NaN, Number.POSITIVE_INFINITY])(
        "rechaza la anticipación inválida %s cuando está habilitado", (anticipacion) => {
            configuracion.diasAnticipacionAviso = anticipacion;

            expect(validar).toThrow("La anticipación del aviso debe ser un número entero de días mayor que cero y menor que la vigencia.");
        },
    );

    it("rechaza una vigencia de un día con avisos porque no admite una anticipación positiva menor", () => {
        Object.assign(configuracion, { diasVigencia: 1, diasAnticipacionAviso: 1 });

        expect(validar).toThrow("La anticipación del aviso debe ser un número entero de días mayor que cero y menor que la vigencia.");
    });

    it("admite una vigencia de un día sin avisos e ignora la anticipación inactiva", () => {
        Object.assign(configuracion, { diasVigencia: 1, avisosHabilitados: false, diasAnticipacionAviso: "" });

        expect(validar()).toEqual({ habilitado: true, diasVigencia: 1, avisosHabilitados: false, diasAnticipacionAviso: 0 });
    });

    it.each([undefined, null, "true", "false", 1, 0])("rechaza la habilitación inválida de avisos: %s", (habilitado) => {
        configuracion.avisosHabilitados = habilitado;

        expect(validar).toThrow("La habilitación de los avisos de fotos debe ser verdadera o falsa.");
    });
});

describe("límite de antigüedad de fotos", () => {
    it("resta días de calendario en Montevideo", () => {
        expect(obtenerLimiteAntiguedadFotos(30, "2026-11-04T12:00:00Z")).toBe("2026-10-05T12:00:00Z");
    });
});
