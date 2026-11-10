// Cambiar a false deshabilita los avisos de contratos próximos a vencer y vencidos.
export const AVISOS_VENCIMIENTO_LOCALES_HABILITADOS = true;
export const DIAS_ANTICIPACION_AVISO_LOCALES = 3;

export type ConfiguracionAvisosLocales = {
    habilitado: boolean;
    diasAnticipacionAviso: number;
};

export function obtenerConfiguracionAvisosLocales(): ConfiguracionAvisosLocales {
    return {
        habilitado: AVISOS_VENCIMIENTO_LOCALES_HABILITADOS,
        diasAnticipacionAviso: DIAS_ANTICIPACION_AVISO_LOCALES,
    };
}
