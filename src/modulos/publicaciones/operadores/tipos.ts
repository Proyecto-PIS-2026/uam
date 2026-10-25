import type { SeleccionPublicacion } from "../seleccion-publicacion";

export type CambiosPublicacionOperador = SeleccionPublicacion & {
    version: number;
    precio: string | null;
    cantidadUnidades?: number | null;
    foto?: string | null;
    disponible: boolean;
};

export type OpcionEdicion = {
    id: number;
    nombre: string;
};

export type OpcionVariedad = OpcionEdicion & {
    especieId: number;
};

export type OpcionPresentacion = OpcionEdicion & {
    variedadId: number;
};

export type OpcionCategoria = OpcionEdicion & {
    especieId: number | null;
};

export type PublicacionParaEditar = Omit<CambiosPublicacionOperador, "version"> & {
    version?: number;
    foto: string | null;
    fecha: string;
    publicacionOperadorId: number;
    publicacionId: number;
    especieId: number;
    variedadId: number | null;
    especie: string;
    variedad: string;
    presentacion?: string;
    cantidadUnidades?: number | null;
    categoria?: string;
    calibre?: string;
};

export type OpcionesEdicionPublicacion = {
    especies: OpcionEdicion[];
    variedades: OpcionVariedad[];
    presentaciones: OpcionPresentacion[];
    categorias: OpcionCategoria[];
    calibres: OpcionEdicion[];
    paises: OpcionEdicion[];
};
