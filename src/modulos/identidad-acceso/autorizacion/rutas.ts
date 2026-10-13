import type { RolUsuario } from "../autenticacion/sesiones";

export function obtenerRutaPrincipal(rol: RolUsuario | null | undefined): string {
    return rol === "OPERADOR" ? "/mi-mercado" : "/inicio";
}