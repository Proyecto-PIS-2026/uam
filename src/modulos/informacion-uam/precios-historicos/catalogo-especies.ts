import consultaLocal from "../precios-referencia/consulta-referencia.json";
import { obtenerUltimoRelevamientoGuardado } from "../precios-referencia/cache-diario";
import type { ConsultaPreciosReferencia } from "../precios-referencia/consultas-precios-referencia";
import type { EspecieHistorica } from "./tipos";

const comparar = new Intl.Collator("es", { sensitivity: "base", numeric: true }).compare;

export async function obtenerCatalogoEspeciesHistoricas(): Promise<EspecieHistorica[]> {
    let consulta: ConsultaPreciosReferencia = consultaLocal;
    if (process.env.PRECIOS_REFERENCIA_FUENTE === "webservice") {
        try {
            consulta = await obtenerUltimoRelevamientoGuardado() ?? consultaLocal;
        } catch {
            
        }
    }

    const especies = new Map<string, EspecieHistorica>();
    for (const tipo of consulta.types) {
        for (const producto of tipo.products) {
            const id = JSON.stringify([tipo.classification_id, producto.species_id]);
            if (!especies.has(id)) especies.set(id, { id, especie: producto.species });
        }
    }
    return [...especies.values()].sort((a, b) => comparar(a.especie, b.especie));
}
