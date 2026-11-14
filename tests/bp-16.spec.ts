import { expect, type Page } from "@playwright/test";
import {
    test, roles, ingresar, abrirCambio, completar, enviarCredenciales, salir, type Cuenta,
} from "./restablecimiento-contrasena-fixtures";
import type { Client } from "pg";

// BP-16 es la historia integradora: el detalle de cada sub-historia vive en
// bp-16-1 (solicitud), bp-16-2 (cambio con contraseña actual) y bp-16-3 (panel).
// Aquí se recorre el circuito completo entre usuario y administrador.

const exito = "La solicitud de recuperación fue realizada correctamente.";
const indicador = "Restablecimiento solicitado";
const aviso = (cuenta: Cuenta) => `El usuario ${cuenta.username} solicitó restablecer su contraseña.`;

async function abrirSolicitud(page: Page, username: string) {
    await page.goto("/iniciar-sesion");
    await page.getByRole("button", { name: "Solicitar recuperación de contraseña", exact: true }).click();
    const dialogo = page.getByRole("dialog", { name: "Solicitar recuperación de contraseña", exact: true });
    // La recuperación pide el username, incluso para administradores que ingresan con correo.
    await dialogo.getByRole("textbox", { name: "Nombre de usuario", exact: true }).fill(username);
    return dialogo;
}

async function solicitar(page: Page, cuenta: Cuenta) {
    const dialogo = await abrirSolicitud(page, cuenta.username);
    await dialogo.getByRole("button", { name: "Aceptar", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: exito })).toBeVisible();
}

async function estado(db: Client, cuenta: Cuenta) {
    const { rows: [fila] } = await db.query<{ passwordHash: string; solicitoRestablecimiento: boolean }>(
        'SELECT "passwordHash", "solicitoRestablecimiento" FROM usuario WHERE id = $1', [cuenta.id],
    );
    return fila;
}

async function avisosRecibidos(db: Client, administrador: Cuenta, solicitante: Cuenta) {
    const { rows: [{ total }] } = await db.query<{ total: number }>(
        'SELECT count(*)::int AS total FROM notificacion WHERE "usuarioId" = $1 AND descripcion = $2 AND url = $3',
        [administrador.id, aviso(solicitante), "/administracion#usuarios"],
    );
    return total;
}

async function abrirUsuarios(page: Page) {
    await page.goto("/administracion");
    await page.getByRole("group", { name: "Secciones de configuración" })
        .getByRole("button", { name: "Usuarios", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Gestión de Usuarios" })).toBeVisible();
}

/** Busca la fila y espera a que aparezca antes de cualquier aserción negativa. */
async function filaUsuario(page: Page, cuenta: Cuenta) {
    await page.getByRole("searchbox", { name: "Buscar usuarios" }).fill(cuenta.username);
    const fila = page.getByRole("button").filter({ hasText: cuenta.username });
    await expect(fila).toBeVisible();
    return fila;
}

test.describe("BP-16: Restablecimiento de contraseña", () => {
    test("CP-01 [CA-1, CA-3] usuarios de los tres roles solicitan y el administrador ve los pedidos y avisos", async ({
        page, crearCuenta, db, browser, baseURL,
    }) => {
        const administrador = await crearCuenta("ADMINISTRADOR");
        // Secuencial: el fixture comparte una única conexión a la base.
        const solicitantes: Cuenta[] = [];
        for (const rol of roles) solicitantes.push(await crearCuenta(rol));
        const sinSolicitud = await crearCuenta("OPERADOR");
        const hashes = new Map<number, string>();

        await test.step("CA-1: cada rol solicita desde el inicio de sesión", async () => {
            for (const solicitante of solicitantes) {
                const antes = await estado(db, solicitante);
                expect(antes.solicitoRestablecimiento).toBe(false);
                hashes.set(solicitante.id, antes.passwordHash);
                await solicitar(page, solicitante);
                const despues = await estado(db, solicitante);
                expect(despues.solicitoRestablecimiento, `${solicitante.rol} queda con el pedido registrado`).toBe(true);
                expect(despues.passwordHash, "Solicitar no modifica la contraseña").toBe(hashes.get(solicitante.id));
                expect(await avisosRecibidos(db, administrador, solicitante), "Cada administrador recibe un aviso").toBe(1);
            }
        });

        const contextoPanel = await browser.newContext({ baseURL });
        try {
            const panel = await contextoPanel.newPage();
            await ingresar(panel, administrador);

            await test.step("CA-3: el listado de usuarios identifica a los solicitantes", async () => {
                await abrirUsuarios(panel);
                for (const solicitante of solicitantes) {
                    await expect(await filaUsuario(panel, solicitante)).toContainText(indicador);
                }
                await expect(await filaUsuario(panel, sinSolicitud)).not.toContainText(indicador);
            });

            await test.step("CA-3: el pedido persiste al volver a abrir el panel", async () => {
                await panel.reload();
                await abrirUsuarios(panel);
                await expect(await filaUsuario(panel, solicitantes[0])).toContainText(indicador);
            });

            await test.step("CA-3: el administrador recibe un aviso por cada pedido", async () => {
                await panel.goto("/notificaciones");
                const avisos = panel.getByRole("list", { name: "Notificaciones recibidas" });
                for (const solicitante of solicitantes) {
                    await expect(avisos.getByRole("link", { name: aviso(solicitante), exact: true })).toBeVisible();
                }
            });
        } finally {
            await contextoPanel.close();
        }
    });

    test("CP-02 [CA-1] repetir la solicitud pendiente no duplica el aviso a los administradores", async ({ page, crearCuenta, db }) => {
        const administrador = await crearCuenta("ADMINISTRADOR");
        const solicitante = await crearCuenta("PRODUCTOR");
        await solicitar(page, solicitante);
        await solicitar(page, solicitante);
        expect((await estado(db, solicitante)).solicitoRestablecimiento).toBe(true);
        expect(await avisosRecibidos(db, administrador, solicitante)).toBe(1);
    });

    test("CP-03 [CA-1] la solicitud se rechaza si el administrador deshabilitó el restablecimiento", async ({ page, crearCuenta, db }) => {
        const administrador = await crearCuenta("ADMINISTRADOR");
        const solicitante = await crearCuenta("OPERADOR");
        // El diálogo se abre con la opción habilitada y se deshabilita antes de enviar:
        // el servidor debe rechazarla aunque la interfaz siga mostrándola.
        const dialogo = await abrirSolicitud(page, solicitante.username);
        // El fixture conserva el bloqueo de la configuración y la restaura al terminar.
        await db.query('UPDATE configuracion SET "valorConfiguracion" = $1 WHERE "nombreConfiguracion" = $2',
            ["false", "restablecimiento_contrasena_habilitado"]);
        await dialogo.getByRole("button", { name: "Aceptar", exact: true }).click();
        await expect(dialogo.getByRole("alert")).toHaveText("La recuperación de contraseña no está habilitada por el administrador.");
        expect((await estado(db, solicitante)).solicitoRestablecimiento).toBe(false);
        expect(await avisosRecibidos(db, administrador, solicitante)).toBe(0);

        await page.reload();
        await expect(page.getByRole("button", { name: "Iniciar sesión", exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "Solicitar recuperación de contraseña", exact: true })).toHaveCount(0);
    });

    test("CP-04 [CA-1, CA-2, CA-3] el pedido se resuelve cuando el usuario cambia su contraseña", async ({
        page, crearCuenta, db, browser, baseURL,
    }) => {
        const administrador = await crearCuenta("ADMINISTRADOR");
        const solicitante = await crearCuenta("OPERADOR");
        const nueva = "Nueva_BP16_2026";
        await solicitar(page, solicitante);
        const antes = await estado(db, solicitante);

        const contextoPanel = await browser.newContext({ baseURL });
        try {
            const panel = await contextoPanel.newPage();
            await ingresar(panel, administrador);
            await abrirUsuarios(panel);
            await expect(await filaUsuario(panel, solicitante)).toContainText(indicador);

            await test.step("CA-2: el usuario cambia la contraseña con la actual", async () => {
                await ingresar(page, solicitante);
                await abrirCambio(page, solicitante);
                await completar(page, solicitante.contrasena, nueva);
                await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
                await expect(page.getByRole("form", { name: "Cambio de contraseña" }).getByRole("status"))
                    .toHaveText("Tu contraseña se actualizó correctamente.");
                const despues = await estado(db, solicitante);
                expect(despues.passwordHash).not.toBe(antes.passwordHash);
                expect(despues.solicitoRestablecimiento, "El cambio resuelve el pedido pendiente").toBe(false);
            });

            await test.step("CA-3: el administrador deja de ver el pedido", async () => {
                await panel.reload();
                await abrirUsuarios(panel);
                await expect(await filaUsuario(panel, solicitante)).not.toContainText(indicador);
            });

            await test.step("CA-2: solo la nueva contraseña permite ingresar", async () => {
                await salir(page);
                await enviarCredenciales(page, solicitante);
                await expect(page.getByRole("alert").filter({ hasText: "Las credenciales ingresadas no son correctas." })).toBeVisible();
                await ingresar(page, solicitante, nueva);
            });
        } finally {
            await contextoPanel.close();
        }
    });
});
