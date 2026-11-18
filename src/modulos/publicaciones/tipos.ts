import type { EstadoFotoPublicacion } from "./imagenes/vigencia/estado-foto-publicacion";
import type { EstadoVigenciaPublicacion } from "./vigencia/estado-vigencia-publicacion";

export type Publicacion = {
    id: number;
    publicacionOperadorId: number;
    paisId: number | null;
    foto: string | null;
    estadoFoto?: EstadoFotoPublicacion;
    estadoVigencia?: EstadoVigenciaPublicacion;
    precio: string | null;
    fecha: string;
    fechaVigencia: string | null;
    version: number;
    publicacionActiva: boolean;
    publicacionDisponible: boolean;
    especie: {
        id: number;
        nombreEspecie: string;
        fotoEspecie: string | null;
    };
    variedad: { id: number; nombreVariedad: string } | null;
    envase: { id: number; nombreEnvase: string } | null;
    kilos: { id: number; valor: string } | null;
    cantidadUnidades?: number | null;
    comentario?: string | null;
    categoria: { id: number; nombreCategoria: string } | null;
    calibre: { id: number; codigoCalibre: string; nombreCalibre: string } | null;
};
