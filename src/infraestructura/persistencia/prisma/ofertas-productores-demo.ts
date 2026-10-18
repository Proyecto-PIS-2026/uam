import type { ConsultaUam } from "./catalogo-consulta";

export type OfertaProductorDemo = {
  producerUsername: string;
  speciesId: number;
  speciesName: string;
  variety: string;
  measureUnit: string;
  caliber: string;
  country: string;
  category: string;
  price: number | null;
  quantity: number;
  available: boolean;
};

// Cada establecimiento tiene su propio surtido. Las especies repetidas usan
// variedades, presentaciones o categorías distintas del catálogo UAM.
const PLAN_OFERTAS: ReadonlyArray<readonly [string, string, readonly string[]]> = [
  ["productor_norte_salto", "URUGUAY", [
    "Mandarina", "Naranja", "Limón", "Pomelo", "Quinoto",
    "Mandarina", "Naranja", "Mandarina", "Naranja",
  ]],
  ["productor_canelones_verde", "URUGUAY", [
    "Tomate", "Lechuga", "Morrón", "Pepino", "Berenjena",
    "Zapallito", "Zucchini", "Brócoli", "Acelga",
  ]],
  ["productor_san_jose_agro", "URUGUAY", [
    "Papa", "Boniato", "Zanahoria", "Cebolla", "Zapallo",
    "Calabacín", "Calabaza", "Ajo",
  ]],
  ["productor_tacuarembo_frut", "URUGUAY", [
    "Manzana", "Pera", "Caqui", "Frutilla", "Arándano",
    "Manzana", "Pera", "Manzana",
  ]],
  ["productor_maldonado_organico", "URUGUAY", [
    "Lechuga", "Rucula", "Espinaca", "Kale", "Remolacha",
    "Rabanito", "Apio", "Cebolla Verdeo",
  ]],
  // El catálogo tiene dos bandas ecuatorianas de banana: categorías E e I.
  ["bananera_ecuatoriana_sa", "ECUADOR", ["Banana", "Banana"]],
];

type BandaProductor = Omit<OfertaProductorDemo,
  "producerUsername" | "price" | "quantity" | "available"> & {
  minimumPrice: number;
  maximumPrice: number;
};

function claveProducto(oferta: Pick<OfertaProductorDemo,
  "speciesId" | "variety" | "measureUnit" | "caliber" | "category">): string {
  return JSON.stringify([
    oferta.speciesId, oferta.variety, oferta.measureUnit,
    oferta.caliber, oferta.category,
  ]);
}

function bandasDeCatalogo(catalogo: ConsultaUam): BandaProductor[] {
  return catalogo.types.flatMap((tipo) => tipo.products.flatMap((producto) =>
    producto.varieties.flatMap((variedad) => variedad.presentations.flatMap((presentacion) =>
      presentacion.prices.map((banda) => ({
        speciesId: producto.species_id,
        speciesName: producto.species,
        variety: variedad.variety,
        measureUnit: presentacion.measure_unit,
        caliber: presentacion.caliber,
        country: presentacion.country,
        category: banda.category,
        minimumPrice: banda.min_un,
        maximumPrice: banda.max_un,
      }))
    ))
  ));
}

function precioEnBanda(minimo: number, maximo: number): number | null {
  const primerEntero = Math.ceil(minimo);
  const ultimoEntero = Math.floor(maximo);
  if (primerEntero > ultimoEntero) return null;
  return Math.max(primerEntero, Math.min(ultimoEntero, Math.round((minimo + maximo) / 2)));
}

function cantidadDisponible(unidad: string, indice: number): number {
  switch (unidad) {
    case "KG": return 150 + (indice % 8) * 75;
    case "DOC": return 10 + (indice % 6) * 5;
    case "CAB": return 40 + (indice % 5) * 20;
    default: return 30 + (indice % 6) * 10;
  }
}

export function crearOfertasProductoresDemo(catalogo: ConsultaUam): OfertaProductorDemo[] {
  const bandas = bandasDeCatalogo(catalogo);
  const ofertas: OfertaProductorDemo[] = [];

  for (const [producerUsername, country, especies] of PLAN_OFERTAS) {
    const productosPublicados = new Set<string>();
    const variedadesPublicadas = new Set<string>();

    for (const [indice, especie] of especies.entries()) {
      const candidatas = bandas.filter((banda) =>
        banda.speciesName === especie && banda.country === country &&
        !productosPublicados.has(claveProducto(banda))
      );
      const banda = candidatas.find((candidata) =>
        !variedadesPublicadas.has(JSON.stringify([candidata.speciesId, candidata.variety]))
      ) ?? candidatas[0];
      if (!banda) {
        throw new Error(`No hay una banda distinta para ${producerUsername}: ${especie} (${country})`);
      }

      productosPublicados.add(claveProducto(banda));
      variedadesPublicadas.add(JSON.stringify([banda.speciesId, banda.variety]));
      const available = indice !== 6;
      ofertas.push({
        producerUsername,
        speciesId: banda.speciesId,
        speciesName: banda.speciesName,
        variety: banda.variety,
        measureUnit: banda.measureUnit,
        caliber: banda.caliber,
        country: banda.country,
        category: banda.category,
        price: indice === 3 ? null : precioEnBanda(banda.minimumPrice, banda.maximumPrice),
        quantity: available ? cantidadDisponible(banda.measureUnit, indice + ofertas.length) : 0,
        available,
      });
    }
  }

  return ofertas;
}
