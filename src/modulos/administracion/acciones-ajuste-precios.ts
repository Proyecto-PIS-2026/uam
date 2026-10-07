"use server";

import { consultarImporteAjuste, guardarImporteAjuste } from "./configuracion-ajuste-precios";
import { ERROR_IMPORTE_AJUSTE, validarImporteAjuste } from "./validar-importe-ajuste";

type ResultadoConfiguracionAjustePrecios =
    | { ok: true; importe: string }
    | { ok: false; error: string };

export async function obtenerImporteAjusteRapido(): Promise<number> {
    return consultarImporteAjuste();
}

export async function guardarConfiguracionAjustePrecios(valor: string): Promise<ResultadoConfiguracionAjustePrecios> {
    try {
        validarImporteAjuste(valor);
    } catch {
        return { ok: false, error: ERROR_IMPORTE_AJUSTE };
    }

    try {
        const importe = await guardarImporteAjuste(valor);
        return { ok: true, importe };
    } catch {
        return { ok: false, error: "No se pudo guardar el importe. Se mantiene la configuración anterior." };
    }
}
