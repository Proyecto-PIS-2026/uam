import { describe, expect, it } from "vitest";
import { fechasDePrueba, seleccionarEspeciesDePrueba } from "./escenarios-fechas";

describe("escenarios de fechas de la entrega", () => {
  it("cubre cada día del 15 al 30 de noviembre de 2026, inclusive", () => {
    expect(fechasDePrueba()).toEqual([
      "2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18",
      "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22",
      "2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26",
      "2026-11-27", "2026-11-28", "2026-11-29", "2026-11-30",
    ]);
  });

  it("requiere una especie con foto distinta por día y conserva el catálogo recibido", () => {
    const especies = Array.from({ length: 18 }, (_, id) => ({
      id, nombre: `Especie ${id}`, fotoEspecie: id === 0 ? null : `/generico/${id}.webp`,
    }));
    const original = structuredClone(especies);
    const seleccionadas = seleccionarEspeciesDePrueba(especies);
    expect(seleccionadas).toHaveLength(16);
    expect(new Set(seleccionadas.map((especie) => especie.id)).size).toBe(16);
    expect(seleccionadas.every((especie) => especie.fotoEspecie !== null)).toBe(true);
    expect(especies).toEqual(original);
    expect(() => seleccionarEspeciesDePrueba(especies.slice(0, 16))).toThrow("dieciséis especies");
  });
});
