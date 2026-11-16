// @vitest-environment node

import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fotoOperador } from "./fotos-operadores-demo";

describe("fotos de demostración de los operadores", () => {
  const archivos = new Map(
    readdirSync(new URL("../../../../public/operadores/", import.meta.url))
      .map((archivo) => [archivo.toLocaleLowerCase("es"), archivo]),
  );

  it.each([
    ["Jorge Ferias", "jorge-ferias.webp"],
    ["Pablo Sappa", "pablo-sappa.webp"],
    ["Diego Figueroa", "diego-figueroa.webp"],
    ["Bacigalupi", "bacigalupi.webp"],
    ["Lucas Blanco", "lucas-blanco.webp"],
    ["Britos HNS", "britos-hns.png"],
    ["Ciro Gentile", "ciro-gentile.jfif"],
    ["Guarino", "guarino.jfif"],
    ["Pizzorno", "pizzorno.png"],
    ["Don Juan", "don-juan.jfif"],
    ["Caporale", "caporale.jfif"],
    ["Punto Natural", "punto-natural.jfif"],
    ["Pepe", "pepe.jfif"],
    ["Sandias de Rivera", "sandias-de-rivera.jfif"],
    ["Citricola Salto Grande", "citricola-salto-grande.webp"],
  ])("encuentra el archivo existente de %s", (nombre, archivo) => {
    expect(fotoOperador(nombre, archivos)).toBe(`/operadores/${archivo}`);
  });

  it("normaliza acentos, mayúsculas y espacios adicionales", () => {
    expect(fotoOperador("  CÍTRICOLA   SALTO GRANDE  ", archivos))
      .toBe("/operadores/citricola-salto-grande.webp");
  });

  it("conserva las mayúsculas del nombre de archivo real", () => {
    expect(fotoOperador("Jorge Ferias", new Map([["jorge-ferias.jpg", "Jorge-Ferias.JPG"]])))
      .toBe("/operadores/Jorge-Ferias.JPG");
  });

  it("no asigna una ruta si el operador no tiene un archivo de foto", () => {
    expect(fotoOperador("Operador Inhabilitado", archivos)).toBeNull();
    expect(fotoOperador("Jorge Ferias", new Map())).toBeNull();
  });
});
