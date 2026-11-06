// @vitest-environment node

import { describe, expect, it } from "vitest";
import { atributosPublicacionDemo } from "./atributos-publicacion-demo";
import { CALIBRES_GENERALES_ADICIONALES, ENVASES_PUBLICACION, KILOS_EMPAQUETADO } from "./catalogos-publicacion";

describe("atributos de las publicaciones de demostración", () => {
  const atributos = Array.from({ length: 74 }, (_, indice) => atributosPublicacionDemo(indice));

  it("incluye publicaciones con ambos datos, cada dato por separado y ambos vacíos", () => {
    expect(atributos.some(({ envase, kilos }) => envase !== null && kilos !== null)).toBe(true);
    expect(atributos.some(({ envase, kilos }) => envase !== null && kilos === null)).toBe(true);
    expect(atributos.some(({ envase, kilos }) => envase === null && kilos !== null)).toBe(true);
    expect(atributos.some(({ envase, kilos }) => envase === null && kilos === null)).toBe(true);
  });

  it("usa todos los envases, kilos y calibres nuevos sin convertir los rangos a números", () => {
    expect(new Set(atributos.map(({ envase }) => envase).filter(Boolean))).toEqual(new Set(ENVASES_PUBLICACION));
    expect(new Set(atributos.map(({ kilos }) => kilos).filter(Boolean))).toEqual(new Set(KILOS_EMPAQUETADO));
    expect(new Set(atributos.map(({ calibre }) => calibre).filter(Boolean))).toEqual(new Set(CALIBRES_GENERALES_ADICIONALES));
    expect(atributos.some(({ kilos }) => kilos === "10-12")).toBe(true);
    expect(atributos.some(({ kilos }) => kilos === "18-24")).toBe(true);
  });

  it("también representa las cuatro variantes y todos los calibres nuevos entre productores", () => {
    const productores = atributos.slice(0, 44);
    expect(new Set(productores.map(({ envase, kilos }) => `${envase !== null}:${kilos !== null}`)).size).toBe(4);
    expect(new Set(productores.map(({ calibre }) => calibre).filter(Boolean))).toEqual(new Set(CALIBRES_GENERALES_ADICIONALES));
  });
});
