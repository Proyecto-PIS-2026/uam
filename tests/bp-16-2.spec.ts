import { expect, type Page } from "@playwright/test";
import type { Client } from "pg";
import {
    test, roles, rutaCambio, perfil, ingresar, salir, abrirCambio, completar, enviarCredenciales, type Cuenta,
} from "./restablecimiento-contrasena-fixtures";

// Solo se repite por rol lo que depende del rol (perfil de origen, enlace y destino al
// cancelar). Las reglas del formulario y del servidor son comunes y se prueban una vez.

const exito = "Tu contraseña se actualizó correctamente.";
const formulario = (page: Page) => page.getByRole("form", { name: "Cambio de contraseña" });
const guardar = (page: Page) => page.getByRole("button", { name: "Guardar cambios", exact: true }).click();

async function hash(db: Client, cuenta: Cuenta) {
    const { rows: [fila] } = await db.query<{ passwordHash: string }>('SELECT "passwordHash" FROM usuario WHERE id = $1', [cuenta.id]);
    return fila.passwordHash;
}

async function deshabilitarDesdeBase(db: Client) {
    // El fixture `db` conserva el bloqueo de la configuración y restaura su valor al terminar.
    await db.query('UPDATE configuracion SET "valorConfiguracion" = $1 WHERE "nombreConfiguracion" = $2',
        ["false", "restablecimiento_contrasena_habilitado"]);
}

/** Acción "Editar" del perfil: confirma que el perfil cargó antes de afirmar ausencias. */
function editarPerfil(page: Page, cuenta: Cuenta) {
    if (cuenta.rol === "OPERADOR") return page.getByRole("button", { name: "Editar", exact: true });
    return page.getByRole("link", { name: cuenta.rol === "ADMINISTRADOR" ? "Editar mi perfil" : "Editar", exact: true });
}

async function rechazarIngreso(page: Page, cuenta: Cuenta, contrasena: string) {
    await enviarCredenciales(page, cuenta, contrasena);
    await expect(page.getByRole("alert").filter({ hasText: "Las credenciales ingresadas no son correctas." })).toBeVisible();
    await expect(page).toHaveURL(/\/iniciar-sesion$/);
}

test.describe("BP-16.2: Cambio de contraseña con contraseña actual", () => {
    for (const [indice, rol] of roles.entries()) {
        test(`CP-0${1 + indice} [CA-2, CA-5, CA-6, CA-7] cancelar y luego guardar una contraseña de 8 caracteres (${rol})`, async ({ page, crearCuenta, db }) => {
            const cuenta = await crearCuenta(rol);
            const nueva = "Prueba12";
            const original = await hash(db, cuenta);
            await ingresar(page, cuenta);

            await test.step("CA-2: el formulario pide la actual, la nueva y su confirmación ocultas", async () => {
                await abrirCambio(page, cuenta);
                for (const etiqueta of ["Contraseña actual", "Nueva contraseña", "Confirmar nueva contraseña"]) {
                    await expect(formulario(page).getByLabel(etiqueta, { exact: true })).toHaveAttribute("type", "password");
                }
            });

            await test.step("CA-7: cancelar vuelve al perfil y conserva la contraseña", async () => {
                await completar(page, cuenta.contrasena, nueva);
                await page.getByRole("button", { name: "Cancelar", exact: true }).click();
                await expect(page).toHaveURL(url => url.pathname === perfil(cuenta));
                expect(await hash(db, cuenta)).toBe(original);
            });

            await test.step("CA-5, CA-7: guardar muestra el mensaje de éxito", async () => {
                await abrirCambio(page, cuenta);
                await completar(page, cuenta.contrasena, nueva);
                await guardar(page);
                await expect(formulario(page).getByRole("status")).toHaveText(exito);
                expect(await hash(db, cuenta)).not.toBe(original);
            });

            await test.step("CA-6: la contraseña anterior deja de servir y la nueva permite ingresar", async () => {
                await salir(page);
                await rechazarIngreso(page, cuenta, cuenta.contrasena);
                await ingresar(page, cuenta, nueva);
            });
        });
    }

    for (const [indice, rol] of roles.entries()) {
        test(`CP-0${4 + indice} [CA-8] sin habilitación no se ofrece el cambio (${rol})`, async ({ page, crearCuenta, db }) => {
            const cuenta = await crearCuenta(rol);
            await ingresar(page, cuenta);
            await deshabilitarDesdeBase(db);
            await page.goto(perfil(cuenta));
            await expect(editarPerfil(page, cuenta)).toBeVisible();
            await expect(page.getByRole("link", { name: "Cambiar contraseña", exact: true })).toHaveCount(0);
            await page.goto(rutaCambio);
            await expect(page.getByRole("main").getByRole("status")).toHaveText("El cambio de contraseña no está habilitado por el administrador.");
            await expect(formulario(page)).toHaveCount(0);
        });
    }

    test("CP-07 [CA-8] el administrador deshabilita el cambio desde el panel", async ({ page, crearCuenta, db }) => {
        const administrador = await crearCuenta("ADMINISTRADOR");
        await ingresar(page, administrador);
        await page.getByRole("button", { name: "General", exact: true }).click();
        await page.getByRole("switch", { name: "Permitir que los usuarios restablezcan su propia contraseña" }).uncheck();
        await page.getByRole("button", { name: "Guardar configuración: Restablecimiento de contraseñas", exact: true }).click();
        await expect(page.getByText("La configuración de restablecimiento de contraseña se guardó correctamente.", { exact: true })).toBeVisible();
        await expect.poll(async () => (await db.query('SELECT "valorConfiguracion" FROM configuracion WHERE "nombreConfiguracion" = $1',
            ["restablecimiento_contrasena_habilitado"])).rows[0].valorConfiguracion).toBe("false");
        await page.goto(perfil(administrador));
        await expect(editarPerfil(page, administrador)).toBeVisible();
        await expect(page.getByRole("link", { name: "Cambiar contraseña", exact: true })).toHaveCount(0);
    });

    test("CP-08 [CA-8] el servidor rechaza el envío si se deshabilita con el formulario abierto", async ({ page, crearCuenta, db }) => {
        const cuenta = await crearCuenta("OPERADOR");
        const original = await hash(db, cuenta);
        await ingresar(page, cuenta);
        await abrirCambio(page, cuenta);
        await completar(page, cuenta.contrasena, "Prueba123");
        await deshabilitarDesdeBase(db);
        await guardar(page);
        await expect(formulario(page).getByRole("alert")).toHaveText("El cambio de contraseña no está habilitado por el administrador.");
        expect(await hash(db, cuenta)).toBe(original);
    });

    test("CP-09 [CA-1] la ruta exige una sesión iniciada", async ({ page }) => {
        await page.goto(rutaCambio);
        await expect(page).toHaveURL(/\/(?:sesion-finalizada|iniciar-sesion)(?:\?.*)?$/);
        await expect(formulario(page)).toHaveCount(0);
    });

    test("CP-10 [CA-1] no se puede cambiar la contraseña de otra cuenta", async ({ page, crearCuenta, db }) => {
        const propia = await crearCuenta("OPERADOR");
        const ajena = await crearCuenta("OPERADOR");
        const [originalPropia, originalAjena] = [await hash(db, propia), await hash(db, ajena)];
        await ingresar(page, propia);
        await abrirCambio(page, propia);
        // La acción no recibe un destinatario: se inyectan identificadores de B en la
        // petición real y se envía la contraseña de B manteniendo la sesión de A.
        let enviado: unknown;
        await page.route("**/mi-perfil/cambiar-contrasena", async (route) => {
            const request = route.request();
            if (request.method() !== "POST" || !request.headers()["next-action"]) return route.continue();
            const datos = JSON.parse(request.postData()!);
            enviado = structuredClone(datos[0]);
            Object.assign(datos[0], { usuarioId: ajena.id, id: ajena.id, username: ajena.username });
            await route.continue({ postData: JSON.stringify(datos) });
        });
        await completar(page, ajena.contrasena, "Prueba123");
        await guardar(page);
        await expect(formulario(page).getByRole("alert")).toHaveText("La contraseña actual no es válida.");
        expect(enviado, "La petición interceptada debe ser el cambio de contraseña").toMatchObject({ actual: ajena.contrasena, nueva: "Prueba123" });
        expect(await hash(db, ajena)).toBe(originalAjena);
        expect(await hash(db, propia)).toBe(originalPropia);
    });

    const rechazos = [
        { cp: "CP-11", ca: "CA-3", titulo: "contraseña actual incorrecta", actual: "Incorrecta123", nueva: "Prueba123", confirmacion: "Prueba123", error: "La contraseña actual no es válida." },
        { cp: "CP-12", ca: "CA-4", titulo: "confirmación diferente", nueva: "Prueba123", confirmacion: "Prueba124", error: "La confirmación de la nueva contraseña no coincide." },
        { cp: "CP-13", ca: "regla de largo mínimo", titulo: "nueva contraseña de 7 caracteres", nueva: "Prueb12", confirmacion: "Prueb12", error: "La nueva contraseña debe tener al menos 8 caracteres." },
    ];
    for (const caso of rechazos) {
        test(`${caso.cp} [${caso.ca}] rechazar ${caso.titulo} y conservar la contraseña`, async ({ page, crearCuenta, db }) => {
            const cuenta = await crearCuenta("OPERADOR");
            const original = await hash(db, cuenta);
            await ingresar(page, cuenta);
            await abrirCambio(page, cuenta);
            await completar(page, caso.actual ?? cuenta.contrasena, caso.nueva, caso.confirmacion);
            await guardar(page);
            await expect(formulario(page).getByRole("alert")).toHaveText(caso.error);
            await expect(formulario(page).getByRole("status")).toHaveCount(0);
            expect(await hash(db, cuenta)).toBe(original);
        });
    }
});
