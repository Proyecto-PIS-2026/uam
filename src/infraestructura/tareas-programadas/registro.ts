import { procesarVencimientosFotos } from "../../modulos/publicaciones/procesar-vencimientos-fotos";
import { obtenerConfiguracionAgingFotos } from "../../modulos/publicaciones/configuracion-aging-fotos";
import type { ConfiguracionAgingFotos } from "../../modulos/publicaciones/vigencia-fotos";
import type { TareaDiaria } from "./tipos";

export function obtenerTareasDiarias(): readonly TareaDiaria[] {
    return [{
        nombre: "publicaciones.eliminar-fotos-vencidas",
        habilitada: async () => (await obtenerConfiguracionAgingFotos()).habilitado,
        ejecutar: async (contexto) => {
            let configuracion: ConfiguracionAgingFotos;
            try {
                configuracion = await obtenerConfiguracionAgingFotos();
            } catch (error) {
                console.error("No se ejecutó el aging de fotos: no se pudo obtener una configuración válida.", error);
                throw error;
            }
            if (!configuracion.habilitado) return "deshabilitada";
            return procesarVencimientosFotos(contexto, configuracion);
        },
    }];
}
