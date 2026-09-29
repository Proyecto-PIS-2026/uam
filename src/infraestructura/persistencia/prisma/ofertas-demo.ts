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

// Cada grupo de operadores se especializa en las clasificaciones de la consulta.
// Todos los nombres corresponden a cuentas creadas por seed.ts.
const OPERADORES_POR_CLASIFICACION: Record<number, readonly string[]> = {
  1: ["huerta_central", "granja_del_sur", "mercado_verde", "frescos_del_prado"],
  2: ["frutas_del_plata", "agro_este", "mercado_verde", "agro_montevideo"],
  3: ["frutas_del_plata", "campos_litoral", "cosechas_norte", "agro_este"],
  4: ["huerta_central", "granja_del_sur", "produccion_oriental"],
  5: ["frutas_del_plata", "campos_litoral", "agro_este", "cosechas_norte"],
  6: ["campos_litoral", "produccion_oriental", "agro_montevideo", "cooperativa_4_estaciones"],
  7: ["granja_del_sur", "huerta_central", "agro_este", "cooperativa_4_estaciones"],
  8: ["cooperativa_4_estaciones", "produccion_oriental"],
  11: ["granja_del_sur"],
  12: ["huerta_central", "mercado_verde", "frescos_del_prado"],
  13: ["frescos_del_prado", "mercado_verde"],
  14: ["cooperativa_4_estaciones", "mercado_verde", "agro_montevideo"],
};

// Un operador no puede publicar dos veces la misma combinación, incluso si el
// origen cambia. La aplicación comprueba esta clave al dar de alta productos.
function claveProducto(oferta: Pick<OfertaDemo, "speciesId" | "variety" | "measureUnit" | "category" | "caliber">): string {
  return JSON.stringify([
    oferta.speciesId,
    oferta.variety,
    oferta.measureUnit,
    oferta.category,
    oferta.caliber,
  ]);
}

function precioEnteroEnBanda(minimo: number, maximo: number): number | null {
  const primerEntero = Math.ceil(minimo);
  const ultimoEntero = Math.floor(maximo);
  if (primerEntero > ultimoEntero) return null;

  const puntoMedio = Math.round((minimo + maximo) / 2);
  return Math.max(primerEntero, Math.min(ultimoEntero, puntoMedio));
}

export function crearOfertasDemo(catalogo: ConsultaUam): OfertaDemo[] {
  const ofertas: OfertaDemo[] = [];
  const productosPorOperador = new Set<string>();
  const variedadesConOferta = new Set<string>();

  for (const tipo of catalogo.types) {
    const operadores = OPERADORES_POR_CLASIFICACION[tipo.classification_id];
    if (!operadores) {
      throw new Error(`No hay operadores de demo para la clasificación ${tipo.classification_id}: ${tipo.classification}`);
    }

    for (const producto of tipo.products) {
      for (const [indiceVariedad, variedad] of producto.varieties.entries()) {
        for (const [indicePresentacion, presentacion] of variedad.presentations.entries()) {
          for (const [indiceBanda, banda] of presentacion.prices.entries()) {
            const clave = claveProducto({
              speciesId: producto.species_id,
              variety: variedad.variety,
              measureUnit: presentacion.measure_unit,
              category: banda.category,
              caliber: presentacion.caliber,
            });
            const indicePreferido =
              (producto.species_id + indiceVariedad + indicePresentacion + indiceBanda) % operadores.length;
            const operadorUsername = operadores
              .slice(indicePreferido)
              .concat(operadores.slice(0, indicePreferido))
              .find((username) => !productosPorOperador.has(`${username}\0${clave}`));

            if (!operadorUsername) {
              throw new Error(
                `No hay operador libre para ${producto.species}, ${variedad.variety}, ${presentacion.measure_unit}, ${banda.category}, ${presentacion.caliber}`,
              );
            }
            productosPorOperador.add(`${operadorUsername}\0${clave}`);

            const indiceOferta = ofertas.length;
            const claveVariedad = JSON.stringify([producto.species_id, variedad.variety]);
            const primeraOfertaVariedad = !variedadesConOferta.has(claveVariedad);
            variedadesConOferta.add(claveVariedad);
            // Unas pocas ofertas carecen de precio; las bandas sin un entero
            // también quedan sin precio porque el formulario sólo admite enteros.
            const precioDeBanda = precioEnteroEnBanda(banda.min_un, banda.max_un);
            ofertas.push({
              classificationId: tipo.classification_id,
              speciesId: producto.species_id,
              variety: variedad.variety,
              measureUnit: presentacion.measure_unit,
              caliber: presentacion.caliber,
              country: presentacion.country,
              category: banda.category,
              operatorUsername: operadorUsername,
              price: indiceOferta % 17 === 9 ? null : precioDeBanda,
              // Cada variedad conserva al menos una publicación visible en inicio.
              available: primeraOfertaVariedad || indiceOferta % 23 !== 6,
              active: primeraOfertaVariedad || indiceOferta % 41 !== 12,
            });
          }
        }
      }
    }
  }

  return ofertas;
}
