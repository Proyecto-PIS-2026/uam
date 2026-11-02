export type RangoTiempo = "1s" | "1m" | "3m" | "6m" | "1y" | "personalizado" | "todo";

export type TipoSeccionEstadistica = "visitas" | "contactos" | "publicaciones";

export interface FiltrosEstadistica {
    rango: RangoTiempo;
    fechaDesde: string;
    fechaHasta: string;
    filtroEspecifico: string;
}

export interface EstadisticaVisitaItem {
    id: number;
    fecha: Date | string;
    tipoVisitante: string;
    cantidad: number;
}

export interface EstadisticaContactoItem {
    id: number;
    fecha: Date | string;
    username: string;
    cantidad: number;
}

export interface EstadisticaPublicacionItem {
    id: number;
    fecha: Date | string;
    username: string;
    cantidad: number;
}