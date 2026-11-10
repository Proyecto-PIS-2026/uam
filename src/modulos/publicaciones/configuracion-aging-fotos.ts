import obtenerConfiguraciones from "../administracion/acciones/consultas-configuracion";
import { validarConfiguracionAgingFotos, type ConfiguracionAgingFotos } from "./vigencia-fotos";

function leerHabilitacion(valor: string | null | undefined): boolean {
    if (valor == null || valor === "false") return false;
    if (valor === "true") return true;
    throw new Error("La habilitación del aging y sus avisos debe ser verdadera o falsa.");
}

function leerDias(valor: string | null | undefined): number {
    return valor && /^[0-9]+$/.test(valor) ? Number(valor) : Number.NaN;
}

export async function obtenerConfiguracionAgingFotos(): Promise<ConfiguracionAgingFotos> {
    const filas = await obtenerConfiguraciones([
        "aging_fotos_habilitado",
        "vigencia_fotos",
        "aviso_vencimiento_fotos_habilitado",
        "anticipacion_aviso_fotos",
    ]);
    const valores = new Map(filas.map(({ nombreConfiguracion, valorConfiguracion }) => [nombreConfiguracion, valorConfiguracion]));
    if (!leerHabilitacion(valores.get("aging_fotos_habilitado"))) return { habilitado: false };

    const avisosHabilitados = leerHabilitacion(valores.get("aviso_vencimiento_fotos_habilitado"));
    return validarConfiguracionAgingFotos({
        habilitado: true,
        diasVigencia: leerDias(valores.get("vigencia_fotos")),
        avisosHabilitados,
        diasAnticipacionAviso: avisosHabilitados ? leerDias(valores.get("anticipacion_aviso_fotos")) : 0,
    });
}
