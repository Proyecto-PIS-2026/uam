// @vitest-environment node

import { describe, expect, it } from "vitest";
import { cargarConsultaUam } from "./catalogo-consulta";
import { crearOfertasDemo, type OfertaDemo } from "./ofertas-demo";

const generalesSinBanana = [
  "jorge_ferias", "pablo_sappa", "diego_figueroa", "bacigalupi", "lucas_blanco",
];
const generalesTodo = ["don_juan", "caporale", "punto_natural"];
const especialistas = [
  "britos_hns", "ciro_gentile", "guarino", "pizzorno", "pepe",
  "sandias_de_rivera", "citricola_salto_grande",
];

function claveBanda(oferta: Pick<OfertaDemo,
  "classificationId" | "speciesId" | "variety" | "measureUnit" | "caliber" | "country" | "category">): string {
  return JSON.stringify([
    oferta.classificationId, oferta.speciesId, oferta.variety,
    oferta.measureUnit, oferta.caliber, oferta.country, oferta.category,
  ]);
}

describe("ofertas de demostración de los operadores UAM", () => {
  const catalogo = cargarConsultaUam();
  const ofertas = crearOfertasDemo(catalogo);
  const nombresPorId = new Map(catalogo.types.flatMap((tipo) =>
    tipo.products.map((producto) => [producto.species_id, producto.species] as const)
  ));

  it("publica una muestra acotada de bandas, con precios válidos y sin duplicados por operador", () => {
    const bandas = new Map<string, { min: number; max: number }[]>();
    for (const tipo of catalogo.types) {
      for (const producto of tipo.products) {
        for (const variedad of producto.varieties) {
          for (const presentacion of variedad.presentations) {
            for (const precio of presentacion.prices) {
              const clave = claveBanda({
                classificationId: tipo.classification_id,
                speciesId: producto.species_id,
                variety: variedad.variety,
                measureUnit: presentacion.measure_unit,
                caliber: presentacion.caliber,
                country: presentacion.country,
                category: precio.category,
              });
              const bandasParaProducto = bandas.get(clave) ?? [];
              bandasParaProducto.push({ min: precio.min_un, max: precio.max_un });
              bandas.set(clave, bandasParaProducto);
            }
          }
        }
      }
    }

    const clavesPorOperador = new Set<string>();
    const bandasPublicadas = new Set<string>();
    for (const oferta of ofertas) {
      const clave = claveBanda(oferta);
      const bandasOriginales = bandas.get(clave);
      expect(bandasOriginales).toBeDefined();
      bandasPublicadas.add(clave);

      const claveUnica = JSON.stringify([
        oferta.operatorUsername, oferta.speciesId, oferta.variety,
        oferta.measureUnit, oferta.category, oferta.caliber,
      ]);
      expect(clavesPorOperador.has(claveUnica)).toBe(false);
      clavesPorOperador.add(claveUnica);

      if (oferta.price !== null) {
        expect(Number.isInteger(oferta.price)).toBe(true);
        expect(bandasOriginales!.some((banda) =>
          oferta.price! >= banda.min && oferta.price! <= banda.max
        )).toBe(true);
      }
    }

    expect(ofertas).toHaveLength(74);
    expect(ofertas.length).toBeLessThanOrEqual(75);
    expect(bandasPublicadas.size).toBeLessThan(bandas.size);
    expect(crearOfertasDemo(catalogo)).toEqual(ofertas);
    expect(ofertas.some((oferta) => oferta.price === null)).toBe(true);
    expect(ofertas.some((oferta) => !oferta.available)).toBe(true);
    expect(ofertas.some((oferta) => !oferta.active)).toBe(true);
  });

  it("limita los especialistas a sus productos y les da publicaciones visibles", () => {
    expect(new Set(ofertas.map((oferta) => oferta.operatorUsername))).toEqual(
      new Set([...generalesSinBanana, ...generalesTodo, ...especialistas])
    );

    const especiesEsperadas: Record<string, string> = {
      britos_hns: "Papa",
      ciro_gentile: "Banana",
      pizzorno: "Manzana",
      pepe: "Banana",
      sandias_de_rivera: "Sandía",
    };
    for (const [username, especie] of Object.entries(especiesEsperadas)) {
      const publicadas = ofertas.filter((oferta) => oferta.operatorUsername === username);
      expect(publicadas.length).toBeGreaterThan(0);
      expect(publicadas.every((oferta) => nombresPorId.get(oferta.speciesId) === especie)).toBe(true);
      expect(publicadas.some((oferta) => oferta.active && oferta.available)).toBe(true);
    }
    for (const username of ["guarino", "citricola_salto_grande"]) {
      const publicadas = ofertas.filter((oferta) => oferta.operatorUsername === username);
      expect(publicadas.length).toBeGreaterThan(0);
      expect(publicadas.every((oferta) => oferta.classificationId === 5)).toBe(true);
      expect(publicadas.some((oferta) => oferta.active && oferta.available)).toBe(true);
    }
    for (const username of ["britos_hns", "pizzorno"]) {
      const variedades = ofertas
        .filter((oferta) => oferta.operatorUsername === username)
        .map((oferta) => oferta.variety);
      expect(new Set(variedades).size).toBeGreaterThan(1);
    }
  });

  it("da surtidos parciales y visibles a los operadores generales", () => {
    const cantidades = new Set<number>();
    for (const username of [...generalesSinBanana, ...generalesTodo]) {
      const publicadas = ofertas.filter((oferta) => oferta.operatorUsername === username);
      cantidades.add(publicadas.length);
      expect(publicadas.some((oferta) => oferta.active && oferta.available)).toBe(true);
      if (generalesSinBanana.includes(username)) {
        expect(publicadas.some((oferta) => nombresPorId.get(oferta.speciesId) === "Banana")).toBe(false);
      }
    }
    expect(cantidades.size).toBeGreaterThan(1);
  });

  it("mantiene visibles las quince especies prioritarias de la portada", () => {
    const prioritarias = [
      "Papa", "Banana", "Naranja", "Manzana", "Tomate", "Cebolla", "Boniato",
      "Zanahoria", "Mandarina", "Morrón", "Sandía", "Limón", "Calabacín",
      "Zapallo", "Lechuga",
    ];
    const visibles = new Set(ofertas
      .filter((oferta) => oferta.active && oferta.available)
      .map((oferta) => nombresPorId.get(oferta.speciesId)));
    for (const especie of prioritarias) {
      expect(visibles.has(especie), especie).toBe(true);
    }
    expect(visibles.has("Acelga")).toBe(true);
    expect(visibles.has("Pera")).toBe(true);
  });
});
