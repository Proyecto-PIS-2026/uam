import type { FiltrosConsulta, OpcionProducto, OrdenConsulta } from "../../consulta-mercado/filtros/filtros-consulta";

export type OrdenPublicaciones = OrdenConsulta;

export type PublicacionFiltrable = {
    especie: string;
    variedad: string;
    envase: string;
    kilos: string;
    categoria: string;
    calibre: string;
    codigoCalibre: string;
    precio: number | null;
    fecha: string;
    tipoPublicacion?: "OPERADOR" | "PRODUCTOR";
};

export type FiltrosPublicacionesProps<T extends PublicacionFiltrable> = {
    publicaciones: T[];
    opcionesRemotas?: OpcionProducto[];
    navesDisponibles?: string[];
    totalRemoto?: number;
    alConsultar?: (consulta: FiltrosConsulta) => void;
    especieFiltro: string;
    obtenerNombreFantasia: (publicacion: T) => string;
    alFiltrar?: (publicaciones: T[]) => void;
    alLimpiar?: () => void;
    alCambiarEspecie?: (especie: string) => void;
    ordenInicial?: OrdenPublicaciones;
    alCambiarOrden?: (orden: OrdenPublicaciones) => void;
    ordenamientoHabilitado?: boolean;
    conservarSeleccionAlActualizar?: boolean;
};

