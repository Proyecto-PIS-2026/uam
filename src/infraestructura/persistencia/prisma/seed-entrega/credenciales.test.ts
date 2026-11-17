// @vitest-environment node

import { randomBytes } from "node:crypto";
import argon2 from "argon2";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { crearCuentasEntrega } from "./cuentas";
import { crearHashesIniciales } from "./credenciales";

const estadoMock = vi.hoisted(() => ({ aleatorio: 0, hash: 0 }));

vi.mock("argon2", () => {
  const hash = vi.fn(async () => `hash_simulado_${++estadoMock.hash}`);
  return { hash, argon2id: 2, default: { hash, argon2id: 2 } };
});

vi.mock("node:crypto", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:crypto")>();
  return {
    ...original,
    randomBytes: vi.fn((cantidad: number) => {
      const bytes = Buffer.alloc(cantidad);
      let contador = ++estadoMock.aleatorio;
      for (let indice = 0; indice < cantidad; indice++) {
        bytes[indice] = contador & 0xff;
        contador = Math.floor(contador / 256);
      }
      return bytes;
    }),
  };
});

const usernamesFijos = [
  "adminABorrar1", "adminABorrar2", "adminABorrar3", "adminABorrar4", "adminABorrar5",
  "op_aging", "op_vigencia", "op_locales", "productor_aging", "productor_vigencia",
];
const esFija = (username: string) => usernamesFijos.includes(username);
const entradasHash = () => vi.mocked(argon2.hash).mock.calls.map(([entrada]) => entrada.toString());
const formatoArgon2id = /^\$argon2id\$v=19\$m=[1-9]\d*,(?:t=[1-9]\d*,p=[1-9]\d*|p=[1-9]\d*,t=[1-9]\d*)\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$/;

describe("contraseñas iniciales de entrega", () => {
  const cuentas = crearCuentasEntrega();

  beforeEach(() => {
    vi.clearAllMocks();
    estadoMock.aleatorio = 0;
    estadoMock.hash = 0;
  });

  it("devuelve 403 hashes, reutiliza diez hashes fijos y genera 393 contraseñas aleatorias", async () => {
    const hashes = await crearHashesIniciales(cuentas);
    const entradas = entradasHash();
    expect(cuentas).toHaveLength(403);
    expect(hashes.size).toBe(403);
    expect(entradas.length).toBe(393);
    expect(cuentas.every((cuenta) => hashes.has(cuenta.identificadorIngreso))).toBe(true);
    expect(cuentas.filter((cuenta) => esFija(cuenta.username)).length).toBe(10);

    // Comparaciones booleanas: un fallo nunca debe imprimir contraseñas.
    expect(entradas.every((entrada) => entrada.length >= 42)).toBe(true);
    expect(new Set(entradas).size).toBe(393);
    expect(vi.mocked(randomBytes).mock.calls.length).toBe(393);

    const resultadosHash = await Promise.all(vi.mocked(argon2.hash).mock.results.map((resultado) => resultado.value));
    expect(new Set(hashes.values()).size).toBe(403);
    for (const cuenta of cuentas) {
      const hash = hashes.get(cuenta.identificadorIngreso)!;
      expect(esFija(cuenta.username) ? formatoArgon2id.test(hash) : resultadosHash.includes(hash)).toBe(true);
    }
    expect(cuentas.filter((cuenta) => /^admin[1-5]$/.test(cuenta.username))
      .every((cuenta) => resultadosHash.includes(hashes.get(cuenta.identificadorIngreso)!))).toBe(true);
  });

  it("genera otras 393 contraseñas en cada ejecución y devuelve Maps independientes", async () => {
    const primera = await crearHashesIniciales(cuentas);
    const entradasPrimera = entradasHash();
    const segunda = await crearHashesIniciales(cuentas);
    const entradasSegunda = entradasHash().slice(entradasPrimera.length);
    const aleatoriasPrimera = new Set(entradasPrimera);
    expect(aleatoriasPrimera.size).toBe(393);
    expect(entradasSegunda.length).toBe(393);
    expect(new Set(entradasSegunda).size).toBe(393);
    expect(entradasSegunda.every((entrada) => entrada.length >= 42 && !aleatoriasPrimera.has(entrada))).toBe(true);
    expect(cuentas.filter((cuenta) => esFija(cuenta.username)).every((cuenta) =>
      primera.get(cuenta.identificadorIngreso) === segunda.get(cuenta.identificadorIngreso),
    )).toBe(true);
    expect(primera === segunda).toBe(false);
    primera.clear();
    expect(segunda.size).toBe(403);
  });

  it("devuelve las diez excepciones sin generar ni hashear contraseñas en ejecución", async () => {
    const fijas = cuentas.filter((cuenta) => esFija(cuenta.username));
    const hashes = await crearHashesIniciales(fijas);
    expect(hashes.size).toBe(10);
    expect([...hashes.values()].every((hash) => formatoArgon2id.test(hash))).toBe(true);
    expect(vi.mocked(argon2.hash).mock.calls.length).toBe(0);
    expect(vi.mocked(randomBytes).mock.calls.length).toBe(0);
  });

  it("no extiende las excepciones a prefijos parecidos ni a cambios de mayúsculas", async () => {
    const similares = ["adminABorrar0", "adminABorrar6", "adminABorrar1_extra", "OP_AGING"]
      .map((username) => ({ username, identificadorIngreso: username }));
    const hashes = await crearHashesIniciales(similares);
    const entradas = entradasHash();
    expect(hashes.size).toBe(similares.length);
    expect(entradas.length).toBe(similares.length);
    expect(entradas.every((entrada) => entrada.length >= 42)).toBe(true);
    expect(vi.mocked(randomBytes).mock.calls.length).toBe(similares.length);
  });

  it("rechaza una lista vacía antes de generar contraseñas", async () => {
    await expect(crearHashesIniciales([])).rejects.toThrow();
    expect(vi.mocked(argon2.hash).mock.calls.length).toBe(0);
    expect(vi.mocked(randomBytes).mock.calls.length).toBe(0);
  });

  it("rechaza usernames duplicados antes de generar contraseñas", async () => {
    await expect(crearHashesIniciales([
      { username: "duplicado", identificadorIngreso: "primero" },
      { username: "duplicado", identificadorIngreso: "segundo" },
    ])).rejects.toThrow();
    expect(vi.mocked(argon2.hash).mock.calls.length).toBe(0);
    expect(vi.mocked(randomBytes).mock.calls.length).toBe(0);
  });

  it("rechaza identificadores de ingreso duplicados antes de generar contraseñas", async () => {
    await expect(crearHashesIniciales([
      { username: "primero", identificadorIngreso: "duplicado" },
      { username: "segundo", identificadorIngreso: "duplicado" },
    ])).rejects.toThrow();
    expect(vi.mocked(argon2.hash).mock.calls.length).toBe(0);
    expect(vi.mocked(randomBytes).mock.calls.length).toBe(0);
  });
});
