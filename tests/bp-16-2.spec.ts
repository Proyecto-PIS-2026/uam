import { randomUUID } from "node:crypto";
import argon2 from "argon2";
import { Client } from "pg";
import { test as base, expect, type Page } from "@playwright/test";
import { iniciarSesionAdministrador, iniciarSesionProductor } from "./autenticacion";

type Rol = "OPERADOR" | "PRODUCTOR" | "ADMINISTRADOR";
type Cuenta = { id: number; usuario: string; contrasena: string; rol: Rol };
type Datos = { db: Client; crearCuenta: (rol: Rol) => Promise<Cuenta> };

const test = base.extend<Datos>({
    db: async ({}, usar) => {
        const connectionString = process.env.DATABASE_URL?.trim();
        if (!connectionString) throw new Error("Configure DATABASE_URL con la base utilizada por el servidor E2E.");
        const db = new Client({ connectionString });
        await db.connect();
        try {
            await db.query("SELECT pg_advisory_lock(1752, 1)");
            const { rows: [original] } = await db.query(
                'SELECT "valorConfiguracion" FROM configuracion WHERE "nombreConfiguracion" = $1',
                ["restablecimiento_contrasena_habilitado"],
            );
            if (!original) throw new Error("Falta la configuración de cambio de contraseña en la seed.");
            try {
                await db.query('UPDATE configuracion SET "valorConfiguracion" = $1 WHERE "nombreConfiguracion" = $2',
                    ["true", "restablecimiento_contrasena_habilitado"]);
                await usar(db);
            } finally {
                await db.query('UPDATE configuracion SET "valorConfiguracion" = $1 WHERE "nombreConfiguracion" = $2',
                    [original.valorConfiguracion, "restablecimiento_contrasena_habilitado"]);
            }
        } finally {
            await db.end();
        }
    },
    crearCuenta: async ({ db }, usar) => {
        const ids: number[] = [];
        try {
            await usar(async (rol) => {
                const username = `e2e_bp162_${randomUUID()}`;
                const contrasena = `Actual_${randomUUID()}`;
                const { rows: [usuario] } = await db.query<{ id: number }>(
                    'INSERT INTO usuario (username, "passwordHash", rol) VALUES ($1, $2, $3) RETURNING id',
                    [username, await argon2.hash(contrasena), rol],
                );
                ids.push(usuario.id);
                if (rol === "ADMINISTRADOR") {
                    const email = `${username}@example.com`;
                    await db.query('INSERT INTO administrador ("usuarioId", email) VALUES ($1, $2)', [usuario.id, email]);
                    return { id: usuario.id, usuario: email, contrasena, rol };
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
                return { id: usuario.id, usuario: username, contrasena, rol };
            });
        } finally {
            await db.query('DELETE FROM local WHERE "operadorId" IN (SELECT id FROM operador WHERE "usuarioId" = ANY($1::int[]))', [ids]);
            await db.query('DELETE FROM usuario WHERE id = ANY($1::int[])', [ids]);
        }
    },
});


const rutaCambio = "/mi-perfil/cambiar-contrasena";
const roles: Rol[] = ["OPERADOR", "PRODUCTOR", "ADMINISTRADOR"];
const perfil = (cuenta: Cuenta) => cuenta.rol === "PRODUCTOR" ? "/mi-perfil/productor" : "/mi-perfil";
const cp = (numero: number) => `CP-${String(numero).padStart(2, "0")}`;

async function enviarCredenciales(page: Page, cuenta: Cuenta, contrasena = cuenta.contrasena) {
    await page.goto("/iniciar-sesion");
    await page.getByLabel("Correo electrónico o nombre de usuario").fill(cuenta.usuario);
    await page.getByLabel("Contraseña", { exact: true }).fill(contrasena);
    await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
}

async function ingresar(page: Page, cuenta: Cuenta, contrasena = cuenta.contrasena) {
    const credenciales = { usuario: cuenta.usuario, contrasena };
    if (cuenta.rol === "ADMINISTRADOR") await iniciarSesionAdministrador(page, credenciales);
    else if (cuenta.rol === "PRODUCTOR") await iniciarSesionProductor(page, credenciales);
    else {
        await enviarCredenciales(page, cuenta, contrasena);
        await expect(page).toHaveURL(`/mi-mercado/${encodeURIComponent(cuenta.usuario)}`);
        await expect(page.getByRole("heading", { name: "Mi Mercado", exact: true })).toBeVisible();
    }
}

async function salir(page: Page) {
    await page.getByRole("button", { name: "Abrir menú de usuario", exact: true }).click();
    await page.getByRole("menuitem", { name: "Cerrar sesión", exact: true }).click();
    await expect(page).not.toHaveURL(/\/mi-perfil/);
    await page.goto(rutaCambio);
    await expect(page).toHaveURL(/\/(?:sesion-finalizada|iniciar-sesion)(?:\?.*)?$/);
}

async function abrirCambio(page: Page, cuenta: Cuenta) {
    await page.goto(perfil(cuenta));
    await page.getByRole("link", { name: "Cambiar contraseña", exact: true }).click();
    await expect(page.getByRole("form", { name: "Cambio de contraseña" })).toBeVisible();
}

async function completar(page: Page, actual: string, nueva: string, confirmacion = nueva) {
    await page.getByLabel("Contraseña actual", { exact: true }).fill(actual);
    await page.getByLabel("Nueva contraseña", { exact: true }).fill(nueva);
    await page.getByLabel("Confirmar nueva contraseña", { exact: true }).fill(confirmacion);
}

test.describe("BP-16.2 — matriz de cambio de contraseña", () => {
    for (const [indice, rol] of roles.entries()) {
        test(`${cp(1 + indice)} [CA-8] opción habilitada (${rol})`, async ({ page, crearCuenta }) => {
            const cuenta = await crearCuenta(rol);
            await ingresar(page, cuenta);
            await abrirCambio(page, cuenta);
        });

        test(`${cp(4 + indice)} [CA-8] opción deshabilitada desde el panel (${rol})`, async ({ page, crearCuenta, browser, baseURL, db }) => {
            const cuenta = await crearCuenta(rol);
            await ingresar(page, cuenta);
            const administrador = rol === "ADMINISTRADOR" ? cuenta : await crearCuenta("ADMINISTRADOR");
            const contextoPanel = await browser.newContext({ baseURL });
            const panel = rol === "ADMINISTRADOR" ? page : await contextoPanel.newPage();
            try {
                if (rol !== "ADMINISTRADOR") await ingresar(panel, administrador);
                await panel.goto("/administracion");
                await panel.getByRole("button", { name: "General", exact: true }).click();
                await panel.getByRole("switch", { name: "Permitir que los usuarios restablezcan su propia contraseña" }).uncheck();
                await panel.getByRole("button", { name: "Guardar configuración: Restablecimiento de contraseñas", exact: true }).click();
                await expect(panel.getByText("La configuración de restablecimiento de contraseña se guardó correctamente.", { exact: true })).toBeVisible();
                await expect.poll(async () => (await db.query('SELECT "valorConfiguracion" FROM configuracion WHERE "nombreConfiguracion" = $1',
                    ["restablecimiento_contrasena_habilitado"])).rows[0].valorConfiguracion).toBe("false");
                await page.goto(perfil(cuenta));
                await expect(page.getByRole("link", { name: "Cambiar contraseña", exact: true })).toHaveCount(0);
                await page.goto(rutaCambio);
                await expect(page.getByRole("form", { name: "Cambio de contraseña" })).toHaveCount(0);
                await expect(page.getByRole("status")).toContainText("no está habilitado");
            } finally {
                await contextoPanel.close();
            }
        });

        test(`${cp(7 + indice)} [CA-1] ruta sin sesión (${rol})`, async ({ page }) => {
            // Los tres roles comparten la misma ruta; cada CP usa un contexto anónimo nuevo.
            await page.goto(rutaCambio);
            await expect(page).toHaveURL(/\/(?:sesion-finalizada|iniciar-sesion)(?:\?.*)?$/);
            await expect(page.getByRole("form", { name: "Cambio de contraseña" })).toHaveCount(0);
        });

        test(`${cp(10 + indice)} [CA-1] intento sobre una cuenta ajena (${rol})`, async ({ page, crearCuenta, db }) => {
            const propia = await crearCuenta(rol);
            const ajena = await crearCuenta(rol);
            const original = (await db.query('SELECT "passwordHash" FROM usuario WHERE id = $1', [ajena.id])).rows[0].passwordHash;
            await ingresar(page, propia);
            await abrirCambio(page, propia);
            // La acción no expone un destinatario. Se inyectan identificadores ajenos
            // en la petición real y se usa la contraseña de B manteniendo la sesión de A.
            let intentoEnviado = false;
            await page.route("**/mi-perfil/cambiar-contrasena", async (route) => {
                const request = route.request();
                if (request.method() !== "POST" || !request.headers()["next-action"]) return route.continue();
                const datos = JSON.parse(request.postData()!);
                expect(datos[0]).toMatchObject({ actual: ajena.contrasena, nueva: "Prueba123" });
                Object.assign(datos[0], { usuarioId: ajena.id, id: ajena.id, username: ajena.usuario });
                intentoEnviado = true;
                await route.continue({ postData: JSON.stringify(datos) });
            });
            await completar(page, ajena.contrasena, "Prueba123");
            await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
            await expect(page.getByRole("region", { name: "Notificaciones", exact: true }).getByRole("alert")).toContainText("La contraseña actual no es válida.");
            expect(intentoEnviado).toBe(true);
            await page.unroute("**/mi-perfil/cambiar-contrasena");
            expect((await db.query('SELECT "passwordHash" FROM usuario WHERE id = $1', [ajena.id])).rows[0].passwordHash).toBe(original);
            await salir(page);
            await ingresar(page, ajena);
        });

        test(`${cp(13 + indice)} [CA-2] tres campos de contraseña (${rol})`, async ({ page, crearCuenta }) => {
            const cuenta = await crearCuenta(rol);
            await ingresar(page, cuenta);
            await abrirCambio(page, cuenta);
            for (const etiqueta of ["Contraseña actual", "Nueva contraseña", "Confirmar nueva contraseña"]) {
                await expect(page.getByLabel(etiqueta, { exact: true })).toBeVisible();
                await expect(page.getByLabel(etiqueta, { exact: true })).toHaveAttribute("type", "password");
            }
        });

        const rechazos = [
            { base: 16, ca: "CA-3", titulo: "contraseña actual incorrecta", actualIncorrecta: true, nueva: "Prueba123", confirmacion: "Prueba123", error: "La contraseña actual no es válida." },
            { base: 19, ca: "CA-4", titulo: "confirmación diferente", actualIncorrecta: false, nueva: "Prueba123", confirmacion: "Prueba124", error: "La confirmación de la nueva contraseña no coincide." },
            { base: 22, ca: "sin CA: regla de la matriz", titulo: "contraseña de siete caracteres", actualIncorrecta: false, nueva: "Prueb12", confirmacion: "Prueb12", error: "La nueva contraseña debe tener al menos 8 caracteres." },
        ];
        for (const caso of rechazos) {
            test(`${cp(caso.base + indice)} [${caso.ca}] ${caso.titulo} (${rol})`, async ({ page, crearCuenta }) => {
                const cuenta = await crearCuenta(rol);
                await ingresar(page, cuenta);
                await abrirCambio(page, cuenta);
                await completar(page, caso.actualIncorrecta ? "Incorrecta123" : cuenta.contrasena, caso.nueva, caso.confirmacion);
                await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
                await expect(page.getByRole("region", { name: "Notificaciones", exact: true }).getByRole("alert")).toContainText(caso.error);
                await salir(page);
                await ingresar(page, cuenta);
            });
        }

        test(`${cp(25 + indice)} [CA-7] cancelar conserva la contraseña (${rol})`, async ({ page, crearCuenta }) => {
            const cuenta = await crearCuenta(rol);
            await ingresar(page, cuenta);
            await abrirCambio(page, cuenta);
            await completar(page, cuenta.contrasena, "Prueba123");
            await page.getByRole("button", { name: "Cancelar", exact: true }).click();
            await expect(page).toHaveURL(new RegExp(`${perfil(cuenta)}$`));
            await salir(page);
            await ingresar(page, cuenta);
        });

        for (const [base, nueva] of [[28, "Prueba12"], [31, "Prueba123"]] as const) {
            test(`${cp(base + indice)} [CA-5, CA-6, CA-7] guardar ${nueva.length} caracteres y volver a ingresar (${rol})`, async ({ page, crearCuenta }) => {
                const cuenta = await crearCuenta(rol);
                await ingresar(page, cuenta);
                await abrirCambio(page, cuenta);
                await completar(page, cuenta.contrasena, nueva);
                await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
                await expect(page.getByRole("region", { name: "Notificaciones" }).getByRole("status")).toContainText("Tu contraseña se actualizó correctamente.");
                await salir(page);
                await enviarCredenciales(page, cuenta);
                await expect(page.getByRole("alert").filter({ hasText: "Las credenciales ingresadas no son correctas." })).toBeVisible();
                await expect(page).toHaveURL(/\/iniciar-sesion$/);
                await ingresar(page, cuenta, nueva);
            });
        }
    }
});
