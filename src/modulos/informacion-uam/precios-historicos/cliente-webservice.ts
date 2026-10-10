import type { OpcionesWebservicePrecios } from "../precios-referencia/cliente-webservice";
import { validarParametrosConsulta, type ConsultaHistorica } from "./parametros-consulta";
import type { HistoricoProducto } from "./tipos";
import { validarHistoricoProducto } from "./validar-historico";

const TIEMPO_MAXIMO_PREDETERMINADO_MS = 300_000;
const TIEMPO_MAXIMO_ADMITIDO_MS = 2_147_483_647;

export class ErrorWebserviceHistorico extends Error {
    readonly estadoHTTP: number;
    readonly reintentarEnMs: number | null;
    readonly duracionMs: number;

    constructor(estadoHTTP: number, reintentarEnMs: number | null, duracionMs: number, consulta: ConsultaHistorica) {
        super(`El webservice de precios históricos respondió con estado ${estadoHTTP}. ${contextoConsulta(consulta, duracionMs)}`);
        this.name = "ErrorWebserviceHistorico";
        this.estadoHTTP = estadoHTTP;
        this.reintentarEnMs = reintentarEnMs;
        this.duracionMs = duracionMs;
    }
}

function contextoConsulta(consulta: ConsultaHistorica, duracionMs: number): string {
    return `Duración: ${duracionMs} ms. Especie: ${consulta.speciesId}. Período: ${consulta.desde} a ${consulta.hasta}.`;
}

function tiempoMaximo(): number {
    const configurado = process.env.PRECIOS_HISTORICOS_TIMEOUT_MS;
    const limite = configurado === undefined ? TIEMPO_MAXIMO_PREDETERMINADO_MS : Number(configurado);
    if (!Number.isSafeInteger(limite) || limite <= 0 || limite > TIEMPO_MAXIMO_ADMITIDO_MS) {
        throw new Error("PRECIOS_HISTORICOS_TIMEOUT_MS debe ser un entero positivo menor o igual a 2147483647.");
    }
    return limite;
}

function esperaIndicada(respuesta: Response, ahora: number): number | null {
    const valor = respuesta.headers?.get("Retry-After")?.trim();
    if (!valor) return null;
    if (/^\d+$/.test(valor)) {
        const milisegundos = Number(valor) * 1000;
        return Number.isSafeInteger(milisegundos) ? milisegundos : null;
    }
    if (!/^(?:Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?),?\s/i.test(valor)) return null;
    const fecha = Date.parse(valor);
    return Number.isFinite(fecha) ? Math.max(0, fecha - ahora) : null;
}

function codigoRed(error: TypeError): string | null {
    const causa = error.cause;
    if (!causa || typeof causa !== "object" || !("code" in causa)) return null;
    return typeof causa.code === "string" && /^[A-Z0-9_]+$/.test(causa.code) ? causa.code : null;
}

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

    const limiteMs = tiempoMaximo();
    const inicio = Date.now();

    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), limiteMs);
    try {
        const respuesta = await fetcher(url, {
            method: "GET",
            headers: { Authorization: "Bearer " + token, Accept: "application/json" },
            cache: "no-store",
            redirect: "error",
            signal: controlador.signal,
        });
        if (!respuesta.ok) {
            const ahora = Date.now();
            throw new ErrorWebserviceHistorico(
                respuesta.status,
                respuesta.status === 429 ? esperaIndicada(respuesta, ahora) : null,
                ahora - inicio,
                consulta,
            );
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
    } catch (error) {
        const duracionMs = Date.now() - inicio;
        if (controlador.signal.aborted) {
            throw new Error(`El webservice de precios históricos superó el tiempo máximo de ${limiteMs} ms. ${contextoConsulta(consulta, duracionMs)}`);
        }
        if (error instanceof TypeError) {
            const codigo = codigoRed(error);
            throw new Error(`El webservice de precios históricos falló por un error de red (TypeError${codigo ? `, código ${codigo}` : ""}). ${contextoConsulta(consulta, duracionMs)}`);
        }
        throw error;
    } finally {
        clearTimeout(temporizador);
    }
}
