import type { ConsultaUam } from "./catalogo-consulta";

export type OfertaDemo = {
  classificationId: number;
  speciesId: number;
  variety: string;
  measureUnit: string;
  caliber: string;
  country: string;
  category: string;
  operatorUsername: string;
  price: number | null;
  available: boolean;
  active: boolean;
};

const GENERALES_SIN_BANANA = [
  "jorge_ferias", "pablo_sappa", "diego_figueroa", "bacigalupi", "lucas_blanco",
] as const;
const GENERALES_TODO = ["don_juan", "caporale", "punto_natural"] as const;
const GENERALES = [...GENERALES_SIN_BANANA, ...GENERALES_TODO] as const;

// Surtidos deliberadamente parciales: 74 publicaciones entre los 15 operadores.
// Repetir una especie toma otra presentación o categoría de la consulta UAM.
const PLAN_OFERTAS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["jorge_ferias", ["Acelga", "Lechuga", "Tomate", "Cebolla", "Boniato", "Zanahoria", "Morrón", "Zapallo", "Pera"]],
  ["pablo_sappa", ["Papa", "Calabacín", "Naranja", "Limón", "Ajo", "Palta", "Repollo"]],
  ["diego_figueroa", ["Tomate", "Manzana", "Mandarina", "Brócoli", "Frutilla", "Pepino"]],
  ["bacigalupi", ["Boniato", "Cebolla", "Calabacín", "Zanahoria", "Morrón"]],
  ["lucas_blanco", ["Lechuga", "Acelga", "Zapallo", "Sandía"]],
  ["don_juan", ["Banana", "Papa", "Pera", "Uva", "Naranja", "Cebolla", "Morrón", "Tomate", "Huevos"]],
  ["caporale", ["Banana", "Manzana", "Zanahoria", "Lechuga", "Mandarina", "Frutilla", "Hongos"]],
  ["punto_natural", ["Banana", "Sandía", "Pomelo", "Rucula", "Tomate", "Boniato"]],
  ["britos_hns", ["Papa", "Papa", "Papa", "Papa"]],
  ["ciro_gentile", ["Banana", "Banana", "Banana"]],
  ["guarino", ["Limón", "Mandarina", "Naranja", "Pomelo"]],
  ["pizzorno", ["Manzana", "Manzana", "Manzana", "Manzana"]],
  ["pepe", ["Banana", "Banana"]],
  ["sandias_de_rivera", ["Sandía"]],
  ["citricola_salto_grande", ["Mandarina", "Naranja", "Quinoto"]],
];

type BandaDemo = Omit<OfertaDemo, "operatorUsername" | "price" | "available" | "active"> & {
  speciesName: string;
  minimumPrice: number;
  maximumPrice: number;
};

// La aplicación considera duplicada esta combinación para un mismo operador.
function claveProducto(oferta: Pick<OfertaDemo, "speciesId" | "variety" | "measureUnit" | "category" | "caliber">): string {
  return JSON.stringify([
    oferta.speciesId,
    oferta.variety,
    oferta.measureUnit,
    oferta.category,
    oferta.caliber,
  ]);
}

function claveOperadorProducto(username: string, banda: BandaDemo): string {
  return `${username}\0${claveProducto(banda)}`;
}

function nombreNormalizado(nombre: string): string {
  return nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
}

function generalesPara(banda: BandaDemo): readonly string[] {
  return nombreNormalizado(banda.speciesName) === "banana" ? GENERALES_TODO : GENERALES;
}

function especialistasPara(banda: BandaDemo): readonly string[] {
  if (banda.classificationId === 5) return ["guarino", "citricola_salto_grande"];

  switch (nombreNormalizado(banda.speciesName)) {
    case "papa": return ["britos_hns"];
    case "banana": return ["ciro_gentile", "pepe"];
    case "manzana": return ["pizzorno"];
    case "sandia": return ["sandias_de_rivera"];
    default: return [];
  }
}

function precioEnteroEnBanda(minimo: number, maximo: number): number | null {
  const primerEntero = Math.ceil(minimo);
  const ultimoEntero = Math.floor(maximo);
  if (primerEntero > ultimoEntero) return null;

  const puntoMedio = Math.round((minimo + maximo) / 2);
  return Math.max(primerEntero, Math.min(ultimoEntero, puntoMedio));
}

function bandasDeCatalogo(catalogo: ConsultaUam): BandaDemo[] {
  const bandas: BandaDemo[] = [];
  for (const tipo of catalogo.types) {
    for (const producto of tipo.products) {
      for (const variedad of producto.varieties) {
        for (const presentacion of variedad.presentations) {
          for (const banda of presentacion.prices) {
            bandas.push({
              classificationId: tipo.classification_id,
              speciesId: producto.species_id,
              speciesName: producto.species,
              variety: variedad.variety,
              measureUnit: presentacion.measure_unit,
              caliber: presentacion.caliber,
              country: presentacion.country,
              category: banda.category,
              minimumPrice: banda.min_un,
              maximumPrice: banda.max_un,
            });
          }
        }
      }
    }
  }
  return bandas;
}

export function crearOfertasDemo(catalogo: ConsultaUam): OfertaDemo[] {
  const bandas = bandasDeCatalogo(catalogo);
  const ofertas: OfertaDemo[] = [];
  const productosPorOperador = new Set<string>();
  const especiesConOfertaVisible = new Set<number>();
  const operadoresConOfertaVisible = new Set<string>();

  for (const [operatorUsername, especies] of PLAN_OFERTAS) {
    for (const especie of especies) {
      const candidatas = bandas.filter((candidata) =>
        nombreNormalizado(candidata.speciesName) === nombreNormalizado(especie) &&
        (generalesPara(candidata).includes(operatorUsername) || especialistasPara(candidata).includes(operatorUsername)) &&
        !productosPorOperador.has(claveOperadorProducto(operatorUsername, candidata))
      );
      const banda = candidatas.find((candidata) => !ofertas.some((oferta) =>
        oferta.operatorUsername === operatorUsername &&
        oferta.speciesId === candidata.speciesId &&
        oferta.variety === candidata.variety
      )) ?? candidatas[0];
      if (!banda) {
        throw new Error(`No hay banda válida para ${operatorUsername}: ${especie}`);
      }

      productosPorOperador.add(claveOperadorProducto(operatorUsername, banda));
      const indiceOferta = ofertas.length;
      const visibleNecesaria = !especiesConOfertaVisible.has(banda.speciesId) ||
        !operadoresConOfertaVisible.has(operatorUsername);
      const oferta: OfertaDemo = {
        classificationId: banda.classificationId,
        speciesId: banda.speciesId,
        variety: banda.variety,
        measureUnit: banda.measureUnit,
        caliber: banda.caliber,
        country: banda.country,
        category: banda.category,
        operatorUsername,
        price: indiceOferta % 17 === 9 ? null : precioEnteroEnBanda(banda.minimumPrice, banda.maximumPrice),
        available: visibleNecesaria || indiceOferta % 23 !== 6,
        active: visibleNecesaria || indiceOferta % 31 !== 23,
      };
      ofertas.push(oferta);
      if (oferta.available && oferta.active) {
        especiesConOfertaVisible.add(banda.speciesId);
        operadoresConOfertaVisible.add(operatorUsername);
      }
    }
  }

  return ofertas;
}
