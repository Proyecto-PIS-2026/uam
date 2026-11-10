import { expect, type Page } from "@playwright/test";
import {
    test, roles, cp, ingresar, salir, abrirCambio, completar, enviarCredenciales,
} from "./restablecimiento-contrasena-fixtures";

async function abrirUsuarios(page: Page) {
    await page.goto("/administracion");
    await page.getByRole("group", { name: "Secciones de configuración" })
        .getByRole("button", { name: "Usuarios", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Gestión de Usuarios" })).toBeVisible();
}

function filaUsuario(page: Page, username: string) {
    return page.locator('[role="button"]').filter({ hasText: username });
}

test.describe("BP-16: Restablecimiento de contraseña", () => {
    for (const [indice, rol] of roles.entries()) {
        test(`${cp(1 + indice)} [CA-1, CA-3] solicitar y visualizar el pedido persistido (${rol})`, async ({
            page, crearCuenta, db, browser, baseURL,
        }) => {
            const solicitante = await crearCuenta(rol);
            const sinSolicitud = await crearCuenta(rol);
            const administrador = await crearCuenta("ADMINISTRADOR");
            const { rows: [antes] } = await db.query(
                'SELECT "passwordHash", "solicitoRestablecimiento" FROM usuario WHERE id = $1', [solicitante.id],
            );
            expect(antes.solicitoRestablecimiento).toBe(false);

            await test.step("CA-1: solicitar desde el inicio de sesión y comprobar el registro", async () => {
                await page.goto("/iniciar-sesion");
                await page.getByRole("button", { name: "Solicitar recuperación de contraseña", exact: true }).click();
                const dialogo = page.getByRole("dialog", { name: "Solicitar recuperación de contraseña", exact: true });
                // La recuperación pide el username, incluso para administradores que ingresan con correo.
                await dialogo.getByRole("textbox", { name: "Nombre de usuario", exact: true }).fill(solicitante.username);
                await dialogo.getByRole("button", { name: "Aceptar", exact: true }).click();
                await expect(page.getByRole("status").filter({
                    hasText: "La solicitud de recuperación fue realizada correctamente.",
                })).toBeVisible();
                const { rows: [despues] } = await db.query(
                    'SELECT "passwordHash", "solicitoRestablecimiento" FROM usuario WHERE id = $1', [solicitante.id],
                );
                expect(despues.solicitoRestablecimiento).toBe(true);
                expect(despues.passwordHash, "Solicitar el cambio conserva la contraseña hasta que se cambie").toBe(antes.passwordHash);
            });

            const contextoPanel = await browser.newContext({ baseURL });
            try {
                const panel = await contextoPanel.newPage();
                await ingresar(panel, administrador);
                await test.step("CA-3: identificar al solicitante y distinguir una cuenta sin pedido", async () => {
                    await abrirUsuarios(panel);
                    await panel.getByRole("searchbox", { name: "Buscar usuarios" }).fill(solicitante.username);
                    await expect(filaUsuario(panel, solicitante.username)).toBeVisible();
                    await expect(filaUsuario(panel, solicitante.username)).toContainText("Restablecimiento solicitado");
                    await panel.getByRole("searchbox", { name: "Buscar usuarios" }).fill(sinSolicitud.username);
                    await expect(filaUsuario(panel, sinSolicitud.username)).toBeVisible();
                    await expect(filaUsuario(panel, sinSolicitud.username)).not.toContainText("Restablecimiento solicitado");
                    const { rows: [control] } = await db.query(
                        'SELECT "solicitoRestablecimiento" FROM usuario WHERE id = $1', [sinSolicitud.id],
                    );
                    expect(control.solicitoRestablecimiento).toBe(false);
                });
                await test.step("CA-3: volver a abrir el panel y comprobar la persistencia del pedido", async () => {
                    await panel.reload();
                    await abrirUsuarios(panel);
                    await panel.getByRole("searchbox", { name: "Buscar usuarios" }).fill(solicitante.username);
                    await expect(filaUsuario(panel, solicitante.username)).toBeVisible();
                    await expect(filaUsuario(panel, solicitante.username)).toContainText("Restablecimiento solicitado");
                });
            } finally {
                await contextoPanel.close();
            }
        });

        test(`${cp(4 + indice)} [CA-2] cambiar la contraseña actual y volver a ingresar (${rol})`, async ({ page, crearCuenta }) => {
            const cuenta = await crearCuenta(rol);
            const nueva = "Nueva_BP16_2026";
            await ingresar(page, cuenta);
            await abrirCambio(page, cuenta);
            await completar(page, cuenta.contrasena, nueva);
            await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
            await expect(page.getByRole("form", { name: "Cambio de contraseña" }).getByRole("status"))
                .toContainText("Tu contraseña se actualizó correctamente.");
            await salir(page);
            await enviarCredenciales(page, cuenta);
            await expect(page.getByRole("alert").filter({ hasText: "Las credenciales ingresadas no son correctas." })).toBeVisible();
            await expect(page).toHaveURL(/\/iniciar-sesion$/);
            await ingresar(page, cuenta, nueva);
            await abrirCambio(page, cuenta);
        });

        test(`${cp(7 + indice)} [CA-2, control técnico] rechazar la contraseña actual incorrecta y conservar el acceso (${rol})`, async ({ page, crearCuenta, db }) => {
            const cuenta = await crearCuenta(rol);
            const { rows: [antes] } = await db.query('SELECT "passwordHash" FROM usuario WHERE id = $1', [cuenta.id]);
            await ingresar(page, cuenta);
            await abrirCambio(page, cuenta);
            await completar(page, "Actual_Incorrecta", "Nueva_BP16_2026");
            await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
            await expect(page.getByRole("form", { name: "Cambio de contraseña" }).getByRole("alert"))
                .toContainText("La contraseña actual no es válida.");
            const { rows: [despues] } = await db.query('SELECT "passwordHash" FROM usuario WHERE id = $1', [cuenta.id]);
            expect(despues.passwordHash).toBe(antes.passwordHash);
            await salir(page);
            await ingresar(page, cuenta);
            await abrirCambio(page, cuenta);
        });
    }
});
