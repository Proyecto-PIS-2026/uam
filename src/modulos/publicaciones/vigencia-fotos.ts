import { Temporal } from "@js-temporal/polyfill";
import { ZONA_HORARIA_TAREAS } from "../../infraestructura/tareas-programadas/tipos";

export function validarVigenciaFotosDias(dias: number): number {
    if (!Number.isSafeInteger(dias) || dias <= 0 || dias > 36500) {
        throw new Error("VIGENCIA_FOTOS_DIAS debe contener un número entero de días entre 1 y 36500.");
    }
    return dias;
}

export function obtenerVigenciaFotosDias(): number {
    const dias = obtenerVigenciaFotosConfigurada();
    if (dias === null) {
        throw new Error("Configurá VIGENCIA_FOTOS_DIAS para habilitar el vencimiento de las fotos.");
    }
    return dias;
}

export function obtenerVigenciaFotosConfigurada(): number | null {
    const valor = process.env.VIGENCIA_FOTOS_DIAS?.trim();
    if (!valor) return null;
    if (!/^[1-9]\d*$/.test(valor)) {
        throw new Error("VIGENCIA_FOTOS_DIAS debe contener un número entero de días entre 1 y 36500.");
    }
    return validarVigenciaFotosDias(Number(valor));
}
export function obtenerLimiteAntiguedadFotos(
    diasVigencia: number,
    instante: string = Temporal.Now.instant().toString(),
): string {
    validarVigenciaFotosDias(diasVigencia);
    return Temporal.Instant.from(instante).toZonedDateTimeISO(ZONA_HORARIA_TAREAS)
        .subtract({ days: diasVigencia }).toInstant().toString();
}
