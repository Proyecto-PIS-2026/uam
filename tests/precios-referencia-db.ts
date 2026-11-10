import { createHash } from "node:crypto";
import postgres from "@prisma/orm-postgres/runtime";
import { Temporal } from "temporal-polyfill";
import type { Contract } from "../src/infraestructura/persistencia/prisma/contract";
import contractJson from "../src/infraestructura/persistencia/prisma/contract.json" with { type: "json" };
import { fechaHaceTresAnios } from "../src/modulos/informacion-uam/precios-historicos/parametros-consulta";
import { relevamiento } from "./fixtures/precios-referencia.mjs";

function claveCache() {
  const baseUrl = process.env.PRECIOS_REFERENCIA_WEBSERVICE_BASE_URL?.trim();
  const token = process.env.PRECIOS_REFERENCIA_JWT_TOKEN?.trim();
  if (baseUrl && token) {
    try {
      const url = new URL(baseUrl);
      if (url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash) {
        const normalizada = url.toString().replace(/\/+$/, "");
        const hash = createHash("sha256").update(normalizada).digest("hex").slice(0, 24);
        return `precios-referencia:latest:${hash}`;
      }
    } catch {
    }
  }
  return "precios-referencia:latest:e2e-bp04";
}

function fechaHoy() {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Montevideo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  return ["year", "month", "day"].map((tipo) => partes.find((parte) => parte.type === tipo)!.value).join("-");
}

export async function conPreciosReferenciaDePrueba<T>(ejecutar: () => Promise<T>): Promise<T> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("Configure DATABASE_URL con la base utilizada por el servidor E2E.");
  const db = postgres<Contract>({ contractJson, url });
  const clave = claveCache();
  const hoy = fechaHoy();
  const estadoCache = JSON.stringify({
    version: 1, ultimoIntento: hoy, ultimoExito: hoy,
    consulta: { ...relevamiento, survey_date: hoy },
  });
  try {
    const anterior = await db.orm.public.CachePreciosReferencia.where({ claveCache: clave }).first();
    let preparado = false;
    try {
      if (anterior) {
        await db.orm.public.CachePreciosReferencia.where({ id: anterior.id }).update({ estadoCache });
      } else {
        await db.orm.public.CachePreciosReferencia.create({ claveCache: clave, estadoCache });
      }
      preparado = true;
      return await ejecutar();
    } finally {
      if (preparado) {
        if (anterior) {
          await db.orm.public.CachePreciosReferencia.where({ id: anterior.id }).update({ estadoCache: anterior.estadoCache });
        } else {
          await db.orm.public.CachePreciosReferencia.where({ claveCache: clave }).delete();
        }
      }
    }
  } finally {
    await db.close();
  }
}

export async function conHistoricoAcelgaDePrueba<T>(ejecutar: () => Promise<T>): Promise<T> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("Configure DATABASE_URL con la base utilizada por el servidor E2E.");
  const db = postgres<Contract>({ contractJson, url });
  try {
    const especie = await db.orm.public.Especie.where({ uamId: 1 }).select("id").first();
    if (!especie) throw new Error("La seed E2E debe incluir Acelga con uamId 1.");
    const tipo = relevamiento.types.find((tipo) => tipo.products.some((producto) => producto.species_id === 1));
    const producto = tipo?.products.find((producto) => producto.species_id === 1);
    if (!tipo || !producto) throw new Error("La fixture de precios debe incluir Acelga.");

    const hoy = fechaHoy();
    const desde = fechaHaceTresAnios(hoy);
    const presentaciones = producto.varieties.flatMap(({ variety, presentations }) =>
      presentations.map((presentacion) => ({ ...presentacion, variety })));
    const valores = {
      historico: {
        classification_id: tipo.classification_id,
        classification: tipo.classification,
        species_id: producto.species_id,
        species: producto.species,
        from: desde,
        to: hoy,
        series: [{ date: hoy, volume_kg: 1200, presentations: presentaciones }],
      },
      fechaDesde: Temporal.PlainDate.from(desde),
      fechaHasta: Temporal.PlainDate.from(hoy),
      fechaUltimaActualizacion: Temporal.PlainDate.from(hoy),
    };
    const anterior = await db.orm.public.HistoricoPrecios.where({ especieId: especie.id }).first();
    let preparado = false;
    try {
      if (anterior) {
        await db.orm.public.HistoricoPrecios.where({ especieId: especie.id }).update(valores);
      } else {
        await db.orm.public.HistoricoPrecios.create({ especieId: especie.id, ...valores });
      }
      preparado = true;
      return await ejecutar();
    } finally {
      if (preparado) {
        if (anterior) {
          await db.orm.public.HistoricoPrecios.where({ especieId: especie.id }).update({
            historico: anterior.historico,
            fechaDesde: anterior.fechaDesde,
            fechaHasta: anterior.fechaHasta,
            fechaUltimaActualizacion: anterior.fechaUltimaActualizacion,
          });
        } else {
          await db.orm.public.HistoricoPrecios.where({ especieId: especie.id }).delete();
        }
      }
    }
  } finally {
    await db.close();
  }
}
