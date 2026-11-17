import type { Publicacion } from "../tipos";

export type PublicacionMiMercadoProductor = Omit<Publicacion, "publicacionOperadorId" | "version"> & {
    publicacionProductorId: number;
    pais: string;
    fechaVigencia: string | null;
    ubicaciones: {
        id: number;
        nombreUbicacion: string;
        urlMaps: string;
        departamento?: string | null;
    }[];
};
