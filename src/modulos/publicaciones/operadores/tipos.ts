import type { SeleccionPublicacion } from "../seleccion-publicacion";
import type { EstadoFotoPublicacion } from "../imagenes/vigencia/estado-foto-publicacion";
import type { EstadoVigenciaPublicacion } from "../vigencia/estado-vigencia-publicacion";

export type CambiosPublicacionOperador = SeleccionPublicacion & {
    version: number;
    precio: string | null;
    cantidadUnidades?: number | null;
    comentario?: string | null;
    foto?: string | null;
    disponible: boolean;
    fechaVigencia?: string | null;
};

export type PublicacionParaEditar = Omit<CambiosPublicacionOperador, "version"> & {
    version?: number;
    foto: string | null;
    estadoFoto?: EstadoFotoPublicacion;
    estadoVigencia?: EstadoVigenciaPublicacion;
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
