import { describe, expect, it } from "vitest";
import { textoVisibleNotificacion } from "./texto-visible";

describe("textoVisibleNotificacion", () => {
    it.each([
        "ha vencido el 2026-11-10 y ya no está disponible.",
        "está próxima a vencer el 2026-11-11.",
    ])("quita el identificador de los avisos anteriores: %s", (estado) => {
        expect(textoVisibleNotificacion(`Tu publicación de Papa (ID #123) ${estado}`))
            .toBe(`Tu publicación de Papa ${estado}`);
    });

    it.each([
        "Tu publicación de Papa está próxima a vencer el 2026-11-11.",
        "El contrato del local 123 de la nave A vence el 10/11/2026.",
        "La foto de tu publicación de Papa venció y fue eliminada. Podés cargar una nueva foto.",
        "La solicitud (ID #123) fue recibida.",
    ])("mantiene intactos los otros textos: %s", (texto) => {
        expect(textoVisibleNotificacion(texto)).toBe(texto);
    });
});
