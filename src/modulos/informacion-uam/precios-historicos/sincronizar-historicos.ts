import { createHash } from "node:crypto";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { guardarHistorico, leerHistorico, limpiarCacheAnterior, listarEspeciesGuardadas, registrarSincronizacion, sincronizacionCompletada } from "./almacen-historicos";
import { obtenerCatalogoEspeciesHistoricas } from "./catalogo-especies";
import { consultarHistorico } from "./cliente-webservice";
import { esFechaISO, fechaActualMontevideo, type ConsultaHistorica } from "./parametros-consulta";
import type { HistoricoProducto } from "./tipos";
import { validarHistoricoProducto } from "./validar-historico";

export type ResultadoSincronizacionHistorica = {
    total: number;
    actualizadas: number;
    omitidas: number;
    pendientes?: number;
    errores: { speciesId: number; mensaje: string }[];
};

const ANIOS_INICIALES_PREDETERMINADOS = 5;
const INTERVALO_PREDETERMINADO_MS = 1_000;
const compararNombres = new Intl.Collator("es", { sensitivity: "base", numeric: true }).compare;
let sincronizacionEnCurso: Promise<ResultadoSincronizacionHistorica> | undefined;
let sincronizacionInicialEnCurso = false;

function configuracionWebservice() {
    const baseUrl = process.env.PRECIOS_REFERENCIA_WEBSERVICE_BASE_URL?.trim();
    if (!baseUrl) throw new Error("Falta la URL del webservice de precios de referencia.");
    let url: URL;
    try { url = new URL(baseUrl); } catch { throw new Error("La URL del webservice de precios no es válida."); }
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
        throw new Error("La URL del webservice de precios debe ser HTTPS y no incluir credenciales ni parámetros.");
    }
    const normalizada = url.toString().replace(/\/+$/, "");
    const endpoint = process.env.PRECIOS_HISTORICOS_ENDPOINT?.trim() ?? "";
    return {
        baseUrl: normalizada,
        token: process.env.PRECIOS_REFERENCIA_JWT_TOKEN?.trim() ?? "",
        fuente: createHash("sha256").update(JSON.stringify([normalizada, endpoint])).digest("hex"),
    };
}

export function fechaInicioImportacion(hoy: string): string {
    const configurados = process.env.PRECIOS_HISTORICOS_ANIOS_INICIALES;
    const anios = configurados === undefined ? ANIOS_INICIALES_PREDETERMINADOS : Number(configurados);
    if (!Number.isSafeInteger(anios) || anios <= 0 || !esFechaISO(hoy)) {
        throw new Error("PRECIOS_HISTORICOS_ANIOS_INICIALES debe ser un entero positivo.");
    }
    const [anio, mes, dia] = hoy.split("-").map(Number);
    if (anio - anios < 1) throw new Error("El período inicial de históricos es demasiado grande.");
    const ultimoDia = new Date(Date.UTC(anio - anios, mes, 0)).getUTCDate();
    return `${String(anio - anios).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(Math.min(dia, ultimoDia)).padStart(2, "0")}`;
}

async function especiesParaImportar(): Promise<number[]> {
    const especies = await db.orm.public.Especie.select("uamId", "nombreEspecie").all();
    const ids = especies
        .sort((a, b) => compararNombres(a.nombreEspecie ?? "", b.nombreEspecie ?? ""))
        .map(({ uamId }) => uamId)
        .filter((id): id is number => id !== null && Number.isSafeInteger(id) && id > 0);
    if (ids.length) return [...new Set(ids)];
    const catalogo = await obtenerCatalogoEspeciesHistoricas();
    return [...new Set(catalogo
        .sort((a, b) => compararNombres(a.especie, b.especie))
        .map(({ id }) => Number(id)))];
}

function limiteEspeciesIniciales(): number | undefined {
    const configurado = process.env.PRECIOS_HISTORICOS_LIMITE_ESPECIES?.trim();
    if (!configurado) return undefined;
    const limite = Number(configurado);
    if (!Number.isSafeInteger(limite) || limite <= 0) {
        throw new Error("PRECIOS_HISTORICOS_LIMITE_ESPECIES debe ser un entero positivo.");
    }
    return limite;
}

function validarCobertura(historico: HistoricoProducto, consulta: ConsultaHistorica): void {
    if (historico.from > consulta.desde || historico.to < consulta.hasta || historico.from > historico.to
        || historico.series.some((dia) => dia.date < historico.from || dia.date > historico.to)) {
        throw new Error("El webservice no devolvió la cobertura completa del período solicitado.");
    }
}

function intervaloEntrePedidos(): number {
    const configurado = process.env.PRECIOS_HISTORICOS_INTERVALO_MS;
    const intervalo = configurado === undefined ? INTERVALO_PREDETERMINADO_MS : Number(configurado);
    if (configurado?.trim() === "" || !Number.isSafeInteger(intervalo) || intervalo < 0 || intervalo > 2_147_483_647) {
        throw new Error("PRECIOS_HISTORICOS_INTERVALO_MS debe ser un entero entre 0 y 2147483647.");
    }
    return intervalo;
}

function mensajeEspera(causa: Error): string {
    const espera = "reintentarEnMs" in causa ? causa.reintentarEnMs : undefined;
    return typeof espera === "number" && Number.isFinite(espera) && espera > 0
        ? `Esperá al menos ${Math.ceil(espera / 1000)} segundos antes de volver a intentar.`
        : "Esperá antes de volver a intentar.";
}

async function ejecutarSincronizacion(inicial: boolean): Promise<ResultadoSincronizacionHistorica> {
    const limite = inicial ? limiteEspeciesIniciales() : undefined;
    const hoy = fechaActualMontevideo();
    const opciones = configuracionWebservice();
    const resultado: ResultadoSincronizacionHistorica = { total: 0, actualizadas: 0, omitidas: 0, errores: [] };
    if (limite !== undefined) resultado.pendientes = 0;
    if (!inicial && await sincronizacionCompletada(hoy, opciones.fuente)) return resultado;
    const especies = inicial ? await especiesParaImportar() : await listarEspeciesGuardadas();
    resultado.total = especies.length;
    if (!especies.length) return resultado;
    const desdeInicial = inicial ? fechaInicioImportacion(hoy) : undefined;
    const intervaloMs = intervaloEntrePedidos();
    let pedidos = 0;

    for (const [indice, speciesId] of especies.entries()) {
        try {
            const estado = await leerHistorico(speciesId);
            if (estado && estado.fuente !== opciones.fuente) {
                throw new Error("La fuente del histórico cambió. Revisá la configuración antes de importar.");
            }
            if (estado && (inicial || estado.fechaUltimaActualizacion >= hoy)) {
                resultado.omitidas++;
                continue;
            }
            if (!estado && !inicial) continue;
            if (limite !== undefined && pedidos >= limite) {
                resultado.pendientes = (resultado.pendientes ?? 0) + 1;
                continue;
            }
            const consulta: ConsultaHistorica = {
                speciesId,
                desde: estado?.fechaUltimaActualizacion ?? desdeInicial!,
                hasta: hoy,
            };
            if (pedidos > 0 && intervaloMs > 0) {
                await new Promise<void>((resolve) => setTimeout(resolve, intervaloMs));
            }
            pedidos++;
            const recibido = validarHistoricoProducto(await consultarHistorico(opciones, consulta), consulta);
            validarCobertura(recibido, consulta);
            await guardarHistorico({ version: 2, fuente: opciones.fuente, fechaUltimaActualizacion: hoy, historico: recibido });
            resultado.actualizadas++;
        } catch (causa) {
            const limitado = causa instanceof Error && "estadoHTTP" in causa && causa.estadoHTTP === 429;
            const mensajeBase = causa instanceof Error && /^(El webservice|Respuesta de precios|La fuente del histórico|El histórico guardado|Falta configurar|Falta un token|El endpoint|PRECIOS_HISTORICOS_)/.test(causa.message)
                ? causa.message : "No se pudo actualizar el histórico de esta especie. Podés volver a intentar.";
            const mensaje = limitado ? `${mensajeBase} ${mensajeEspera(causa)}` : mensajeBase;
            resultado.errores.push({ speciesId, mensaje });
            const configuracionInvalida = causa instanceof Error && causa.message.startsWith("PRECIOS_HISTORICOS_");
            if (limitado || configuracionInvalida) {
                const motivo = limitado
                    ? `No consultada: se detuvo el lote porque el webservice limitó las solicitudes (HTTP 429). ${mensajeEspera(causa)}`
                    : "No consultada: revisá la configuración del cliente antes de volver a intentar.";
                for (const pendiente of especies.slice(indice + 1)) {
                    resultado.errores.push({ speciesId: pendiente, mensaje: motivo });
                }
                break;
            }
        }
    }
    if (inicial && resultado.errores.length === 0 && (resultado.pendientes ?? 0) === 0) await limpiarCacheAnterior();
    if (!inicial && resultado.errores.length === 0) await registrarSincronizacion(hoy, opciones.fuente);
    return resultado;
}

async function coordinarSincronizacion(inicial: boolean): Promise<ResultadoSincronizacionHistorica> {
    while (sincronizacionEnCurso) {
        if (!inicial && !sincronizacionInicialEnCurso) return sincronizacionEnCurso;
        await sincronizacionEnCurso;
    }
    const pendiente = ejecutarSincronizacion(inicial);
    sincronizacionEnCurso = pendiente;
    sincronizacionInicialEnCurso = inicial;
    try { return await pendiente; } finally {
        if (sincronizacionEnCurso === pendiente) {
            sincronizacionEnCurso = undefined;
            sincronizacionInicialEnCurso = false;
        }
    }
}

export function inicializarHistoricosPrecios(): Promise<ResultadoSincronizacionHistorica> {
    return coordinarSincronizacion(true);
}

export function actualizarHistoricosPrecios(): Promise<ResultadoSincronizacionHistorica> {
    return coordinarSincronizacion(false);
}
