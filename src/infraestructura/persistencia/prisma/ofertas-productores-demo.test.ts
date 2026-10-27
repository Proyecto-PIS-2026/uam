// @vitest-environment node

import { describe, expect, it } from "vitest";
import { cargarConsultaUam } from "./catalogo-consulta";
import { crearOfertasProductoresDemo, type OfertaProductorDemo } from "./ofertas-productores-demo";

function claveBanda(oferta: Pick<OfertaProductorDemo,
  "speciesId" | "variety" | "measureUnit" | "caliber" | "country" | "category">): string {
  return JSON.stringify([
    oferta.speciesId, oferta.variety, oferta.measureUnit,
    oferta.caliber, oferta.country, oferta.category,
  ]);
}

describe("ofertas de demostración de productores", () => {
  const catalogo = cargarConsultaUam();
  const ofertas = crearOfertasProductoresDemo(catalogo);
  const cantidadesEsperadas: Record<string, number> = {
    productor_norte_salto: 9,
    productor_canelones_verde: 9,
    productor_san_jose_agro: 8,
    productor_tacuarembo_frut: 8,
    productor_maldonado_organico: 8,
    bananera_ecuatoriana_sa: 2,
  };

  it("usa bandas reales, precios por la unidad publicada y el país del productor, sin duplicados", () => {
    const bandas = new Map<string, { nombre: string; minimo: number; maximo: number }>();
    for (const tipo of catalogo.types) {
      for (const producto of tipo.products) {
        for (const variedad of producto.varieties) {
          for (const presentacion of variedad.presentations) {
            for (const precio of presentacion.prices) {
              bandas.set(claveBanda({
                speciesId: producto.species_id,
                variety: variedad.variety,
                measureUnit: presentacion.measure_unit,
                caliber: presentacion.caliber,
                country: presentacion.country,
                category: precio.category,
              }), {
                nombre: producto.species,
                minimo: precio.min_un,
                maximo: precio.max_un,
              });
            }
          }
        }
      }
    }

    const publicadas = new Set<string>();
    for (const oferta of ofertas) {
      const banda = bandas.get(claveBanda(oferta));
      expect(banda, claveBanda(oferta)).toBeDefined();
      expect(oferta.speciesName).toBe(banda!.nombre);
      expect(oferta.country).toBe(oferta.producerUsername === "bananera_ecuatoriana_sa" ? "ECUADOR" : "URUGUAY");
      const clave = JSON.stringify([
        oferta.producerUsername, oferta.speciesId, oferta.variety,
        oferta.measureUnit, oferta.caliber, oferta.category,
      ]);
      expect(publicadas.has(clave), clave).toBe(false);
      publicadas.add(clave);
      if (oferta.price !== null) {
        expect(oferta.price).toBeGreaterThanOrEqual(banda!.minimo);
        expect(oferta.price).toBeLessThanOrEqual(banda!.maximo);
      }
      expect(Number.isInteger(oferta.quantity)).toBe(true);
      if (oferta.available) expect(oferta.quantity).toBeGreaterThan(0);
      else expect(oferta.quantity).toBe(0);
    }

    expect(ofertas).toHaveLength(44);
    expect(crearOfertasProductoresDemo(catalogo)).toEqual(ofertas);
    expect(ofertas.some((oferta) => oferta.price === null)).toBe(true);
    expect(ofertas.some((oferta) => !oferta.available)).toBe(true);
    expect(ofertas.filter((oferta) => oferta.available).length).toBeGreaterThan(ofertas.length / 2);
  });

  it("da surtidos propios a las seis cuentas y conserva las especializaciones", () => {
    expect(new Set(ofertas.map((oferta) => oferta.producerUsername))).toEqual(
      new Set(Object.keys(cantidadesEsperadas))
    );
    for (const [username, cantidad] of Object.entries(cantidadesEsperadas)) {
      const delProductor = ofertas.filter((oferta) => oferta.producerUsername === username);
      expect(delProductor).toHaveLength(cantidad);
      expect(delProductor.some((oferta) => oferta.available)).toBe(true);
      if (username !== "bananera_ecuatoriana_sa") {
        expect(new Set(delProductor.map((oferta) => oferta.speciesId)).size).toBeGreaterThanOrEqual(5);
      }
    }

    const citricos = ofertas.filter((oferta) => oferta.producerUsername === "productor_norte_salto");
    expect(citricos.every((oferta) => ["Mandarina", "Naranja", "Limón", "Pomelo", "Quinoto"].includes(oferta.speciesName))).toBe(true);
    expect(new Set(citricos.filter((oferta) => oferta.speciesName === "Mandarina").map((oferta) => oferta.variety)).size).toBe(3);
    const frutas = ofertas.filter((oferta) => oferta.producerUsername === "productor_tacuarembo_frut");
    expect(frutas.every((oferta) => ["Manzana", "Pera", "Caqui", "Frutilla", "Arándano"].includes(oferta.speciesName))).toBe(true);

    const bananas = ofertas.filter((oferta) => oferta.producerUsername === "bananera_ecuatoriana_sa");
    expect(bananas.every((oferta) => oferta.speciesName === "Banana")).toBe(true);
    expect(new Set(bananas.map((oferta) => oferta.category))).toEqual(new Set(["E", "I"]));
    expect(bananas.every((oferta) => oferta.country === "ECUADOR")).toBe(true);
  });
});
