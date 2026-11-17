import type { ConsultaPreciosReferencia } from "./consultas-precios-referencia";
import { validarConsultaPreciosReferencia } from "./validar-consulta-webservice";

export type EstadoCacheDiaria = {
    version: 1;
    ultimoIntento: string;
    intentosDelDia: number;
    ultimoIntentoExitoso: boolean;
    ultimoExito: string | null;
    consulta: ConsultaPreciosReferencia | null;
};

export type ResultadoCacheDiaria = { consulta: ConsultaPreciosReferencia | null; nuevoEstado: EstadoCacheDiaria | null };

const MAX_INTENTOS_DIARIOS = 5;

export function leerEstadoCacheDiaria(serializado: string | null): EstadoCacheDiaria | null {
    if (!serializado) return null;

    try {
        const valor: unknown = JSON.parse(serializado);
        if (valor === null || typeof valor !== "object" || Array.isArray(valor)) return null;

        const estado = valor as Record<string, unknown>;
        if (estado.version !== 1 || typeof estado.ultimoIntento !== "string") return null;
        if (estado.ultimoExito !== null && typeof estado.ultimoExito !== "string") return null;

        const consulta = estado.consulta === null ? null : validarConsultaPreciosReferencia(estado.consulta);

        if ((estado.ultimoExito === null) !== (consulta === null)) return null;

        const intentosDelDia = estado.intentosDelDia === undefined ? (estado.ultimoIntento ? 1 : 0) : estado.intentosDelDia;
        const ultimoIntentoExitoso = estado.ultimoIntentoExitoso === undefined
            ? estado.ultimoIntento !== "" && estado.ultimoExito === estado.ultimoIntento : estado.ultimoIntentoExitoso;
        if (typeof intentosDelDia !== "number" || !Number.isSafeInteger(intentosDelDia) || intentosDelDia < 0) return null;
        if (typeof ultimoIntentoExitoso !== "boolean" || ultimoIntentoExitoso && (!consulta || intentosDelDia === 0)) return null;

        return { version: 1, ultimoIntento: estado.ultimoIntento, intentosDelDia, ultimoIntentoExitoso, ultimoExito: estado.ultimoExito, consulta };
    } catch {
        return null;
    }
}

export function puedeConsultarWebservice(estado: EstadoCacheDiaria | null, hoy: string): boolean {
    return !estado || estado.ultimoIntento !== hoy
        || !estado.ultimoIntentoExitoso && estado.intentosDelDia < MAX_INTENTOS_DIARIOS;
}

export async function resolverCacheDiaria(
    estado: EstadoCacheDiaria | null,
    hoy: string,
    consultar: () => Promise<ConsultaPreciosReferencia>,
): Promise<ResultadoCacheDiaria> {
    if (!puedeConsultarWebservice(estado, hoy)) {
        return { consulta: estado?.consulta ?? null, nuevoEstado: null };
    }

    const intentosDelDia = (estado?.ultimoIntento === hoy ? estado.intentosDelDia : 0) + 1;
    try {
        const consulta = await consultar();
        return { consulta, nuevoEstado: { version: 1, ultimoIntento: hoy, intentosDelDia, ultimoIntentoExitoso: true, ultimoExito: hoy, consulta } };
    } catch {
        return {
            consulta: estado?.consulta ?? null,
            nuevoEstado: { version: 1, ultimoIntento: hoy, intentosDelDia, ultimoIntentoExitoso: false, ultimoExito: estado?.ultimoExito ?? null, consulta: estado?.consulta ?? null },
        };
    }
}
