import { createHash } from "node:crypto";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { consultarHistorico } from "./cliente-webservice";
import { validarParametrosConsulta, type ConsultaHistorica } from "./parametros-consulta";
import type { HistoricoProducto } from "./tipos";

function baseUrlWebservice(): string {
    const baseUrl = process.env.PRECIOS_REFERENCIA_WEBSERVICE_BASE_URL?.trim();
    if (!baseUrl) throw new Error("Falta la URL del webservice de precios de referencia.");

    let url: URL;
    try {
        url = new URL(baseUrl);
    } catch {
        throw new Error("La URL del webservice de precios no es válida.");
    }
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
        throw new Error("La URL del webservice de precios debe ser HTTPS y no incluir credenciales ni parámetros.");
    }
    return url.toString().replace(/\/+$/, "");
}

function leerCache(serializado: string | undefined): HistoricoProducto | null {
    if (!serializado) return null;
    try {
        const estado: unknown = JSON.parse(serializado);
        if (estado === null || typeof estado !== "object" || !("version" in estado) || estado.version !== 1 || !("historico" in estado)) return null;
        return estado.historico as HistoricoProducto;
    } catch {
        return null;
    }
}

export async function obtenerHistoricoPrecios(consulta: ConsultaHistorica): Promise<HistoricoProducto> {
    validarParametrosConsulta(consulta);
    const baseUrl = baseUrlWebservice();
    const endpoint = process.env.PRECIOS_HISTORICOS_ENDPOINT?.trim() ?? "";
    const hash = createHash("sha256").update(JSON.stringify([
        baseUrl, endpoint, consulta.classificationId, consulta.speciesId, consulta.desde, consulta.hasta,
    ])).digest();
    const nombreConfiguracion = `precios-historicos:v1:${hash.toString("hex")}`;
    const registroInicial = await db.orm.public.Configuracion.where({ nombreConfiguracion }).first();
    const guardado = leerCache(registroInicial?.valorConfiguracion);
    if (guardado) return guardado;

    return db.transaction(async (tx) => {
        await tx.execute(
            db.raw.sql`SELECT 1::int AS locked FROM pg_advisory_xact_lock(1724, ${hash.readInt32BE(0)})`
                .returnsRow({ locked: "pg/int4@1" })
                .build(),
        );
        const registro = await tx.orm.public.Configuracion.where({ nombreConfiguracion }).first();
        const cache = leerCache(registro?.valorConfiguracion);
        if (cache) return cache;

        const token = process.env.PRECIOS_REFERENCIA_JWT_TOKEN?.trim() ?? "";
        const historico = await consultarHistorico({ baseUrl, token }, consulta);
        const valorConfiguracion = JSON.stringify({ version: 1, historico });
        if (registro) {
            await tx.orm.public.Configuracion.where({ id: registro.id }).update({ valorConfiguracion });
        } else {
            await tx.orm.public.Configuracion.create({ nombreConfiguracion, valorConfiguracion });
        }
        return historico;
    });
}
