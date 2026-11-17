import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export type LocalOperadorCsv = { nave: string; numero: string };
export type OperadorCsv = {
  username: string;
  nombreFantasia: string;
  locales: LocalOperadorCsv[];
};

const CABECERA = ["Nave (filtro)", "Operador", "Nombre corto", "Locales", "Puertas", "Naves"];
const normalizarTexto = (valor: string) => valor.normalize("NFC").trim().replace(/\s+/g, " ");
const compararTexto = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

function errorCsv(fila: number, detalle: string): never {
  throw new Error(`CSV de operadores, fila ${fila}: ${detalle}`);
}

function leerFilas(contenido: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let estado: "inicio" | "texto" | "comillas" | "cerrado" = "inicio";
  const texto = contenido.replace(/^\uFEFF/, "");

  for (let i = 0; i < texto.length; i++) {
    const caracter = texto[i];
    if (estado === "comillas") {
      if (caracter === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (caracter === '"') estado = "cerrado";
      else campo += caracter;
      continue;
    }
    if (caracter === ";" || caracter === "\r" || caracter === "\n") {
      fila.push(campo);
      campo = "";
      estado = "inicio";
      if (caracter !== ";") {
        filas.push(fila);
        fila = [];
        if (caracter === "\r" && texto[i + 1] === "\n") i++;
      }
      continue;
    }
    if (estado === "cerrado") errorCsv(filas.length + 1, "texto inesperado después de comillas");
    if (caracter === '"') {
      if (estado !== "inicio") errorCsv(filas.length + 1, "comillas dentro de un campo sin delimitar");
      estado = "comillas";
    } else {
      campo += caracter;
      estado = "texto";
    }
  }
  if (estado === "comillas") errorCsv(filas.length + 1, "campo con comillas sin cerrar");
  if (campo || fila.length || estado === "cerrado") filas.push([...fila, campo]);
  return filas;
}

function convertirPuerta(puerta: string, naves: Set<string>, fila: number): LocalOperadorCsv {
  const partes = /^(NAL|[ABCDEJ])?(\d+)$/.exec(puerta);
  if (!partes) errorCsv(fila, `puerta desconocida: ${puerta}`);
  const [, prefijo = "", digitos] = partes;
  let nave: string;
  let naveFuente: string;
  if (prefijo === "NAL") nave = naveFuente = "NAL - A";
  else if (prefijo === "C") nave = naveFuente = "MP - A";
  else if (prefijo === "J") nave = naveFuente = "ZAC - J";
  else if (prefijo === "") nave = naveFuente = "ZAC - I";
  else {
    nave = prefijo;
    naveFuente = `MFH - ${prefijo}`;
  }
  if (!naves.has(naveFuente)) errorCsv(fila, `la puerta ${puerta} requiere la nave ${naveFuente}`);
  return { nave, numero: digitos.replace(/^0+(?=\d)/, "") };
}

function usernameBase(nombre: string): string {
  return nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

/** Agrupa por el nombre completo; los nombres cortos del archivo están truncados. */
export function parsearOperadoresCsv(contenido: string): OperadorCsv[] {
  const [cabecera, ...filas] = leerFilas(contenido);
  if (!cabecera || cabecera.length !== CABECERA.length ||
      CABECERA.some((nombre, indice) => cabecera[indice].trim() !== nombre)) {
    errorCsv(1, `se esperaba la cabecera ${CABECERA.join(";")}`);
  }

  const operadores = new Map<string, { nombre: string; locales: Map<string, LocalOperadorCsv> }>();
  const propietarios = new Map<string, string>();
  for (const [indice, campos] of filas.entries()) {
    const numeroFila = indice + 2;
    if (campos.every((campo) => !campo.trim())) continue;
    if (campos.length !== CABECERA.length) errorCsv(numeroFila, "cantidad de columnas incorrecta");
    const [filtro, nombreCrudo, , cantidad, puertasCrudas, navesCrudas] = campos.map(normalizarTexto);
    if (!nombreCrudo) errorCsv(numeroFila, "falta el nombre completo del operador");
    if (!/^\d+$/.test(cantidad)) errorCsv(numeroFila, "Locales debe contener una cantidad entera");
    const naves = new Set(navesCrudas.toUpperCase().split(",").map(normalizarTexto));
    if (!/^MFH - [ABDE]$/.test(filtro) || !naves.has(filtro)) {
      errorCsv(numeroFila, "Nave (filtro) no corresponde a las Naves declaradas");
    }
    const nombre = nombreCrudo.toUpperCase();
    const operador = operadores.get(nombre) ?? { nombre, locales: new Map<string, LocalOperadorCsv>() };
    operadores.set(nombre, operador);

    // Locales incluye puertas sin identificar en la fuente. Nunca crear números a partir del total.
    const puertas = !puertasCrudas || puertasCrudas === "—" || puertasCrudas === "-"
      ? [] : puertasCrudas.toUpperCase().split(/\s+/);
    for (const puerta of puertas) {
      const local = convertirPuerta(puerta, naves, numeroFila);
      const clave = `${local.nave}|${local.numero}`;
      const propietario = propietarios.get(clave);
      if (propietario && propietario !== nombre) {
        errorCsv(numeroFila, `local ${clave} asignado a ${propietario} y ${nombre}`);
      }
      propietarios.set(clave, nombre);
      operador.locales.set(clave, local);
    }
  }
  if (!operadores.size) errorCsv(2, "no hay operadores para importar");

  const gruposUsername = new Map<string, string[]>();
  for (const nombre of operadores.keys()) {
    const base = usernameBase(nombre);
    if (!base) throw new Error(`No se puede generar un username para ${nombre}`);
    gruposUsername.set(base, [...(gruposUsername.get(base) ?? []), nombre]);
  }
  const usernames = new Set<string>();
  return [...operadores.values()].sort((a, b) => compararTexto(a.nombre, b.nombre)).map((operador) => {
    const base = usernameBase(operador.nombre);
    // El sufijo depende del nombre, nunca de la posición de la fila en el CSV.
    const username = gruposUsername.get(base)!.length === 1 ? base
      : `${base}_${createHash("sha256").update(operador.nombre).digest("hex").slice(0, 12)}`;
    if (usernames.has(username)) throw new Error(`Username duplicado: ${username}`);
    usernames.add(username);
    return {
      username,
      nombreFantasia: operador.nombre,
      locales: [...operador.locales.values()].sort((a, b) =>
        compararTexto(a.nave, b.nave) || Number(a.numero) - Number(b.numero)),
    };
  });
}

export function leerOperadoresCsv(
  ruta: string | URL = new URL("../data/operadores_MFH_A_B_D_E.csv", import.meta.url),
): OperadorCsv[] {
  return parsearOperadoresCsv(readFileSync(ruta, "utf8"));
}
