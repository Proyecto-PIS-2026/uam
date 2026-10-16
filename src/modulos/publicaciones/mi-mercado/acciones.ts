"use server";

import { obtenerSesion } from "../../identidad-acceso/autenticacion/sesiones";
import { autorizado } from "../../identidad-acceso/autorizacion/permisos";
import { ErrorAutorizacion } from "../../identidad-acceso/autorizacion/controles";
import { revalidatePath } from "next/cache";
import { obtenerOperadorAutorizado } from "../../usuarios/operadores/operador-actual";
import { actualizarPrecioPublicacion, incrementarPrecioPublicacion, ConflictoPublicacionError, obtenerPublicacionesDeOperador, PublicacionNoEncontradaError } from "./consultas-mi-mercado";
import { mapearPublicacionesMiMercado } from "./mapear-publicaciones";

export async function cargarPublicacionesMiMercado(operadorId: number) {
    const sesion = await obtenerSesion();
    if (!sesion) throw new ErrorAutorizacion(401, "Debe iniciar sesión.");

    const operador = await obtenerOperadorAutorizado(operadorId);

    if (!autorizado("operador.publicacion.consultarPropias", sesion, operador)) {
        throw new ErrorAutorizacion(403, "No tiene permisos para gestionar las publicaciones de este Operador.");
    }

    const relaciones = await obtenerPublicacionesDeOperador(operador.id);
    return mapearPublicacionesMiMercado(relaciones);
}

type ResultadoActualizarPrecio =
    | { publicacionEliminada: true }
    | { publicacionEliminada: false; fecha: string; precio: number | null; version: number; conflicto?: boolean };

export async function actualizarPrecio(publicacionId: number, nuevoPrecio: number, operadorId?: number, versionEsperada?: number): Promise<ResultadoActualizarPrecio> {
    return cambiarPrecio(publicacionId, nuevoPrecio, operadorId, false, versionEsperada);
}

export async function incrementarPrecio(publicacionId: number, incremento: number, operadorId?: number): Promise<ResultadoActualizarPrecio> {
    return cambiarPrecio(publicacionId, incremento, operadorId, true);
}

async function cambiarPrecio(publicacionId: number, valor: number, operadorId: number | undefined, incrementar: boolean, versionEsperada?: number): Promise<ResultadoActualizarPrecio> {
    const sesion = await obtenerSesion();
    if (!sesion) throw new ErrorAutorizacion(401, "Debe iniciar sesión.");

    if (operadorId !== undefined && (!Number.isSafeInteger(operadorId) || operadorId <= 0)) {
        throw new Error("El ID del operador debe ser un número entero positivo.");
    }

    const operador = await obtenerOperadorAutorizado(operadorId);

    if (!autorizado("operador.publicacion.modificar", sesion, operador)) {
        throw new ErrorAutorizacion(403, "No tiene permisos para modificar las publicaciones de este Operador.");
    }

    let resultado;
    try {
        resultado = incrementar
            ? await incrementarPrecioPublicacion(operador.id, publicacionId, valor)
            : await actualizarPrecioPublicacion(operador.id, publicacionId, valor, versionEsperada);
    } catch (error) {
        if (error instanceof ConflictoPublicacionError) return { publicacionEliminada: false, conflicto: true, ...error.actual };
        if (error instanceof PublicacionNoEncontradaError) return { publicacionEliminada: true };
        throw error;
    }

    const rutas = [
        "/publicaciones",
        `/operadores/${encodeURIComponent(operador.nombreFantasia)}`,
        "/operadores",
        "/inicio",
    ];

    for (const ruta of rutas) {
        try {
            revalidatePath(ruta);
        } catch (error) {
            console.error(`No se pudo revalidar ${ruta} tras guardar el precio:`, error);
        }
    }

    return { publicacionEliminada: false, ...resultado };
}
