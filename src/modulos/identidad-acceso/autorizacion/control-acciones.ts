import { redirect } from "next/navigation";
import { cerrarSesion, obtenerSesion } from "../autenticacion/sesiones";
import { RUTA_INICIO_SESION } from "../autenticacion/rutas-sesion";
import { ErrorAutorizacion } from "./controles";

export async function controlarSesionEnAccion<T>(control: () => Promise<T>): Promise<T> {
    try {
        return await control();
    } catch (error) {
        if (error instanceof ErrorAutorizacion && error.status === 401) {
            await cerrarSesion();
            redirect(RUTA_INICIO_SESION);
        }
        throw error;
    }
}

export async function exigirSesionEnAccion() {
    const sesion = await obtenerSesion();
    if (!sesion) {
        await cerrarSesion();
        redirect(RUTA_INICIO_SESION);
    }
    return sesion;
}
