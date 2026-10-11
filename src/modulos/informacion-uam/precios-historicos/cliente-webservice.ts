import type { OpcionesWebservicePrecios } from "../precios-referencia/cliente-webservice";
import { validarParametrosConsulta, type ConsultaHistorica } from "./parametros-consulta";
import type { HistoricoProducto } from "./tipos";
import { validarHistoricoProducto } from "./validar-historico";

const TIEMPO_MAXIMO_MS = 60_000;

function construirUrl(baseUrl: string, consulta: ConsultaHistorica): string {
    const plantilla = process.env.PRECIOS_HISTORICOS_ENDPOINT?.trim();
    if (!plantilla) throw new Error("Falta configurar el endpoint del webservice de precios históricos.");

    const valores = {
        species_id: String(consulta.speciesId),
        from: consulta.desde,
        to: consulta.hasta,
    };
    for (const campo of ["species_id", "from", "to"] as const) {
        if (!plantilla.includes(`{${campo}}`)) {
            throw new Error(`El endpoint de históricos debe incluir el parámetro {${campo}}.`);
        }
    }
    const recurso = plantilla.replace(/\{([^{}]+)\}/g, (_marcador, campo: string) => {
        if (!Object.hasOwn(valores, campo)) throw new Error("El endpoint de históricos contiene un parámetro desconocido.");
        return encodeURIComponent(valores[campo as keyof typeof valores]);
    });

    let base: URL;
    let url: URL;
    try {
        base = new URL(baseUrl);
        if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) throw new Error();
        url = new URL(recurso, base.toString().replace(/\/+$/, "") + "/");
    } catch {
        throw new Error("La URL del webservice de precios históricos no es válida.");
    }
    if (url.protocol !== "https:" || url.origin !== base.origin || url.username || url.password || url.hash) {
        throw new Error("El endpoint de históricos debe pertenecer al mismo servicio HTTPS y no incluir credenciales ni fragmentos.");
    }
    return url.toString();
}

export async function consultarHistorico(
    opciones: OpcionesWebservicePrecios,
    consulta: ConsultaHistorica,
    fetcher: typeof fetch = fetch,
): Promise<HistoricoProducto> {
    validarParametrosConsulta(consulta);
    const url = construirUrl(opciones.baseUrl, consulta);
    const token = opciones.token.trim();
    if (!token || /[\r\n]/.test(token)) throw new Error("Falta un token válido para el webservice de precios.");

    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), TIEMPO_MAXIMO_MS);
    try {
        const respuesta = await fetcher(url, {
            method: "GET",
            headers: { Authorization: "Bearer " + token, Accept: "application/json" },
            cache: "no-store",
            redirect: "error",
            signal: controlador.signal,
        });
        if (!respuesta.ok) {
            throw new Error("El webservice de precios históricos respondió con estado " + respuesta.status + ".");
        }
        let contenido: unknown;
        try {
            contenido = await respuesta.json();
        } catch (error) {
            if (error instanceof SyntaxError) {
                throw new Error("El webservice de precios históricos devolvió un JSON inválido.");
            }
            throw error;
        }
        return validarHistoricoProducto(contenido, consulta);
    } finally {
        clearTimeout(temporizador);
    }
}
