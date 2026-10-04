import { createHash } from "node:crypto";
import { db } from "@/infraestructura/persistencia/prisma/db";
import type { ConsultaPreciosReferencia } from "./consultas-precios-referencia";
import { consultarUltimoRelevamiento } from "./cliente-webservice";
import { leerEstadoCacheDiaria, resolverCacheDiaria } from "./politica-cache-diaria";

const PREFIJO_CACHE = "precios-referencia:latest:";
type RelevamientoGuardado = { consulta: ConsultaPreciosReferencia; ultimoExito: string };

function esMasReciente(candidato: RelevamientoGuardado, actual: RelevamientoGuardado | null): boolean {
    if (!actual) return true;
    if (candidato.consulta.survey_date !== actual.consulta.survey_date) {
        return candidato.consulta.survey_date > actual.consulta.survey_date;
    }
    return candidato.ultimoExito > actual.ultimoExito;
}

function ultimoRelevamientoGuardado(registros: { nombreConfiguracion: string; valorConfiguracion: string }[]): RelevamientoGuardado | null {
    let ultimoGuardado: RelevamientoGuardado | null = null;

    for (const candidato of registros) {
        if (!candidato.nombreConfiguracion.startsWith(PREFIJO_CACHE)) continue;
        const cache = leerEstadoCacheDiaria(candidato.valorConfiguracion);
        if (!cache?.consulta || !cache.ultimoExito) continue;

        const dato = { consulta: cache.consulta, ultimoExito: cache.ultimoExito };
        if (esMasReciente(dato, ultimoGuardado)) ultimoGuardado = dato;
    }

    return ultimoGuardado;
}

const formatoFecha = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Montevideo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
});

export function fechaActualMontevideo(fecha = new Date()): string {
    const partes = formatoFecha.formatToParts(fecha);
    const año = partes.find((parte) => parte.type === "year")?.value;
    const mes = partes.find((parte) => parte.type === "month")?.value;
    const dia = partes.find((parte) => parte.type === "day")?.value;
    return `${año}-${mes}-${dia}`;
}

function configuracionWebservice(): { baseUrl: string; token: string } {
    const baseUrl = process.env.PRECIOS_REFERENCIA_WEBSERVICE_BASE_URL?.trim();
    const token = process.env.PRECIOS_REFERENCIA_JWT_TOKEN?.trim();

    if (!baseUrl || !token) {
        throw new Error("Faltan la URL o el JWT del webservice de precios de referencia.");
    }

    let url: URL;
    try {
        url = new URL(baseUrl);
    } catch {
        throw new Error("La URL del webservice de precios de referencia no es válida.");
    }

    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
        throw new Error("La URL del webservice de precios de referencia debe ser HTTPS y no contener credenciales ni parámetros.");
    }

    return { baseUrl: url.toString().replace(/\/+$/, ""), token };
}

export async function obtenerConsultaDiariaWebservice(): Promise<ConsultaPreciosReferencia> {
    const opciones = configuracionWebservice();
    const hash = createHash("sha256").update(opciones.baseUrl).digest();
    const nombreConfiguracion = `${PREFIJO_CACHE}${hash.toString("hex").slice(0, 24)}`;
    const llaveBloqueo = hash.readInt32BE(0);

    const registroInicial = await db.orm.public.Configuracion.where({ nombreConfiguracion }).first();
    const estadoInicial = leerEstadoCacheDiaria(registroInicial?.valorConfiguracion ?? null);
    if (estadoInicial?.ultimoIntento === fechaActualMontevideo()) {
        if (estadoInicial.consulta) return estadoInicial.consulta;
        const respaldo = ultimoRelevamientoGuardado(await db.orm.public.Configuracion.all());
        if (!respaldo) throw new Error("Todavía no hay un relevamiento de precios disponible en la caché.");
    }

    const consulta = await db.transaction(async (tx) => {

        await tx.execute(
            db.raw.sql`SELECT 1::int AS locked FROM pg_advisory_xact_lock(1723, ${llaveBloqueo})`
                .returnsRow({ locked: "pg/int4@1" })
                .build(),
        );

        const registro = await tx.orm.public.Configuracion.where({ nombreConfiguracion }).first();
        const estado = leerEstadoCacheDiaria(registro?.valorConfiguracion ?? null);
        const hoyBajoBloqueo = fechaActualMontevideo();
        const ultimoGuardado = ultimoRelevamientoGuardado(await tx.orm.public.Configuracion.all());

        let estadoConRespaldo = estado;
        const datoActual = estado?.consulta && estado.ultimoExito ? { consulta: estado.consulta, ultimoExito: estado.ultimoExito } : null;
        if (ultimoGuardado && esMasReciente(ultimoGuardado, datoActual)) {
            estadoConRespaldo = {
                version: 1,
                ultimoIntento: estado?.ultimoIntento ?? "",
                ultimoExito: ultimoGuardado.ultimoExito,
                consulta: ultimoGuardado.consulta,
            };
        }

        const resultado = await resolverCacheDiaria(estadoConRespaldo, hoyBajoBloqueo, () => consultarUltimoRelevamiento(opciones));
        const nuevoEstado = resultado.nuevoEstado ?? (estadoConRespaldo !== estado ? estadoConRespaldo : null);

        if (nuevoEstado) {
            const valorConfiguracion = JSON.stringify(nuevoEstado);
            if (registro) {
                await tx.orm.public.Configuracion.where({ id: registro.id }).update({ valorConfiguracion });
            } else {
                await tx.orm.public.Configuracion.create({ nombreConfiguracion, valorConfiguracion });
            }
        }

        return resultado.consulta;
    });

    if (!consulta) {
        throw new Error("Todavía no hay un relevamiento de precios disponible en la caché.");
    }
    return consulta;
}
