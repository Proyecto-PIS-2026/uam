import { conBloqueoActualizacion, leerHistorico, type EstadoHistorico } from "./almacen-historicos";
import { consultarHistorico } from "./cliente-webservice";
import { esFechaISO, fechaActualMontevideo, validarParametrosConsulta, type ConsultaHistorica } from "./parametros-consulta";
import { dividirPeriodoHistorico } from "./periodos-historicos";
import type { HistoricoProducto } from "./tipos";
import { fusionarHistoricos } from "./transformar-historico";

const ANIOS_INICIALES = 6;
const PEDIDOS_POR_LOTE = 3;
const actualizacionesEnCurso = new Map<string, Promise<void>>();

type LoteHistorico = {
    consultas: ConsultaHistorica[];
    fechaUltimaActualizacion: string;
};

function configuracionWebservice() {
    const baseUrl = process.env.PRECIOS_REFERENCIA_WEBSERVICE_BASE_URL?.trim();
    if (!baseUrl) throw new Error("Falta la URL del webservice de precios de referencia.");
    let url: URL;
    try { url = new URL(baseUrl); } catch { throw new Error("La URL del webservice de precios no es válida."); }
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
        throw new Error("La URL del webservice de precios debe ser HTTPS y no incluir credenciales ni parámetros.");
    }
    return {
        baseUrl: url.toString().replace(/\/+$/, ""),
        token: process.env.PRECIOS_REFERENCIA_JWT_TOKEN?.trim() ?? "",
    };
}

export function fechaInicioImportacion(hoy: string): string {
    if (!esFechaISO(hoy)) throw new Error("La fecha de inicio debe calcularse desde una fecha válida.");
    const [anio, mes, dia] = hoy.split("-").map(Number);
    if (anio - ANIOS_INICIALES < 1) throw new Error("El período inicial de históricos es demasiado grande.");
    const ultimoDia = new Date(Date.UTC(anio - ANIOS_INICIALES, mes, 0)).getUTCDate();
    return `${String(anio - ANIOS_INICIALES).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(Math.min(dia, ultimoDia)).padStart(2, "0")}`;
}

function validarCobertura(historico: HistoricoProducto, consulta: ConsultaHistorica): void {
    if (historico.from > consulta.desde || historico.to < consulta.hasta || historico.from > historico.to) {
        throw new Error("El webservice no devolvió la cobertura completa del período solicitado.");
    }
}

async function consultarPeriodo(consulta: ConsultaHistorica): Promise<HistoricoProducto> {
    const recibido = await consultarHistorico(configuracionWebservice(), consulta);
    validarCobertura(recibido, consulta);
    return recibido;
}

async function consultarLote(consultas: ConsultaHistorica[]): Promise<HistoricoProducto> {
    // Todos los pedidos terminan antes de liberar la reserva, también cuando alguno falla.
    const respuestas = await Promise.allSettled(consultas.map(consultarPeriodo));
    const historicos = respuestas.map((respuesta) => {
        if (respuesta.status === "rejected") throw respuesta.reason;
        return respuesta.value;
    });
    return historicos.reduce((anterior, recibido) => fusionarHistoricos(anterior, recibido));
}

function siguienteLote(speciesId: number, hoy: string, estado: EstadoHistorico | null, desdeSolicitado?: string): LoteHistorico | null {
    if (!estado) {
        return {
            consultas: dividirPeriodoHistorico({ speciesId, desde: fechaInicioImportacion(hoy), hasta: hoy }),
            fechaUltimaActualizacion: hoy,
        };
    }
    if (estado.fechaUltimaActualizacion < hoy) {
        const consultas = dividirPeriodoHistorico({ speciesId, desde: estado.fechaUltimaActualizacion, hasta: hoy })
            .slice(0, PEDIDOS_POR_LOTE);
        return { consultas, fechaUltimaActualizacion: consultas[consultas.length - 1].hasta };
    }
    if (desdeSolicitado && desdeSolicitado < estado.historico.from) {
        return {
            // Ampliamos desde la cobertura existente hacia atrás para no dejar huecos entre lotes.
            consultas: dividirPeriodoHistorico({ speciesId, desde: desdeSolicitado, hasta: estado.historico.from })
                .slice(-PEDIDOS_POR_LOTE),
            fechaUltimaActualizacion: estado.fechaUltimaActualizacion,
        };
    }
    return null;
}

function requiereActualizacion(estado: EstadoHistorico | null, hoy: string, desdeSolicitado?: string): boolean {
    return !estado || estado.fechaUltimaActualizacion < hoy
        || desdeSolicitado !== undefined && desdeSolicitado < estado.historico.from;
}

async function ejecutarActualizacion(speciesId: number, desdeSolicitado?: string): Promise<void> {
    const hoy = fechaActualMontevideo();
    validarParametrosConsulta({ speciesId, desde: desdeSolicitado ?? hoy, hasta: hoy });
    let habiaHistorico = false;
    try {
        const inicial = await leerHistorico(speciesId);
        habiaHistorico = inicial !== null;
        if (!requiereActualizacion(inicial, hoy, desdeSolicitado)) return;
        let continuar = true;
        while (continuar) {
            // Cada lote obtiene una reserva nueva y relee el avance de otras solicitudes.
            continuar = await conBloqueoActualizacion(speciesId, async (almacen) => {
                const hoy = fechaActualMontevideo();
                const estado = await almacen.leer();
                habiaHistorico = estado !== null;
                const lote = siguienteLote(speciesId, hoy, estado, desdeSolicitado);
                if (!lote) return false;
                const recibido = await consultarLote(lote.consultas);
                await almacen.guardar({ fechaUltimaActualizacion: lote.fechaUltimaActualizacion, historico: recibido });
                habiaHistorico = true;
                const inicioGuardado = estado && estado.historico.from < recibido.from ? estado.historico.from : recibido.from;
                return lote.fechaUltimaActualizacion < hoy
                    || desdeSolicitado !== undefined && desdeSolicitado < inicioGuardado;
            });
        }
    } catch (causa) {
        if (!habiaHistorico) throw causa;
    }
}

export function actualizarHistoricoEspecie(speciesId: number, desdeSolicitado?: string): Promise<void> {
    const clave = `${fechaActualMontevideo()}:${speciesId}:${desdeSolicitado ?? ""}`;
    const existente = actualizacionesEnCurso.get(clave);
    if (existente) return existente;
    const pendiente = ejecutarActualizacion(speciesId, desdeSolicitado).finally(() => {
        if (actualizacionesEnCurso.get(clave) === pendiente) actualizacionesEnCurso.delete(clave);
    });
    actualizacionesEnCurso.set(clave, pendiente);
    return pendiente;
}
