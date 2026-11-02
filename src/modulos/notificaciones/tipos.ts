export type NotificacionUsuario = {
    id: number;
    texto: string;
    url: string | null;
    leida: boolean;
    fecha: string;
};

export type NotificacionesUsuario = {
    notificaciones: NotificacionUsuario[];
    noLeidas: number;
};
