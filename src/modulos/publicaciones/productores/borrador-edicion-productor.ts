import type { PublicacionMiMercadoProductor } from "./tipos";
import type { CambiosPublicacionProductor } from "./operaciones/modificar-publicacion";
import type { OpcionesEdicionPublicacion } from "../catalogos/tipos";
import type { UbicacionEdicionProductor } from "./componentes/UbicacionesEdicionProductor";
import { validarUbicacionesProductor } from "./validaciones/ubicaciones-productor";
import { PRECIO_PUBLICACION_INVALIDO, normalizarPrecioPublicacion, precioPublicacionValido } from "../precio-publicacion";

export type BorradorPublicacionProductor = {
    precio: string;
    cantidadUnidades: string;
    fechaVigencia: string;
    comentario: string;
    especieId: number;
    variedadId: number;
    envaseId: number;
    kilosId: number;
    categoriaId: number;
    calibreId: number;
    paisId: number;
    disponible: boolean;
    foto: string | null;
    archivo: File | null;
    vistaPrevia: string | null;
    ubicaciones: UbicacionEdicionProductor[];
};

export function crearBorrador(publicacion: PublicacionMiMercadoProductor): BorradorPublicacionProductor {
    return {
        precio: publicacion.precio === null ? "" : String(Number(publicacion.precio)),
        cantidadUnidades: publicacion.cantidadUnidades == null ? "" : String(publicacion.cantidadUnidades),
        fechaVigencia: publicacion.fechaVigencia ?? "",
        comentario: publicacion.comentario ?? "",
        especieId: publicacion.especie.id,
        variedadId: publicacion.variedad?.id ?? 0,
        envaseId: publicacion.envase?.id ?? 0,
        kilosId: publicacion.kilos?.id ?? 0,
        categoriaId: publicacion.categoria?.id ?? 0,
        calibreId: publicacion.calibre?.id ?? 0,
        paisId: publicacion.paisId ?? 0,
        disponible: publicacion.publicacionDisponible,
        foto: publicacion.foto, archivo: null, vistaPrevia: null,
        ubicaciones: publicacion.ubicaciones.map(({ id, nombreUbicacion, urlMaps, departamento }) => ({ clave: id, nombreUbicacion, urlMaps, departamento })),
    };
}

export function prepararCambiosPublicacionProductor(base: PublicacionMiMercadoProductor, borrador: BorradorPublicacionProductor, opciones: OpcionesEdicionPublicacion):
    | { esValido: false; error: string }
    | { esValido: true; cambios: CambiosPublicacionProductor; sinCambios: boolean } {
    const variedades = opciones.variedades.filter((opcion) => opcion.especieId === borrador.especieId);
    const { envases, kilos, categorias } = opciones;
    if (!precioPublicacionValido(borrador.precio)) {
        return { esValido: false, error: PRECIO_PUBLICACION_INVALIDO };
    }
    if (borrador.cantidadUnidades !== "" && (!/^(0|[1-9]\d{0,9})$/.test(borrador.cantidadUnidades) || Number(borrador.cantidadUnidades) > 2147483647)) {
        return { esValido: false, error: "La cantidad de unidades debe ser un número entero entre 0 y 2147483647." };
    }
    if (!opciones.especies.some((opcion) => opcion.id === borrador.especieId)
        || (borrador.variedadId !== 0 && !variedades.some((opcion) => opcion.id === borrador.variedadId))
        || (borrador.envaseId !== 0 && !envases.some((opcion) => opcion.id === borrador.envaseId))
        || (borrador.kilosId !== 0 && !kilos.some((opcion) => opcion.id === borrador.kilosId))
        || (borrador.categoriaId !== 0 && !categorias.some((opcion) => opcion.id === borrador.categoriaId))
        || (borrador.calibreId !== 0 && !opciones.calibres.some((opcion) => opcion.id === borrador.calibreId))
        || (borrador.paisId !== 0 && !opciones.paises.some((opcion) => opcion.id === borrador.paisId))) {
        return { esValido: false, error: "Elegí una especie, variedad, empaquetado, kilos, categoría, calibre y país válidos." };
    }
    const validacionUbicaciones = validarUbicacionesProductor(borrador.ubicaciones);
    if (!validacionUbicaciones.esValido) {
        return { esValido: false, error: validacionUbicaciones.error };
    }
    const cambios: CambiosPublicacionProductor = {
        precio: normalizarPrecioPublicacion(borrador.precio),
        cantidadUnidades: borrador.cantidadUnidades === "" ? null : Number(borrador.cantidadUnidades),
        comentario: borrador.comentario.trim() || null,
        especieId: borrador.especieId, variedadId: borrador.variedadId || null,
        envaseId: borrador.envaseId || null, kilosId: borrador.kilosId || null, categoriaId: borrador.categoriaId || null, calibreId: borrador.calibreId || null,
        paisId: borrador.paisId || null, disponible: borrador.disponible,
        foto: borrador.foto === base.foto ? undefined : borrador.foto,
        ubicaciones: validacionUbicaciones.ubicaciones,
        fechaVigencia: borrador.fechaVigencia || null,
    };
    const original = crearBorrador(base);
    const ubicacionesSinCambios = cambios.ubicaciones.length === original.ubicaciones.length
        && cambios.ubicaciones.every((ubicacion, indice) => {
            const anterior = original.ubicaciones[indice];
            return ubicacion.nombreUbicacion === anterior.nombreUbicacion.trim()
                && ubicacion.urlMaps === anterior.urlMaps.trim()
                && (ubicacion.departamento ?? null) === (anterior.departamento ?? null);
        });
    const sinCambios =
        cambios.precio === (original.precio || null)
        && cambios.cantidadUnidades === (base.cantidadUnidades ?? null)
        && cambios.comentario === (original.comentario.trim() || null)
        && (cambios.fechaVigencia?.slice(0, 10) ?? "") === original.fechaVigencia.slice(0, 10)
        && borrador.especieId === original.especieId
        && borrador.variedadId === original.variedadId
        && borrador.envaseId === original.envaseId
        && borrador.kilosId === original.kilosId
        && borrador.categoriaId === original.categoriaId
        && borrador.calibreId === original.calibreId
        && borrador.paisId === original.paisId
        && borrador.disponible === original.disponible
        && borrador.foto === original.foto
        && borrador.archivo === null
        && ubicacionesSinCambios;
    return { esValido: true, cambios, sinCambios };
}
