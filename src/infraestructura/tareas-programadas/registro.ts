import { procesarVencimientosFotos } from "../../modulos/publicaciones/procesar-vencimientos-fotos";
import { obtenerConfiguracionAgingFotos } from "../../modulos/publicaciones/configuracion-aging-fotos";
import type { ConfiguracionAgingFotos } from "../../modulos/publicaciones/vigencia-fotos";
import type { TipoPropietarioFoto } from "../../modulos/publicaciones/claves-aging-fotos";
import type { TareaDiaria } from "./tipos";
import { obtenerConfiguracionAvisosLocales } from "../../modulos/usuarios/operadores/configuracion-avisos-locales";
import { procesarVencimientosLocales } from "../../modulos/usuarios/operadores/procesar-vencimientos-locales";

function crearTareaAgingFotos(tipo: TipoPropietarioFoto): TareaDiaria {
    return {
        // Mantener el nombre de operadores conserva el registro de sus ejecuciones anteriores.
        nombre: tipo === "OPERADOR" ? "publicaciones.eliminar-fotos-vencidas" : "publicaciones.productores.eliminar-fotos-vencidas",
        habilitada: async () => (await obtenerConfiguracionAgingFotos(tipo)).habilitado,
        ejecutar: async (contexto) => {
            let configuracion: ConfiguracionAgingFotos;
            try {
                configuracion = await obtenerConfiguracionAgingFotos(tipo);
            } catch (error) {
                console.error(`No se ejecutó el aging de fotos de ${tipo}: no se pudo obtener una configuración válida.`, error);
                throw error;
            }
            if (!configuracion.habilitado) return "deshabilitada";
            return procesarVencimientosFotos(contexto, configuracion, tipo);
        },
    };
}

export function obtenerTareasDiarias(): readonly TareaDiaria[] {
    return [crearTareaAgingFotos("OPERADOR"), crearTareaAgingFotos("PRODUCTOR"), {
        nombre: "operadores.avisar-vencimientos-locales",
        habilitada: () => obtenerConfiguracionAvisosLocales().habilitado,
        ejecutar: async (contexto) => {
            const configuracion = obtenerConfiguracionAvisosLocales();
            if (!configuracion.habilitado) return "deshabilitada";
            return procesarVencimientosLocales(contexto, configuracion);
        },
    }];
}
