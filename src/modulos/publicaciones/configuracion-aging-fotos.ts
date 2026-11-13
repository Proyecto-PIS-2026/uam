import obtenerConfiguraciones from "../administracion/acciones/consultas-configuracion";
import { validarConfiguracionAgingFotos, type ConfiguracionAgingFotos } from "./vigencia-fotos";
import { CLAVES_AGING_FOTOS, type TipoPropietarioFoto } from "./claves-aging-fotos";

function leerHabilitacion(valor: string | null | undefined): boolean {
    if (valor == null || valor === "false") return false;
    if (valor === "true") return true;
    throw new Error("La habilitación del aging y sus avisos debe ser verdadera o falsa.");
}

function leerDias(valor: string | null | undefined): number {
    return valor && /^[0-9]+$/.test(valor) ? Number(valor) : Number.NaN;
}

export async function obtenerConfiguracionAgingFotos(tipo: TipoPropietarioFoto): Promise<ConfiguracionAgingFotos> {
    const claves = CLAVES_AGING_FOTOS[tipo];
    const [claveHabilitado, claveVigencia, claveAvisos, claveAnticipacion] = claves;
    const filas = await obtenerConfiguraciones(claves);
    const valores = new Map(filas.map(({ nombreConfiguracion, valorConfiguracion }) => [nombreConfiguracion, valorConfiguracion]));
    if (!leerHabilitacion(valores.get(claveHabilitado))) return { habilitado: false };

    const avisosHabilitados = leerHabilitacion(valores.get(claveAvisos));
    return validarConfiguracionAgingFotos({
        habilitado: true,
        diasVigencia: leerDias(valores.get(claveVigencia)),
        avisosHabilitados,
        diasAnticipacionAviso: avisosHabilitados ? leerDias(valores.get(claveAnticipacion)) : 0,
    });
}
