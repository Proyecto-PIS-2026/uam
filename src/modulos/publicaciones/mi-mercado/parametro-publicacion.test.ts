import { describe, expect, it } from "vitest";
import { leerPublicacionInicialId } from "./parametro-publicacion";

describe("parámetro de publicación de Mi Mercado", () => {
    it.each(["1", "123", "2147483647"])("acepta el identificador positivo int32 %s", (valor) => {
        expect(leerPublicacionInicialId(valor)).toBe(Number(valor));
    });

    it.each([undefined, "", "0", "-1", "1.5", "1e2", " 12", "12 ", "12x", "Infinity", "2147483648", "9007199254740993", ["1", "2"]].map((valor) => ({ valor })))(
        "ignora el identificador inválido $valor",
        ({ valor }) => expect(leerPublicacionInicialId(valor)).toBeNull(),
    );
});
