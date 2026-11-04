import { procesarVencimientosFotos } from "../../modulos/publicaciones/procesar-vencimientos-fotos";
import { obtenerConfiguracionAgingFotos, type ConfiguracionAgingFotos } from "../../modulos/publicaciones/vigencia-fotos";
import type { TareaDiaria } from "./tipos";

export function obtenerTareasDiarias(): readonly TareaDiaria[] {
    return [{
        nombre: "publicaciones.eliminar-fotos-vencidas",
        habilitada: () => obtenerConfiguracionAgingFotos().habilitado,
        ejecutar: async (contexto) => {
            let configuracion: ConfiguracionAgingFotos;
            try {
                configuracion = obtenerConfiguracionAgingFotos();
            } catch (error) {
                console.error("No se ejecutó el aging de fotos: su configuración es inválida.", error);
                throw error;
            }
            return procesarVencimientosFotos(contexto, configuracion);
        },
    }];
}
