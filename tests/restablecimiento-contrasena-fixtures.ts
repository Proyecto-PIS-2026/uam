import { randomUUID } from "node:crypto";
import argon2 from "argon2";
import type { Client } from "pg";
import { conRestablecimientoHabilitado } from "./restablecimiento-contrasena-db";
import { test as base, expect, type Page } from "@playwright/test";
import { iniciarSesionAdministrador, iniciarSesionProductor } from "./autenticacion";

export type Rol = "OPERADOR" | "PRODUCTOR" | "ADMINISTRADOR";
export type Cuenta = { id: number; usuario: string; username: string; contrasena: string; rol: Rol };
type Datos = { db: Client; crearCuenta: (rol: Rol) => Promise<Cuenta> };

export const test = base.extend<Datos>({
    db: async ({}, usar) => {
        await conRestablecimientoHabilitado(usar);
    },
    crearCuenta: async ({ db }, usar) => {
        const ids: number[] = [];
        const avisos: string[] = [];
        try {
            await usar(async (rol) => {
                const username = `e2e_bp16_${randomUUID()}`;
                const contrasena = `Actual_${randomUUID()}`;
                const { rows: [usuario] } = await db.query<{ id: number }>(
                    'INSERT INTO usuario (username, "passwordHash", rol) VALUES ($1, $2, $3) RETURNING id',
                    [username, await argon2.hash(contrasena), rol],
                );
                ids.push(usuario.id);
                avisos.push(`El usuario ${username} solicitó restablecer su contraseña.`);
                if (rol === "ADMINISTRADOR") {
                    const email = `${username}@example.com`;
                    await db.query('INSERT INTO administrador ("usuarioId", email) VALUES ($1, $2)', [usuario.id, email]);
                    return { id: usuario.id, usuario: email, username, contrasena, rol };
                }
                const tabla = rol === "OPERADOR" ? "operador" : "productor";
                const { rows: [perfil] } = await db.query<{ id: number }>(
                    `INSERT INTO ${tabla} ("usuarioId", "nombreFantasia", "whatsApp") VALUES ($1, $2, $3) RETURNING id`,
                    [usuario.id, username, "+59890000000"],
                );
                if (rol === "OPERADOR") {
                    await db.query('INSERT INTO local ("numeroLocal", "operadorId", "naveId", "finContrato") SELECT $1, $2, id, NULL FROM nave ORDER BY id LIMIT 1',
                        [username, perfil.id]);
                }
                return { id: usuario.id, usuario: username, username, contrasena, rol };
            });
        } finally {
            // La solicitud avisa a todos los administradores, incluidos los de la seed.
            // Se retiran únicamente los avisos de los usernames creados por este caso.
            await db.query('DELETE FROM notificacion WHERE descripcion = ANY($1::text[]) AND url = $2', [avisos, "/administracion#usuarios"]);
            await db.query('DELETE FROM local WHERE "operadorId" IN (SELECT id FROM operador WHERE "usuarioId" = ANY($1::int[]))', [ids]);
            await db.query('DELETE FROM usuario WHERE id = ANY($1::int[])', [ids]);
        }
    },
});


export const rutaCambio = "/mi-perfil/cambiar-contrasena";
export const roles: Rol[] = ["OPERADOR", "PRODUCTOR", "ADMINISTRADOR"];
export const perfil = (cuenta: Cuenta) => cuenta.rol === "PRODUCTOR" ? "/mi-perfil/productor" : "/mi-perfil";
export const cp = (numero: number) => `CP-${String(numero).padStart(2, "0")}`;

export async function enviarCredenciales(page: Page, cuenta: Cuenta, contrasena = cuenta.contrasena) {
    await page.goto("/iniciar-sesion");
    await page.getByLabel("Correo electrónico o nombre de usuario").fill(cuenta.usuario);
    await page.getByLabel("Contraseña", { exact: true }).fill(contrasena);
    await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
}

export async function ingresar(page: Page, cuenta: Cuenta, contrasena = cuenta.contrasena) {
    const credenciales = { usuario: cuenta.usuario, contrasena };
    if (cuenta.rol === "ADMINISTRADOR") await iniciarSesionAdministrador(page, credenciales);
    else if (cuenta.rol === "PRODUCTOR") await iniciarSesionProductor(page, credenciales);
    else {
        await enviarCredenciales(page, cuenta, contrasena);
        await expect(page).toHaveURL(url => url.pathname === `/mi-mercado/${encodeURIComponent(cuenta.username)}`);
        await expect(page.getByRole("heading", { name: "Mi Mercado", exact: true })).toBeVisible();
    }
}

export async function salir(page: Page) {
    await page.getByRole("button", { name: "Abrir menú de usuario", exact: true }).click();
    await page.getByRole("menuitem", { name: "Cerrar sesión", exact: true }).click();
    await expect(page).not.toHaveURL(/\/mi-perfil/);
    await page.goto(rutaCambio);
    await expect(page).toHaveURL(/\/(?:sesion-finalizada|iniciar-sesion)(?:\?.*)?$/);
}

export async function abrirCambio(page: Page, cuenta: Cuenta) {
    await page.goto(perfil(cuenta));
    await page.getByRole("link", { name: "Cambiar contraseña", exact: true }).click();
    await expect(page.getByRole("form", { name: "Cambio de contraseña" })).toBeVisible();
}

export async function completar(page: Page, actual: string, nueva: string, confirmacion = nueva) {
    await page.getByLabel("Contraseña actual", { exact: true }).fill(actual);
    await page.getByLabel("Nueva contraseña", { exact: true }).fill(nueva);
    await page.getByLabel("Confirmar nueva contraseña", { exact: true }).fill(confirmacion);
}
