import { createHash } from "node:crypto";
import postgres from "@prisma/orm-postgres/runtime";
import type { Contract } from "../src/infraestructura/persistencia/prisma/contract";
import contractJson from "../src/infraestructura/persistencia/prisma/contract.json" with { type: "json" };
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
