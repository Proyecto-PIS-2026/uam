"use server";

import { redirect } from "next/navigation";
import { crearSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { autenticarUsuario } from "@/modulos/identidad-acceso/autenticacion/autenticarUsuario";

export type EstadoInicioSesion = {
    error?: string;
};

export async function iniciarSesion(_: EstadoInicioSesion, datos: FormData): Promise<EstadoInicioSesion> {
    const rol = datos.get("rol");
    const identificador = datos.get("identificador");
    const contrasena = datos.get("contrasena");

    if ((rol !== "OPERADOR" && rol !== "ADMINISTRADOR") || typeof identificador !== "string" || typeof contrasena !== "string" || !identificador.trim() || !contrasena) {
        return { error: "Ingresá tus credenciales para continuar." };
    }

    const usuario = await autenticarUsuario({
        rol,
        identificador: identificador.trim(),
        contrasena,
    });

    if (!usuario) {
        return { error: "Las credenciales ingresadas no son correctas." };
    }

    await crearSesion(usuario.usuarioId, usuario.rol);
    redirect("/");
}