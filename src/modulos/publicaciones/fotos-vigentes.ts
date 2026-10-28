import { Temporal } from "@js-temporal/polyfill";
import { claveDesdeUrlImagen } from "../../infraestructura/imagenes/almacenamiento-imagenes";
import { db } from "../../infraestructura/persistencia/prisma/db";
import { obtenerLimiteAntiguedadFotos, obtenerVigenciaFotosConfigurada } from "./vigencia-fotos";

function claveFotoPublicacion(url: string | null): string | null {
    if (!url) return null;
    const coincidencia = /^\/api\/publicaciones\/imagenes\/([1-9]\d*)\/[^/]+$/.exec(url);
    if (!coincidencia) return null;
    return claveDesdeUrlImagen(url, "publicaciones", Number(coincidencia[1]));
}

export async function ocultarFotosVencidas<T extends { foto: string | null }>(items: readonly T[]): Promise<T[]> {
    const clavesPorUrl = new Map<string, string>();
    for (const item of items) {
        const clave = claveFotoPublicacion(item.foto);
        if (clave && item.foto) clavesPorUrl.set(item.foto, clave);
    }
    if (clavesPorUrl.size === 0) return [...items];

    let diasVigencia: number | null;
    try {
        diasVigencia = obtenerVigenciaFotosConfigurada();
    } catch (error) {
        console.error("No se pueden mostrar las fotos de publicaciones porque su vigencia está mal configurada.", error);
        return items.map((item) => item.foto && clavesPorUrl.has(item.foto) ? { ...item, foto: null } : item);
    }
    if (diasVigencia === null) return [...items];

    const claves = [...new Set(clavesPorUrl.values())];
    const imagenes = await db.orm.public.Imagen.select("clave", "cargadaEn")
        .where((imagen) => imagen.clave.in(claves)).all();
    const limite = Temporal.Instant.from(obtenerLimiteAntiguedadFotos(diasVigencia));
    const vigentes = new Set(imagenes.filter((imagen) => imagen.cargadaEn === null ||
        Temporal.Instant.compare(Temporal.Instant.from(imagen.cargadaEn.toString()), limite) > 0)
        .map((imagen) => imagen.clave));

    return items.map((item) => {
        const clave = item.foto ? clavesPorUrl.get(item.foto) : undefined;
        return clave && !vigentes.has(clave) ? { ...item, foto: null } : item;
    });
}

export async function fotoPublicacionVigente(url: string | null): Promise<boolean> {
    if (!url) return false;
    const [resultado] = await ocultarFotosVencidas([{ foto: url }]);
    return resultado.foto !== null;
}
