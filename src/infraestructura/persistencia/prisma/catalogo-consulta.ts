import { readFileSync } from "node:fs";

export type ConsultaUam = {
  survey_date: string;
  types: {
    classification_id: number;
    classification: string;
    products: {
      species_id: number;
      species: string;
      varieties: {
        variety: string;
        presentations: {
          caliber: string;
          country: string;
          measure_unit: string;
          prices: {
            category: string;
            min_kg: number;
            max_kg: number;
            min_un: number;
            max_un: number;
            is_reference: boolean;
          }[];
        }[];
      }[];
    }[];
  }[];
};

type Registro = Record<string, unknown>;

const CALIBRES = new Set(["C", "EG", "G", "M", "SV"]);
const UNIDADES = new Set(["CAB", "DOC", "KG", "Unidad"]);
const CATEGORIAS = new Set(["-", "E", "I", "II"]);

function errorDeDatos(ruta: string, detalle: string): never {
  throw new Error(`consulta-uam.txt inválido en ${ruta}: ${detalle}`);
}

function objeto(valor: unknown, ruta: string): Registro {
  if (valor === null || typeof valor !== "object" || Array.isArray(valor)) {
    errorDeDatos(ruta, "se esperaba un objeto");
  }
  return valor as Registro;
}

function lista(valor: unknown, ruta: string): unknown[] {
  if (!Array.isArray(valor) || valor.length === 0) {
    errorDeDatos(ruta, "se esperaba una lista no vacía");
  }
  return valor;
}

function texto(valor: unknown, ruta: string): string {
  if (typeof valor !== "string" || valor.trim().length === 0) {
    errorDeDatos(ruta, "se esperaba un texto no vacío");
  }
  return valor;
}

function id(valor: unknown, ruta: string): number {
  if (typeof valor !== "number" || !Number.isSafeInteger(valor) || valor <= 0) {
    errorDeDatos(ruta, "se esperaba un identificador entero positivo");
  }
  return valor;
}

function precio(valor: unknown, ruta: string): number {
  if (typeof valor !== "number" || !Number.isFinite(valor) || valor <= 0) {
    errorDeDatos(ruta, "se esperaba un precio positivo y finito");
  }
  return valor;
}

function sinDuplicados<T>(vistos: Set<T>, valor: T, ruta: string): void {
  if (vistos.has(valor)) {
    errorDeDatos(ruta, `valor duplicado: ${String(valor)}`);
  }
  vistos.add(valor);
}

function clave(textoOriginal: string): string {
  return textoOriginal.normalize("NFC").toLocaleLowerCase("es");
}

function validarConsulta(valor: unknown): asserts valor is ConsultaUam {
  const consulta = objeto(valor, "$");
  const fecha = texto(consulta.survey_date, "survey_date");
  const instante = Date.parse(`${fecha}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !Number.isFinite(instante) || new Date(instante).toISOString().slice(0, 10) !== fecha) {
    errorDeDatos("survey_date", "se esperaba una fecha real en formato AAAA-MM-DD");
  }

  const idsClasificacion = new Set<number>();
  const nombresClasificacion = new Set<string>();
  const idsEspecie = new Set<number>();
  const nombresEspecie = new Set<string>();

  for (const [indiceTipo, tipoValor] of lista(consulta.types, "types").entries()) {
    const rutaTipo = `types[${indiceTipo}]`;
    const tipo = objeto(tipoValor, rutaTipo);
    sinDuplicados(idsClasificacion, id(tipo.classification_id, `${rutaTipo}.classification_id`), `${rutaTipo}.classification_id`);
    sinDuplicados(nombresClasificacion, clave(texto(tipo.classification, `${rutaTipo}.classification`)), `${rutaTipo}.classification`);

    for (const [indiceProducto, productoValor] of lista(tipo.products, `${rutaTipo}.products`).entries()) {
      const rutaProducto = `${rutaTipo}.products[${indiceProducto}]`;
      const producto = objeto(productoValor, rutaProducto);
      sinDuplicados(idsEspecie, id(producto.species_id, `${rutaProducto}.species_id`), `${rutaProducto}.species_id`);
      sinDuplicados(nombresEspecie, clave(texto(producto.species, `${rutaProducto}.species`)), `${rutaProducto}.species`);

      const nombresVariedad = new Set<string>();
      for (const [indiceVariedad, variedadValor] of lista(producto.varieties, `${rutaProducto}.varieties`).entries()) {
        const rutaVariedad = `${rutaProducto}.varieties[${indiceVariedad}]`;
        const variedad = objeto(variedadValor, rutaVariedad);
        sinDuplicados(nombresVariedad, clave(texto(variedad.variety, `${rutaVariedad}.variety`)), `${rutaVariedad}.variety`);

        const clavesPresentacion = new Set<string>();
        for (const [indicePresentacion, presentacionValor] of lista(variedad.presentations, `${rutaVariedad}.presentations`).entries()) {
          const rutaPresentacion = `${rutaVariedad}.presentations[${indicePresentacion}]`;
          const presentacion = objeto(presentacionValor, rutaPresentacion);
          const calibre = texto(presentacion.caliber, `${rutaPresentacion}.caliber`);
          const pais = texto(presentacion.country, `${rutaPresentacion}.country`);
          const unidad = texto(presentacion.measure_unit, `${rutaPresentacion}.measure_unit`);
          if (!CALIBRES.has(calibre)) errorDeDatos(`${rutaPresentacion}.caliber`, `calibre desconocido: ${calibre}`);
          if (!UNIDADES.has(unidad)) errorDeDatos(`${rutaPresentacion}.measure_unit`, `unidad desconocida: ${unidad}`);
          sinDuplicados(clavesPresentacion, `${clave(calibre)}\0${clave(pais)}\0${clave(unidad)}`, rutaPresentacion);

          const categorias = new Set<string>();
          let referencias = 0;
          for (const [indicePrecio, precioValor] of lista(presentacion.prices, `${rutaPresentacion}.prices`).entries()) {
            const rutaPrecio = `${rutaPresentacion}.prices[${indicePrecio}]`;
            const banda = objeto(precioValor, rutaPrecio);
            const categoria = texto(banda.category, `${rutaPrecio}.category`);
            if (!CATEGORIAS.has(categoria)) errorDeDatos(`${rutaPrecio}.category`, `categoría desconocida: ${categoria}`);
            sinDuplicados(categorias, categoria, `${rutaPrecio}.category`);

            const minimoKg = precio(banda.min_kg, `${rutaPrecio}.min_kg`);
            const maximoKg = precio(banda.max_kg, `${rutaPrecio}.max_kg`);
            const minimoUnidad = precio(banda.min_un, `${rutaPrecio}.min_un`);
            const maximoUnidad = precio(banda.max_un, `${rutaPrecio}.max_un`);
            if (minimoKg > maximoKg || minimoUnidad > maximoUnidad) {
              errorDeDatos(rutaPrecio, "el precio mínimo supera al máximo");
            }
            if (typeof banda.is_reference !== "boolean") {
              errorDeDatos(`${rutaPrecio}.is_reference`, "se esperaba un booleano");
            }
            if (banda.is_reference) referencias++;
          }
          if (referencias > 1) {
            errorDeDatos(`${rutaPresentacion}.prices`, "hay más de una categoría de referencia");
          }
        }
      }
    }
  }
}

export function cargarConsultaUam(): ConsultaUam {
  const ruta = new URL("./data/consulta-uam.txt", import.meta.url);
  let contenido: string;
  try {
    contenido = readFileSync(ruta, "utf8");
  } catch (error) {
    const detalle = error instanceof Error ? error.message : String(error);
    throw new Error(`No se pudo leer consulta-uam.txt: ${detalle}`);
  }

  let datos: unknown;
  try {
    datos = JSON.parse(contenido);
  } catch (error) {
    const detalle = error instanceof Error ? error.message : String(error);
    throw new Error(`consulta-uam.txt no contiene JSON válido: ${detalle}`);
  }
  validarConsulta(datos);
  return datos;
}
