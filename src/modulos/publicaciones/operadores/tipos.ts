import type { SeleccionPublicacion } from "../seleccion-publicacion";
import type { EstadoFotoPublicacion } from "../estado-foto-publicacion";

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

export type OpcionCategoria = OpcionEdicion & {
    especieId: number | null;
};

export type PublicacionParaEditar = Omit<CambiosPublicacionOperador, "version"> & {
    version?: number;
    foto: string | null;
    estadoFoto?: EstadoFotoPublicacion;
    fecha: string;
    publicacionOperadorId: number;
    publicacionId: number;
    especieId: number;
    variedadId: number | null;
    especie: string;
    variedad: string;
    envase?: string;
    kilos?: string;
    cantidadUnidades?: number | null;
    categoria?: string;
    calibre?: string;
};

export type OpcionesEdicionPublicacion = {
    especies: OpcionEdicion[];
    variedades: OpcionVariedad[];
    envases: OpcionEdicion[];
    kilos: OpcionEdicion[];
    categorias: OpcionCategoria[];
    calibres: OpcionEdicion[];
    paises: OpcionEdicion[];
};
