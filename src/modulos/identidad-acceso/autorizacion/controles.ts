import { redirect } from "next/navigation";
import { obtenerSesion, type RolUsuario } from "../autenticacion/sesiones";
import { RUTA_SESION_FINALIZADA } from "../autenticacion/rutas-sesion";
import { obtenerRutaPrincipal } from "./rutas";
import { autorizado } from "./permisos";

type SesionAutenticada = NonNullable<Awaited<ReturnType<typeof obtenerSesion>>>;

export class ErrorAutorizacion extends Error {
    constructor(public readonly status: 401 | 403, mensaje: string) {
        super(mensaje);
        this.name = "ErrorAutorizacion";
    }
}

async function exigirRol(rol: RolUsuario): Promise<SesionAutenticada> {
    const sesion = await obtenerSesion();
    if (!sesion) {
        throw new ErrorAutorizacion(401, "Iniciá sesión para continuar.");
    }
    if (sesion.rol !== rol) {
        throw new ErrorAutorizacion(403, "No tenés permiso para realizar esta operación.");
    }
    return sesion;
}

async function requerirRol(rol: RolUsuario): Promise<SesionAutenticada> {
    const sesion = await obtenerSesion();
    if (!sesion) {
        redirect(RUTA_SESION_FINALIZADA);
    }
    if (sesion.rol !== rol) {
        redirect(obtenerRutaPrincipal(sesion.rol));
    }
    return sesion;
}

export async function redirigirAMercadoPropio() {
    const sesion = await obtenerSesion();
    if (sesion?.rol === "OPERADOR" || sesion?.rol === "PRODUCTOR") {
        redirect(obtenerRutaPrincipal(sesion.rol));
    }
    return sesion;
}

export async function redirigirProductorAMiMercado() {
    const sesion = await obtenerSesion();
    if (sesion?.rol === "PRODUCTOR") {
        redirect(obtenerRutaPrincipal(sesion.rol));
    }
    return sesion;
}

export async function exigirConsultaMercadoPublico() {
    const sesion = await obtenerSesion();
    if (sesion?.rol === "OPERADOR") {
        throw new ErrorAutorizacion(403, "Los operadores sólo pueden consultar su propio mercado.");
    }
    if (sesion?.rol === "PRODUCTOR") {
        throw new ErrorAutorizacion(403, "Los productores sólo pueden consultar su propio mercado.");
    }
}

export async function exigirConsultaMercadoOperador() {
    await exigirConsultaProductores("No tenés permiso para consultar las publicaciones de productores.");
}

export async function exigirConsultaProductores(mensaje = "No tenés permiso para consultar productores y sus publicaciones.") {
    const sesion = await obtenerSesion();
    if (!sesion) {
        throw new ErrorAutorizacion(401, "Iniciá sesión para continuar.");
    }
    if (!autorizado("productor.publicacion.consultar", sesion)) {
        throw new ErrorAutorizacion(403, mensaje);
    }
    return sesion;
}

export async function requerirConsultaProductores() {
    const sesion = await obtenerSesion();
    if (!sesion) {
        redirect(RUTA_SESION_FINALIZADA);
    }
    if (!autorizado("productor.publicacion.consultar", sesion)) {
        redirect(obtenerRutaPrincipal(sesion.rol));
    }
    return sesion;
}

export function exigirAdministrador() {
    return exigirRol("ADMINISTRADOR");
}

export function requerirAdministrador() {
    return requerirRol("ADMINISTRADOR");
}

export function exigirOperador() {
    return exigirRol("OPERADOR");
}

export function exigirProductor() {
    return exigirRol("PRODUCTOR");
}

export function requerirOperador() {
    return requerirRol("OPERADOR");
}

export function requerirProductor() {
    return requerirRol("PRODUCTOR");
}
