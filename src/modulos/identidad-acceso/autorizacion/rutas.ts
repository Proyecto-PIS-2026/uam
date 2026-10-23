import type { RolUsuario } from "../autenticacion/sesiones";

export function obtenerRutaPrincipal(rol: RolUsuario | null | undefined): string {
    if (rol === "PRODUCTOR") return "/mi-mercado/productor";
    return rol === "OPERADOR" ? "/mi-mercado" : "/inicio";
}
