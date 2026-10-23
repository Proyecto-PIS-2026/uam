import { db } from "@/infraestructura/persistencia/prisma/db";
import { obtenerConsultaDiariaWebservice, obtenerUltimoRelevamientoGuardado } from "../precios-referencia/cache-diario";
import type { ConsultaPreciosReferencia } from "../precios-referencia/consultas-precios-referencia";
import type { EspecieHistorica } from "./tipos";

const comparar = new Intl.Collator("es", { sensitivity: "base", numeric: true }).compare;

export async function obtenerCatalogoEspeciesHistoricas(): Promise<EspecieHistorica[]> {
    try {
        const registradas = await db.orm.public.Especie.select("uamId", "nombreEspecie").all();
        const catalogo = new Map<string, EspecieHistorica>();
        for (const { uamId, nombreEspecie } of registradas) {
            if (uamId === null || !Number.isSafeInteger(uamId) || uamId <= 0) continue;
            const id = String(uamId);
            if (!catalogo.has(id)) catalogo.set(id, { id, especie: nombreEspecie });
        }
        if (catalogo.size > 0) return [...catalogo.values()].sort((a, b) => comparar(a.especie, b.especie));
    } catch {
    }

    let consulta: ConsultaPreciosReferencia;
    try {
        consulta = await obtenerUltimoRelevamientoGuardado() ?? await obtenerConsultaDiariaWebservice();
    } catch {
        return [];
    }

    const especies = new Map<string, EspecieHistorica>();
    for (const tipo of consulta.types) {
        for (const producto of tipo.products) {
            const id = String(producto.species_id);
            if (!especies.has(id)) especies.set(id, { id, especie: producto.species });
        }
    }
    return [...especies.values()].sort((a, b) => comparar(a.especie, b.especie));
}
