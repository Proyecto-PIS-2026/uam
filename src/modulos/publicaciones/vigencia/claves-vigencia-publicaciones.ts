export type TipoPropietarioPublicacion = "OPERADOR" | "PRODUCTOR";

export const MAXIMO_DIAS_ANTICIPACION_PUBLICACIONES = 36500;

export const CLAVES_VIGENCIA_PUBLICACIONES = {
    OPERADOR: [
        "vigencia_publicaciones_operador_habilitada",
        "vigencia_publicaciones_operador",
        "aviso_vencimiento_publicaciones_operador_habilitado",
        "anticipacion_aviso_publicaciones_operador",
    ],
    PRODUCTOR: [
        "vigencia_publicaciones_productor_habilitada",
        "vigencia_publicaciones_productor",
        "aviso_vencimiento_publicaciones_productor_habilitado",
        "anticipacion_aviso_publicaciones_productor",
    ],
} as const;
