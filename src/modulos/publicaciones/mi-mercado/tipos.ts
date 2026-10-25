export type Publicacion = {
    id: number;
    publicacionOperadorId: number;
    paisId: number | null;
    foto: string | null;
    precio: string | null;
    fecha: string;
    version: number;
    publicacionActiva: boolean;
    publicacionDisponible: boolean;
    especie: {
        id: number;
        nombreEspecie: string;
        fotoEspecie: string | null;
    };
    variedad: { id: number; nombreVariedad: string } | null;
    presentacion: { id: number; nombrePresentacion: string } | null;
    cantidadUnidades?: number | null;
    categoria: { id: number; nombreCategoria: string } | null;
    calibre: { id: number; codigoCalibre: string; nombreCalibre: string } | null;
};
