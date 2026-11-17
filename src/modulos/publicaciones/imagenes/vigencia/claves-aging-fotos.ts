export type TipoPropietarioFoto = "OPERADOR" | "PRODUCTOR";

// Las claves originales se conservan para operadores para mantener su configuración actual.
export const CLAVES_AGING_FOTOS = {
    OPERADOR: [
        "aging_fotos_habilitado",
        "vigencia_fotos",
        "aviso_vencimiento_fotos_habilitado",
        "anticipacion_aviso_fotos",
    ],
    PRODUCTOR: [
        "aging_fotos_productor_habilitado",
        "vigencia_fotos_productor",
        "aviso_vencimiento_fotos_productor_habilitado",
        "anticipacion_aviso_fotos_productor",
    ],
} as const;
