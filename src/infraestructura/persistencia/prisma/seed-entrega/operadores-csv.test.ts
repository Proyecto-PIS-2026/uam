// @vitest-environment node

import { describe, expect, it } from "vitest";
import { leerOperadoresCsv, parsearOperadoresCsv } from "./operadores-csv";

const cabecera = "Nave (filtro);Operador;Nombre corto;Locales;Puertas;Naves";
const csv = (...filas: string[]) => [cabecera, ...filas].join("\r\n");

describe("operadores del CSV de entrega", () => {
  it("conserva todos los operadores y las puertas conocidas del archivo sin repetir los de varias naves", () => {
    const operadores = leerOperadoresCsv();
    expect(operadores).toHaveLength(388);
    expect(new Set(operadores.map(({ username }) => username)).size).toBe(388);
    expect(operadores.filter(({ locales }) => !locales.length)).toHaveLength(17);
    expect(operadores.flatMap(({ locales }) => locales)).toHaveLength(563);
    expect(operadores.find(({ username }) => username === "ciro_gentile_s_a")?.locales).toEqual([
      { nave: "A", numero: "67" }, { nave: "A", numero: "69" },
      { nave: "A", numero: "71" }, { nave: "A", numero: "73" },
      { nave: "B", numero: "16" }, { nave: "D", numero: "15" },
    ]);
    expect(operadores.find(({ username }) => username === "mendez_rodriguez_carmen_maria")?.locales)
      .toEqual([{ nave: "MP - A", numero: "73" }]);
  });

  it("agrupa el nombre completo y deduplica las mismas puertas aunque cambien el orden y los ceros iniciales", () => {
    const operadores = parsearOperadoresCsv(csv(
      "MFH - A;JOSE  PEREZ;JOSE;2;A001 B2;MFH - A, MFH - B",
      "MFH - B;jose perez;JOSE;2;B02 A1;MFH - A, MFH - B",
    ));
    expect(operadores).toEqual([{
      username: "jose_perez", nombreFantasia: "JOSE PEREZ",
      locales: [{ nave: "A", numero: "1" }, { nave: "B", numero: "2" }],
    }]);
  });

  it("lee BOM, punto y coma dentro de comillas y comillas escapadas", () => {
    const [operador] = parsearOperadoresCsv(`\uFEFF${csv(
      'MFH - A;"SOCIEDAD; ""EL SUR""";SUR;1;A12;MFH - A',
    )}\r\n`);
    expect(operador.nombreFantasia).toBe('SOCIEDAD; "EL SUR"');
    expect(operador.username).toBe("sociedad_el_sur");
  });

  it("no inventa puertas a partir del total ni toma Nave (filtro) como ubicación de todas las puertas", () => {
    const operadores = parsearOperadoresCsv(csv(
      "MFH - A;SIN PUERTA;SIN;4;—;MFH - A",
      "MFH - D;CON PUERTAS;CON;8;D2 NAL4 J3 C6 8;MFH - D, NAL - A, ZAC - J, MP - A, ZAC - I",
    ));
    expect(operadores.find(({ username }) => username === "sin_puerta")?.locales).toEqual([]);
    expect(operadores.find(({ username }) => username === "con_puertas")?.locales).toEqual([
      { nave: "D", numero: "2" }, { nave: "MP - A", numero: "6" },
      { nave: "NAL - A", numero: "4" }, { nave: "ZAC - I", numero: "8" },
      { nave: "ZAC - J", numero: "3" },
    ]);
  });

  it("produce usernames sin acentos y resuelve colisiones sin depender del orden", () => {
    const filas = [
      "MFH - A;JOSÉ PÉREZ;JOSE;1;A1;MFH - A",
      "MFH - A;JOSE PEREZ;JOSE;1;A2;MFH - A",
      "MFH - A;RAMÓN NUÑE;RAMON;1;A3;MFH - A",
    ];
    const operadores = parsearOperadoresCsv(csv(...filas));
    expect(parsearOperadoresCsv(csv(...filas.reverse()))).toEqual(operadores);
    expect(new Set(operadores.map(({ username }) => username)).size).toBe(3);
    expect(operadores.map(({ username }) => username)).toContain("ramon_nune");
    expect(operadores.every(({ username }) => /^[a-z0-9_]+$/.test(username))).toBe(true);
  });

  it("rechaza asignar el mismo local a distintos operadores", () => {
    expect(() => parsearOperadoresCsv(csv(
      "MFH - A;UNO;UNO;1;A1;MFH - A",
      "MFH - A;OTRO;OTRO;1;A001;MFH - A",
    ))).toThrow("local A|1 asignado a UNO y OTRO");
  });

  it.each([
    ["A1 X5", "MFH - A", "puerta desconocida: X5"],
    ["B1", "MFH - A", "requiere la nave MFH - B"],
    ["8", "MFH - A", "requiere la nave ZAC - I"],
  ])("rechaza puertas desconocidas o naves contradictorias: %s", (puertas, naves, error) => {
    expect(() => parsearOperadoresCsv(csv(`MFH - A;UNO;UNO;1;${puertas};${naves}`))).toThrow(error);
  });

  it("rechaza una fuente vacía, una fila incompleta y comillas sin cerrar", () => {
    expect(() => parsearOperadoresCsv(cabecera)).toThrow("no hay operadores");
    expect(() => parsearOperadoresCsv(csv("MFH - A;UNO;UNO;1;A1"))).toThrow("cantidad de columnas");
    expect(() => parsearOperadoresCsv(csv('MFH - A;"UNO'))).toThrow("comillas sin cerrar");
    expect(() => parsearOperadoresCsv("Operador;Puertas\nUNO;A1")).toThrow("se esperaba la cabecera");
  });
});
