import type { TransaccionTarea } from "@/infraestructura/tareas-programadas/tipos";

// Cambiar a false deshabilita los avisos de contratos próximos a vencer y vencidos.
export const AVISOS_VENCIMIENTO_LOCALES_HABILITADOS = true;
export const CLAVE_ANTICIPACION_AVISO_LOCALES = "anticipacion_aviso_vencimiento_locales";
export const DIAS_ANTICIPACION_AVISO_LOCALES = 3;
export const MAXIMO_DIAS_ANTICIPACION_AVISO_LOCALES = 365;

export type ConfiguracionAvisosLocales = {
    habilitado: boolean;
    diasAnticipacionAviso: number;
};

export function validarAnticipacionAvisoLocales(valor: string): void {
    const dias = Number(valor);
    if (!/^[0-9]+$/.test(valor) || !Number.isSafeInteger(dias) || dias > MAXIMO_DIAS_ANTICIPACION_AVISO_LOCALES) {
        throw new Error("La anticipación de los avisos de locales debe ser un entero entre 0 y 365 días.");
    }
}

export async function obtenerConfiguracionAvisosLocales(tx: TransaccionTarea): Promise<ConfiguracionAvisosLocales> {
    if (!AVISOS_VENCIMIENTO_LOCALES_HABILITADOS) {
        return { habilitado: false, diasAnticipacionAviso: DIAS_ANTICIPACION_AVISO_LOCALES };
    }
    const configuracion = await tx.orm.public.Configuracion
        .where({ nombreConfiguracion: CLAVE_ANTICIPACION_AVISO_LOCALES })
        .select("valorConfiguracion")
        .first();
    const valor = configuracion?.valorConfiguracion;
    if (valor != null) validarAnticipacionAvisoLocales(valor);
    return {
        habilitado: true,
        diasAnticipacionAviso: valor == null ? DIAS_ANTICIPACION_AVISO_LOCALES : Number(valor),
    };
}
