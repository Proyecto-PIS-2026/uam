import { Temporal } from "@js-temporal/polyfill";
import { ZONA_HORARIA_TAREAS } from "../../infraestructura/tareas-programadas/tipos";
import { CONFIGURACION_AGING_FOTOS } from "./configuracion-aging-fotos";

export type ConfiguracionAgingFotosActiva = {
    habilitado: true;
    diasVigencia: number;
    diasAnticipacionAviso: number;
};

export type ConfiguracionAgingFotos = { habilitado: false } | ConfiguracionAgingFotosActiva;

export function obtenerConfiguracionAgingFotos(): ConfiguracionAgingFotos {
    const { habilitado, diasVigencia, diasAnticipacionAviso } = CONFIGURACION_AGING_FOTOS;
    if (typeof habilitado !== "boolean") {
        throw new Error("La habilitación del aging de fotos debe ser verdadera o falsa.");
    }
    if (!habilitado) return { habilitado: false };

    validarVigenciaFotosDias(diasVigencia);
    if (!Number.isSafeInteger(diasAnticipacionAviso) || diasAnticipacionAviso <= 0 || diasAnticipacionAviso >= diasVigencia) {
        throw new Error("La anticipación del aviso debe ser un número entero de días mayor que cero y menor que la vigencia.");
    }

    return { habilitado: true, diasVigencia, diasAnticipacionAviso };
}

export function validarVigenciaFotosDias(dias: number): number {
    if (!Number.isSafeInteger(dias) || dias <= 0 || dias > 36500) {
        throw new Error("La vigencia de las fotos debe contener un número entero de días entre 1 y 36500.");
    }
    return dias;
}

export function obtenerLimiteAntiguedadFotos(
    diasVigencia: number,
    instante: string = Temporal.Now.instant().toString(),
): string {
    validarVigenciaFotosDias(diasVigencia);
    return Temporal.Instant.from(instante).toZonedDateTimeISO(ZONA_HORARIA_TAREAS)
        .subtract({ days: diasVigencia }).toInstant().toString();
}
