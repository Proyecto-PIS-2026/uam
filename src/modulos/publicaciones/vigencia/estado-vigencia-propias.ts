import { Temporal } from "temporal-polyfill";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { CLAVES_VIGENCIA_PUBLICACIONES, type TipoPropietarioPublicacion } from "./claves-vigencia-publicaciones";
import { obtenerEstadoVigenciaPublicacion, type ConfiguracionAvisosVigencia, type FechaVigenciaPublicacion } from "./estado-vigencia-publicacion";

export async function obtenerConfiguracionAvisosVigencia(tipo: TipoPropietarioPublicacion, cliente: Pick<typeof db, "orm"> = db): Promise<ConfiguracionAvisosVigencia> {
    const [, , claveAvisos, claveAnticipacion] = CLAVES_VIGENCIA_PUBLICACIONES[tipo];
    const [avisos, anticipacion] = await Promise.all([
        cliente.orm.public.Configuracion.where({ nombreConfiguracion: claveAvisos }).select("valorConfiguracion").first(),
        cliente.orm.public.Configuracion.where({ nombreConfiguracion: claveAnticipacion }).select("valorConfiguracion").first(),
    ]);
    return {
        avisosHabilitados: avisos?.valorConfiguracion !== "false",
        diasAnticipacion: Math.max(1, Number(anticipacion?.valorConfiguracion ?? 7) || 7),
    };
}

export async function agregarEstadoVigenciaPropias<T extends { fechaVigencia?: FechaVigenciaPublicacion }>(
    publicaciones: readonly T[],
    tipo: TipoPropietarioPublicacion,
) {
    const ahora = Temporal.Now.instant();
    const sinAvisos = { avisosHabilitados: false, diasAnticipacion: 7 };
    const requiereAvisos = publicaciones.some((publicacion) => publicacion.fechaVigencia
        && obtenerEstadoVigenciaPublicacion(publicacion.fechaVigencia, sinAvisos, ahora) !== "vencida");
    const configuracion = requiereAvisos ? await obtenerConfiguracionAvisosVigencia(tipo) : sinAvisos;
    return publicaciones.map((publicacion) => ({
        ...publicacion,
        estadoVigencia: obtenerEstadoVigenciaPublicacion(publicacion.fechaVigencia, configuracion, ahora),
    }));
}
