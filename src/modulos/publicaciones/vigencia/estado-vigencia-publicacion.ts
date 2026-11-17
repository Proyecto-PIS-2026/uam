import { Temporal } from "temporal-polyfill";
import { convertirFechaVigenciaAInstant } from "./vigencia-publicacion";

export type EstadoVigenciaPublicacion = "por-vencer" | "vencida" | null;

export type ConfiguracionAvisosVigencia = {
    avisosHabilitados: boolean;
    diasAnticipacion: number;
};

export type FechaVigenciaPublicacion = string | { readonly epochNanoseconds: bigint } | null | undefined;

export function obtenerEstadoVigenciaPublicacion(
    fecha: FechaVigenciaPublicacion,
    configuracion: ConfiguracionAvisosVigencia,
    ahora = Temporal.Now.instant(),
): EstadoVigenciaPublicacion {
    if (!fecha) return null;
    const vencimiento = typeof fecha === "string"
        ? convertirFechaVigenciaAInstant(fecha)
        : Temporal.Instant.fromEpochNanoseconds(fecha.epochNanoseconds);
    if (!vencimiento) return null;
    if (Temporal.Instant.compare(vencimiento, ahora) < 0) return "vencida";
    if (!configuracion.avisosHabilitados) return null;
    const limite = ahora.add({ hours: configuracion.diasAnticipacion * 24 });
    return Temporal.Instant.compare(vencimiento, limite) <= 0 ? "por-vencer" : null;
}
