"use server";

import {
    consultarPublicaciones,
    type ResultadoPublicaciones,
} from "./PublicacionesOperador";
import { exigirConsultaMercadoPublico } from "@/modulos/identidad-acceso/autorizacion/controles";
import { obtenerConfiguracionOrdenamiento } from "./configuracion-ordenamiento";
import { convertirOrdenMercados } from "./ordenamiento-publicaciones";
import type { FiltrosConsulta } from "./filtros-consulta";

export default async function obtenerPublicaciones(
    filtros: FiltrosConsulta = {},
): Promise<ResultadoPublicaciones | null> {
    await exigirConsultaMercadoPublico();

    const configuracion = await obtenerConfiguracionOrdenamiento();
    const ordenPredeterminado = convertirOrdenMercados(
        configuracion.ordenLanding,
    );

    console.log("Orden de Mercado Virtual:", {
    configurado: configuracion.ordenMercados,
    habilitado: configuracion.habilitado,
    recibido: filtros.orden,
    aplicado: configuracion.habilitado
        ? filtros.orden ?? ordenPredeterminado
        : ordenPredeterminado,
});

    return consultarPublicaciones({
        ...filtros,
        orden: configuracion.habilitado
            ? filtros.orden ?? ordenPredeterminado
            : ordenPredeterminado,
    });
}