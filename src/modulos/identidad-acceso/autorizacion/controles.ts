import { redirect } from "next/navigation";
import { obtenerSesion, type RolUsuario } from "../autenticacion/sesiones";
import { obtenerRutaPrincipal } from "./rutas";

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
        redirect("/iniciar-sesion");
    }
    if (sesion.rol !== rol) {
        redirect(obtenerRutaPrincipal(sesion.rol));
    }
    return sesion;
}

export async function redirigirOperadorAMiMercado() {
    const sesion = await obtenerSesion();
    if (sesion?.rol === "OPERADOR") {
        redirect(obtenerRutaPrincipal(sesion.rol));
    }
}

export async function exigirConsultaMercadoPublico() {
    const sesion = await obtenerSesion();
    if (sesion?.rol === "OPERADOR") {
        throw new ErrorAutorizacion(403, "Los operadores sólo pueden consultar su propio mercado.");
    }
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
