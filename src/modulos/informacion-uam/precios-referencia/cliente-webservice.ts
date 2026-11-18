import type { ConsultaPreciosReferencia } from "./consultas-precios-referencia";
import { validarConsultaPreciosReferencia } from "./validar-consulta-webservice";

const TIEMPO_MAXIMO_MS = 15_000;

export type OpcionesWebservicePrecios = { baseUrl: string; token: string };

function construirUrl(baseUrl: string): string {
    let url: URL;

    try {
        url = new URL(baseUrl);
    } catch {
        throw new Error("La URL del webservice de precios no es válida.");
    }

    if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.search || url.hash) {
        throw new Error("La URL del webservice de precios debe ser HTTPS y no incluir credenciales ni parámetros.");
    }

    url.pathname = url.pathname.replace(/\/+$/, "") + "/api/prices/latest";
    return url.toString();
}

export async function consultarUltimoRelevamiento(
    opciones: OpcionesWebservicePrecios,
    fetcher: typeof fetch = fetch,
): Promise<ConsultaPreciosReferencia> {
    const url = construirUrl(opciones.baseUrl);
    const token = opciones.token.trim();

    if (!token || /[\r\n]/.test(token)) {
        throw new Error("Falta un token válido para el webservice de precios.");
    }

    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), TIEMPO_MAXIMO_MS);

    try {
        const respuesta = await fetcher(url, {
            method: "GET",
            headers: { Authorization: "Bearer " + token, Accept: "application/json" },
            cache: "no-store",
            signal: controlador.signal,
        });

        if (!respuesta.ok) {
            throw new Error("El webservice de precios respondió con estado " + respuesta.status + ".");
        }

        const datos: unknown = await respuesta.json();
        return validarConsultaPreciosReferencia(datos);
    } finally {
        clearTimeout(temporizador);
    }
}
