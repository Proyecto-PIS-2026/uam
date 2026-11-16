import type { TransaccionTarea } from "@/infraestructura/tareas-programadas/tipos";

export const CLAVE_HABILITACION_AVISO_LOCALES = "aviso_vencimiento_locales_habilitado";
export const AVISOS_VENCIMIENTO_LOCALES_HABILITADOS_POR_DEFECTO = true;
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

export async function obtenerConfiguracionAvisosLocales(tx: Pick<TransaccionTarea, "orm">): Promise<ConfiguracionAvisosLocales> {
    const configuraciones = await tx.orm.public.Configuracion
        .where((configuracion) => configuracion.nombreConfiguracion.in([
            CLAVE_HABILITACION_AVISO_LOCALES,
            CLAVE_ANTICIPACION_AVISO_LOCALES,
        ]))
        .select("nombreConfiguracion", "valorConfiguracion")
        .all();
    const valores = new Map(configuraciones.map(({ nombreConfiguracion, valorConfiguracion }) => [nombreConfiguracion, valorConfiguracion]));
    const habilitacion = valores.get(CLAVE_HABILITACION_AVISO_LOCALES);
    if (habilitacion != null && habilitacion !== "true" && habilitacion !== "false") {
        throw new Error("La habilitación de los avisos de locales debe ser verdadera o falsa.");
    }
    const valor = valores.get(CLAVE_ANTICIPACION_AVISO_LOCALES);
    if (valor != null) validarAnticipacionAvisoLocales(valor);
    return {
        habilitado: habilitacion == null ? AVISOS_VENCIMIENTO_LOCALES_HABILITADOS_POR_DEFECTO : habilitacion === "true",
        diasAnticipacionAviso: valor == null ? DIAS_ANTICIPACION_AVISO_LOCALES : Number(valor),
    };
}
