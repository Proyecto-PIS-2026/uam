export type Publicacion = {
    id: number;
    publicacionOperadorId: number;
    paisId: number;
    foto: string | null;
    precio: string | null;
    fecha: string;
    version: number;
    publicacionActiva: boolean;
    publicacionDisponible: boolean;
    presentacion: {
        id: number;
        nombrePresentacion: string;
        variedad: {
            id: number;
            nombreVariedad: string;
            especie: {
                id: number;
                nombreEspecie: string;
                fotoEspecie: string | null;
            };
        };
    };
    cantidadUnidades?: number | null;
    categoria: {
        id: number;
        nombreCategoria: string;
    };
    calibre: {
        id: number;
        codigoCalibre: string;
        nombreCalibre: string;
    };
};
