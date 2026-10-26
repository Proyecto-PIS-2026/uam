import { idCatalogoValido, normalizarSeleccionPublicacion, type SeleccionPublicacion } from "./seleccion-publicacion";
import { PRECIO_PUBLICACION_INVALIDO, precioPublicacionValido } from "./precio-publicacion";
import { validarUbicacionesProductor, type UbicacionPublicacionProductor } from "./productores/ubicaciones-productor";

export type DatosAltaPublicacionProductor = SeleccionPublicacion & {
    productorId: number;
    latitud?: number | null;
    longitud?: number | null;
    departamento?: string | null;
    nombreLugar?: string | null;
    ubicaciones?: UbicacionPublicacionProductor[];
    disponibilidad: boolean;
    precio?: string | null;
    cantidadUnidades?: number | null;
    fotografia?: string;
};

export type ResultadoValidacionProductor =
    | { esValido: true; datos: DatosAltaPublicacionProductor }
    | { esValido: false; errores: string[] };

const TAMANO_MAXIMO_FOTOGRAFIA = 10 * 1024 * 1024;

function fotografiaValida(fotografia: string): boolean {
    if (fotografia === "") return true;
    const separador = fotografia.indexOf(",");
    if (separador < 0 || !/^data:image\/(?:png|jpeg|webp);base64$/.test(fotografia.slice(0, separador))) return false;
    const contenido = fotografia.slice(separador + 1);
    if (contenido.length === 0 || contenido.length % 4 !== 0 || contenido.length > Math.ceil(TAMANO_MAXIMO_FOTOGRAFIA / 3) * 4) return false;
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(contenido)) return false;
    const relleno = contenido.endsWith("==") ? 2 : contenido.endsWith("=") ? 1 : 0;
    const tamano = contenido.length / 4 * 3 - relleno;
    return tamano > 0 && tamano <= TAMANO_MAXIMO_FOTOGRAFIA;
}

export function validarAltaPublicacionProductor(valor: unknown): ResultadoValidacionProductor {
    if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
        return { esValido: false, errores: ["Los datos de la publicación no son válidos."] };
    }

    const datos = valor as Record<string, unknown>;
    const errores: string[] = [];
    const seleccion = normalizarSeleccionPublicacion(datos);
    if (!seleccion.esValido) errores.push(...seleccion.errores);
    if (!idCatalogoValido(datos.productorId)) errores.push("El campo productorId es obligatorio.");
    const tieneUbicaciones = Object.hasOwn(datos, "ubicaciones");
    const ubicaciones = tieneUbicaciones ? validarUbicacionesProductor(datos.ubicaciones) : undefined;
    if (ubicaciones && !ubicaciones.esValido) errores.push(ubicaciones.error);
    const hayUbicacion = !tieneUbicaciones && [datos.latitud, datos.longitud, datos.departamento, datos.nombreLugar]
        .some((valor) => valor !== undefined && valor !== null && valor !== "");
    if (hayUbicacion && (typeof datos.latitud !== "number" || !Number.isFinite(datos.latitud) || datos.latitud < -90 || datos.latitud > 90)) {
        errores.push("La latitud no es válida.");
    }
    if (hayUbicacion && (typeof datos.longitud !== "number" || !Number.isFinite(datos.longitud) || datos.longitud < -180 || datos.longitud > 180)) {
        errores.push("La longitud no es válida.");
    }
    if (hayUbicacion && (typeof datos.departamento !== "string" || datos.departamento.trim() === "")) {
        errores.push("El departamento de la ubicación no es válido.");
    }
    if (!tieneUbicaciones && datos.nombreLugar !== null && datos.nombreLugar !== undefined && datos.nombreLugar !== "" &&
        (typeof datos.nombreLugar !== "string" || datos.nombreLugar.trim() === "" || datos.nombreLugar.length > 300)) {
        errores.push("El nombre de la ubicación no es válido.");
    }
    if (datos.disponibilidad !== undefined && typeof datos.disponibilidad !== "boolean") errores.push("La disponibilidad no es válida.");
    if (datos.precio !== undefined && !precioPublicacionValido(datos.precio)) {
        errores.push(PRECIO_PUBLICACION_INVALIDO);
    }
    if (datos.fotografia !== undefined && (typeof datos.fotografia !== "string" || !fotografiaValida(datos.fotografia))) {
        errores.push("La fotografía debe ser PNG, JPEG o WebP y pesar hasta 10 MB.");
    }
    if (datos.cantidadUnidades !== undefined && datos.cantidadUnidades !== null &&
        (typeof datos.cantidadUnidades !== "number" || !Number.isSafeInteger(datos.cantidadUnidades) || datos.cantidadUnidades < 0 || datos.cantidadUnidades > 2147483647)) {
        errores.push("La cantidad de unidades debe ser un número entero entre 0 y 2147483647.");
    }
    if (errores.length > 0) return { esValido: false, errores };
    if (!seleccion.esValido) return seleccion;
    return { esValido: true, datos: { ...datos, ...seleccion.seleccion, disponibilidad: datos.disponibilidad ?? true,
        ...(ubicaciones?.esValido ? { ubicaciones: ubicaciones.ubicaciones } : {}) } as DatosAltaPublicacionProductor };
}
