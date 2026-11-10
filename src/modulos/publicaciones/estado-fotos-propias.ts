import { Temporal } from "@js-temporal/polyfill";
import { claveDesdeUrlImagen } from "../../infraestructura/imagenes/almacenamiento-imagenes";
import { db } from "../../infraestructura/persistencia/prisma/db";
import type { EstadoFotoPublicacion } from "./estado-foto-publicacion";
import { obtenerConfiguracionAgingFotos } from "./configuracion-aging-fotos";
import { obtenerLimiteAntiguedadFotos, type ConfiguracionAgingFotos } from "./vigencia-fotos";

type FotoPropia = {
    foto: string | null;
    fotoEliminadaPorVencimientoEn?: string | { toString(): string } | null;
    estadoFoto?: EstadoFotoPublicacion;
};

export async function agregarEstadoFotosPropias<T extends FotoPropia>(items: readonly T[]): Promise<(T & { estadoFoto: EstadoFotoPublicacion })[]> {
    const publicaciones = items.map((item) => ({
        ...item,
        estadoFoto: !item.foto && (item.fotoEliminadaPorVencimientoEn || item.estadoFoto === "eliminada")
            ? "eliminada" as const : null,
    }));
    let configuracion: ConfiguracionAgingFotos;
    try {
        configuracion = await obtenerConfiguracionAgingFotos();
    } catch (error) {
        console.error("No se pudo consultar la vigencia de las fotos: no se pudo obtener una configuración válida.", error);
        return publicaciones;
    }
    if (!configuracion.habilitado || !configuracion.avisosHabilitados) return publicaciones;

    const clavesPorUrl = new Map<string, string>();
    for (const { foto } of publicaciones) {
        if (!foto) continue;
        const coincidencia = /^\/api\/publicaciones\/imagenes\/([1-9]\d*)\/[^/]+$/.exec(foto);
        const clave = coincidencia ? claveDesdeUrlImagen(foto, "publicaciones", Number(coincidencia[1])) : null;
        if (clave) clavesPorUrl.set(foto, clave);
    }
    if (clavesPorUrl.size === 0) return publicaciones;

    const claves = [...new Set(clavesPorUrl.values())];
    const imagenes = await db.orm.public.Imagen.select("clave", "cargadaEn")
        .where((imagen) => imagen.clave.in(claves)).all();
    const porClave = new Map(imagenes.map((imagen) => [imagen.clave, imagen]));
    const ahora = Temporal.Now.instant().toString();
    const avisarHasta = Temporal.Instant.from(obtenerLimiteAntiguedadFotos(configuracion.diasVigencia - configuracion.diasAnticipacionAviso, ahora));

    return publicaciones.map((publicacion): T & { estadoFoto: EstadoFotoPublicacion } => {
        const clave = publicacion.foto ? clavesPorUrl.get(publicacion.foto) : undefined;
        if (!clave) return publicacion;
        const imagen = porClave.get(clave);
        if (!imagen?.cargadaEn) return publicacion;
        const cargadaEn = Temporal.Instant.from(imagen.cargadaEn.toString());
        return Temporal.Instant.compare(cargadaEn, avisarHasta) <= 0
            ? { ...publicacion, estadoFoto: "por-vencer" }
            : publicacion;
    });
}
