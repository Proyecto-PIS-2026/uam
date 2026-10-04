import type { ConsultaPreciosReferencia } from "./consultas-precios-referencia";
import { validarConsultaPreciosReferencia } from "./validar-consulta-webservice";

export type EstadoCacheDiaria = {
    version: 1;
    ultimoIntento: string;
    ultimoExito: string | null;
    consulta: ConsultaPreciosReferencia | null;
};

export type ResultadoCacheDiaria = { consulta: ConsultaPreciosReferencia | null; nuevoEstado: EstadoCacheDiaria | null };

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

        return { version: 1, ultimoIntento: estado.ultimoIntento, ultimoExito: estado.ultimoExito, consulta };
    } catch {
        return null;
    }
}

export async function resolverCacheDiaria(
    estado: EstadoCacheDiaria | null,
    hoy: string,
    consultar: () => Promise<ConsultaPreciosReferencia>,
): Promise<ResultadoCacheDiaria> {
    if (estado?.ultimoIntento === hoy) {
        return { consulta: estado.consulta, nuevoEstado: null };
    }

    try {
        const consulta = await consultar();
        return { consulta, nuevoEstado: { version: 1, ultimoIntento: hoy, ultimoExito: hoy, consulta } };
    } catch {
        return {
            consulta: estado?.consulta ?? null,
            nuevoEstado: { version: 1, ultimoIntento: hoy, ultimoExito: estado?.ultimoExito ?? null, consulta: estado?.consulta ?? null },
        };
    }
}
