import { expect } from "@playwright/test";
import { test, roles, cp, perfil, rutaCambio, ingresar, salir, abrirCambio, completar, enviarCredenciales } from "./restablecimiento-contrasena-fixtures";

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
            await expect(page.getByRole("form", { name: "Cambio de contraseña" }).getByRole("alert")).toContainText("La contraseña actual no es válida.");
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
                await expect(page.getByRole("form", { name: "Cambio de contraseña" }).getByRole("alert")).toContainText(caso.error);
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
                await expect(page.getByRole("form", { name: "Cambio de contraseña" }).getByRole("status")).toContainText("Tu contraseña se actualizó correctamente.");
                await salir(page);
                await enviarCredenciales(page, cuenta);
                await expect(page.getByRole("alert").filter({ hasText: "Las credenciales ingresadas no son correctas." })).toBeVisible();
                await expect(page).toHaveURL(/\/iniciar-sesion$/);
                await ingresar(page, cuenta, nueva);
            });
        }
    }
});
