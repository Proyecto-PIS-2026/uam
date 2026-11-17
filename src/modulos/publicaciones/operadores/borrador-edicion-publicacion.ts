import type { CambiosPublicacionOperador, PublicacionParaEditar } from "./tipos";
import { normalizarPrecioPublicacion } from "../precio-publicacion";

export function precioParaEdicion(precio: string | null) {
    if (precio === null) return "";
    const valor = Number(precio);
    return Number.isInteger(valor) ? String(valor) : precio;
}

type BorradorPublicacionOperador = {
    publicacion: PublicacionParaEditar;
    precio: string;
    cantidadUnidades: string;
    comentario: string;
    foto: string | null;
    fotoNueva: File | null;
    especieId: number;
    variedadId: number;
    categoriaId: number;
    calibreId: number;
    envaseId: number;
    kilosId: number;
    paisId: number;
    disponible: boolean;
    fechaVigenciaEditada: string;
};

export function prepararCambiosPublicacionOperador({ publicacion, precio, cantidadUnidades, comentario, foto, fotoNueva, especieId, variedadId, categoriaId, calibreId, envaseId, kilosId, paisId, disponible, fechaVigenciaEditada }: BorradorPublicacionOperador) {
    const precioNuevo = normalizarPrecioPublicacion(precio);
    const precioOriginal = precioParaEdicion(publicacion.precio).trim() || null;
    const cantidadUnidadesNormalizada = typeof cantidadUnidades === "string" ? cantidadUnidades.trim() : String(cantidadUnidades ?? "").trim();
    const cantidadFinal = (cantidadUnidadesNormalizada === "" ? null : Number(cantidadUnidadesNormalizada)) as number | null;
    const cantidadOriginal = publicacion.cantidadUnidades ?? null;
    const comentarioFinal = comentario.trim() || null;
    const comentarioOriginal = publicacion.comentario ?? null;

    const sinCambios =
        precioNuevo === precioOriginal &&
        cantidadFinal === cantidadOriginal &&
        comentarioFinal === comentarioOriginal &&
        foto === publicacion.foto &&
        fotoNueva === null &&
        especieId === publicacion.especieId &&
        variedadId === (publicacion.variedadId ?? 0) &&
        categoriaId === (publicacion.categoriaId ?? 0) &&
        calibreId === (publicacion.calibreId ?? 0) &&
        envaseId === (publicacion.envaseId ?? 0) &&
        kilosId === (publicacion.kilosId ?? 0) &&
        paisId === (publicacion.paisId ?? 0) &&
        disponible === publicacion.disponible &&
        fechaVigenciaEditada === (publicacion.fechaVigencia ?? "");

    const cambios: CambiosPublicacionOperador = {
        version: publicacion.version ?? 0,
        precio: precioNuevo,
        cantidadUnidades: cantidadFinal,
        comentario: comentarioFinal,
        foto: foto === publicacion.foto ? undefined : foto,
        especieId,
        variedadId: variedadId || null,
        categoriaId: categoriaId || null,
        calibreId: calibreId || null,
        envaseId: envaseId || null,
        kilosId: kilosId || null,
        paisId: paisId || null,
        disponible,
        fechaVigencia: fechaVigenciaEditada || null,
    };
    return { cambios, sinCambios };
}
