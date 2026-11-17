// @vitest-environment node

import { describe, expect, it } from "vitest";
import { crearCuentasEntrega, obtenerUsuariosSinLocal } from "./cuentas";
import type { OperadorCsv } from "./operadores-csv";

const operadorEjemplo = (): OperadorCsv => ({
  username: "empresa_ejemplo", nombreFantasia: "Empresa Ejemplo",
  locales: [{ nave: "A", numero: "1" }],
});

describe("cuentas de entrega", () => {
  it("incluye los 388 operadores del CSV, 10 administradores y 5 cuentas de prueba", () => {
    const cuentas = crearCuentasEntrega();
    expect(cuentas).toHaveLength(403);
    expect(cuentas.filter((cuenta) => cuenta.rol === "ADMINISTRADOR")).toHaveLength(10);
    expect(cuentas.filter((cuenta) => cuenta.rol === "OPERADOR")).toHaveLength(391);
    expect(cuentas.filter((cuenta) => cuenta.rol === "PRODUCTOR")).toHaveLength(2);
    expect(cuentas.filter((cuenta) => "escenario" in cuenta)).toHaveLength(5);
    expect(obtenerUsuariosSinLocal(cuentas)).toHaveLength(17);
    expect(new Set(cuentas.map((cuenta) => cuenta.username)).size).toBe(403);
    expect(new Set(cuentas.map((cuenta) => cuenta.identificadorIngreso)).size).toBe(403);
    for (const cuenta of cuentas) {
      if (cuenta.rol === "ADMINISTRADOR") continue;
      expect(cuenta.whatsapp).toBe("");
      if (cuenta.rol === "OPERADOR" && !cuenta.escenario) {
        expect(cuenta.locales.every((local) => local.finContrato === null)).toBe(true);
      }
    }
  });

  it("usa email para los administradores y conserva exactamente los nombres adminABorrar", () => {
    const cuentas = crearCuentasEntrega([]);
    const admins = cuentas.filter((cuenta) => cuenta.rol === "ADMINISTRADOR");
    const usernames = ["admin", "adminABorrar"].flatMap((prefijo) =>
      Array.from({ length: 5 }, (_, indice) => `${prefijo}${indice + 1}`),
    );
    expect(admins.map((cuenta) => cuenta.username)).toEqual(usernames);
    for (const cuenta of admins) {
      expect(cuenta.email).toBe(`${cuenta.username}@uam.com.uy`);
      expect(cuenta.identificadorIngreso).toBe(cuenta.email);
    }
    expect(cuentas.filter((cuenta) => cuenta.rol !== "ADMINISTRADOR")
      .every((cuenta) => cuenta.identificadorIngreso === cuenta.username)).toBe(true);
  });

  it("reserva locales de pruebas y fecha 16 vencimientos al fin de cada día de Uruguay", () => {
    const operadores = crearCuentasEntrega([]).filter((cuenta) => cuenta.rol === "OPERADOR");
    const aging = operadores.find((cuenta) => cuenta.username === "op_aging")!;
    const vigencia = operadores.find((cuenta) => cuenta.username === "op_vigencia")!;
    const contratos = operadores.find((cuenta) => cuenta.username === "op_locales")!;
    expect(aging.locales).toEqual([{ nave: "C - Polivalente", numero: "99001", finContrato: null }]);
    expect(vigencia.locales).toEqual([{ nave: "C - Polivalente", numero: "99002", finContrato: null }]);
    expect(contratos.locales).toHaveLength(16);
    expect(contratos.locales[0].finContrato).toBe("2026-11-16T02:59:59.999Z");
    expect(contratos.locales.at(-1)?.finContrato).toBe("2026-12-01T02:59:59.999Z");
    for (const [indice, local] of contratos.locales.entries()) {
      expect(local.nave).toBe("C - Polivalente");
      expect(local.numero).toBe(String(99115 + indice));
      const instante = new Date(local.finContrato!);
      expect(instante.toLocaleDateString("en-CA", { timeZone: "America/Montevideo" }))
        .toBe(`2026-11-${15 + indice}`);
      expect(instante.toLocaleTimeString("en-GB", { timeZone: "America/Montevideo", hour12: false }))
        .toBe("23:59:59");
    }
  });

  it("conserva operadores sin local y copia la fuente sin agregar escenarios ni alterar sus locales", () => {
    const original = operadorEjemplo();
    const sinLocal: OperadorCsv = { username: "sin_local", nombreFantasia: "Empresa sin local", locales: [] };
    const cuentas = crearCuentasEntrega([original, sinLocal]);
    expect(obtenerUsuariosSinLocal(cuentas)).toEqual(["sin_local"]);
    const importada = cuentas.find((cuenta) => cuenta.username === original.username)!;
    expect(importada).not.toHaveProperty("escenario");
    expect(importada).toMatchObject({
      rol: "OPERADOR", nombreFantasia: original.nombreFantasia, whatsapp: "",
      locales: [{ nave: "A", numero: "1", finContrato: null }],
    });
    expect(original).toEqual(operadorEjemplo());
    if (importada.rol === "OPERADOR") {
      importada.locales[0].numero = "2";
      expect(original.locales[0].numero).toBe("1");
    }
  });

  it("rechaza usernames duplicados entre CSV y cuentas reservadas sin distinguir mayúsculas", () => {
    for (const username of ["op_aging", "ADMIN1", "adminaborrar1", "productor_vigencia"]) {
      expect(() => crearCuentasEntrega([{ ...operadorEjemplo(), username }])).toThrow(/Username duplicado/);
    }
    const primero = operadorEjemplo();
    expect(() => crearCuentasEntrega([primero, { ...primero, nombreFantasia: "Otra empresa", locales: [] }]))
      .toThrow(/Username duplicado/);
  });

  it("rechaza nombres de fantasía repetidos tanto entre CSV como con las cuentas de prueba", () => {
    const primero = operadorEjemplo();
    expect(() => crearCuentasEntrega([primero, { username: "otra", nombreFantasia: " EMPRESA  EJEMPLO ", locales: [] }]))
      .toThrow(/Nombre de fantasía duplicado/);
    const prueba = crearCuentasEntrega([]).find((cuenta) => cuenta.rol === "PRODUCTOR")!;
    if (prueba.rol !== "PRODUCTOR") throw new Error("Falta el productor de pruebas.");
    expect(() => crearCuentasEntrega([{ ...primero, nombreFantasia: prueba.nombreFantasia }]))
      .toThrow(/Nombre de fantasía duplicado/);
  });

  it("rechaza locales compartidos con otras cuentas o con los locales reservados", () => {
    const primero = operadorEjemplo();
    expect(() => crearCuentasEntrega([primero, { ...primero, username: "otra", nombreFantasia: "Otra empresa" }]))
      .toThrow(/Local duplicado/);
    expect(() => crearCuentasEntrega([{ ...primero, locales: [{ nave: "c - polivalente", numero: "099001" }] }]))
      .toThrow(/Local duplicado/);
    expect(() => crearCuentasEntrega([{ ...primero, locales: [...primero.locales, ...primero.locales] }]))
      .toThrow(/Local duplicado/);
  });
});
