import { conBloqueoActualizacion } from "./almacen-historicos";
import { consultarHistorico } from "./cliente-webservice";
import { esFechaISO, fechaActualMontevideo, validarParametrosConsulta, type ConsultaHistorica } from "./parametros-consulta";
import type { HistoricoProducto } from "./tipos";

const ANIOS_INICIALES = 3;
const actualizacionesEnCurso = new Map<string, Promise<void>>();

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

async function ejecutarActualizacion(speciesId: number): Promise<void> {
    let habiaHistorico = false;
    try {
        await conBloqueoActualizacion(speciesId, async (almacen) => {
            const hoy = fechaActualMontevideo();
            validarParametrosConsulta({ speciesId, desde: hoy, hasta: hoy });
            const estado = await almacen.leer();
            habiaHistorico = estado !== null;
            if (estado && estado.fechaUltimaActualizacion >= hoy) return;
            const consulta: ConsultaHistorica = {
                speciesId,
                desde: estado?.fechaUltimaActualizacion ?? fechaInicioImportacion(hoy),
                hasta: hoy,
            };
            const recibido = await consultarHistorico(configuracionWebservice(), consulta);
            validarCobertura(recibido, consulta);
            await almacen.guardar({ fechaUltimaActualizacion: hoy, historico: recibido });
        });
    } catch (causa) {
        if (!habiaHistorico) throw causa;
    }
}

export function actualizarHistoricoEspecie(speciesId: number): Promise<void> {
    const clave = `${fechaActualMontevideo()}:${speciesId}`;
    const existente = actualizacionesEnCurso.get(clave);
    if (existente) return existente;
    const pendiente = ejecutarActualizacion(speciesId).finally(() => {
        if (actualizacionesEnCurso.get(clave) === pendiente) actualizacionesEnCurso.delete(clave);
    });
    actualizacionesEnCurso.set(clave, pendiente);
    return pendiente;
}
