import type { Page } from "@playwright/test";
import { iniciarSesionAdministrador } from "../autenticacion";
import { test, expect, abrirSeccion, ingresar, seleccionar } from "./fixtures";

test.setTimeout(120_000);

const tarjeta = (page: Page) => page.getByText("Orden de las publicaciones", { exact: true }).locator("..");
const guardar = (page: Page) => tarjeta(page).getByRole("button", { name: "Guardar configuración de ordenamiento", exact: true });
const campos = ["Inicio", "Mercado Virtual", "Mercado Producción"];

test.beforeEach(async ({ ordenamiento }) => { void ordenamiento; });

for (const [caso, ordenes] of [
    ["01", ["Z-A", "A-Z", "Z-A"]],
    ["02", ["A-Z", "Z-A", "Z-A"]],
] as const) {
    test(`CP-18.1-${caso}: guarda órdenes independientes y los aplica en Inicio y ambos mercados`, async ({ page, browser, catalogo, precargaOperadores: datos }) => {
        await iniciarSesionAdministrador(page, datos.administrador);
        await abrirSeccion(page, "General");
        // Cambiar el switch garantiza una modificación incluso si algún orden coincide con el inicial.
        await tarjeta(page).getByRole("switch", { name: "Permitir cambiar el orden" }).uncheck();
        for (const [indice, campo] of campos.entries()) await seleccionar(page, tarjeta(page), `Orden predeterminado de ${campo}`, ordenes[indice]);
        await guardar(page).click();
        await expect(page.getByRole("status").filter({ hasText: "La configuración de ordenamiento se guardó correctamente." })).toBeVisible();
        await expect(tarjeta(page).getByRole("switch", { name: "Permitir cambiar el orden" })).toBeEnabled();
        await page.reload();
        await abrirSeccion(page, "General");
        for (const [indice, campo] of campos.entries()) {
            await expect(tarjeta(page).getByRole("combobox", { name: `Orden predeterminado de ${campo}`, exact: true })).toHaveText(ordenes[indice]);
        }
        await expect(guardar(page)).toBeDisabled();
        const publico = await browser.newPage();
        const operador = await browser.newPage();
        try {
            await ingresar(operador, datos.operadorB.credenciales);
            for (const [indice, pantalla, ruta, busqueda] of [
                [0, publico, "/inicio", "Buscar especies"],
                [1, publico, "/publicaciones", "Buscar publicaciones"],
                [2, operador, "/publicaciones-productor", "Buscar publicaciones"],
            ] as const) {
                await pantalla.goto(ruta);
                await pantalla.getByRole("searchbox", { name: busqueda, exact: true }).fill(catalogo.prefijo);
                const nombres = catalogo.especies.map((e) => e.nombre);
                if (ordenes[indice] === "Z-A") nombres.reverse();
                await expect(pantalla.getByRole("main").getByRole("heading", { level: 3 })).toHaveText(nombres);
                await expect(pantalla.getByRole("button", { name: "Ordenar por", exact: true })).toHaveCount(0);
            }
            await tarjeta(page).getByRole("switch", { name: "Permitir cambiar el orden" }).check();
            await guardar(page).click();
            await expect(tarjeta(page).getByRole("switch", { name: "Permitir cambiar el orden" })).toBeEnabled();
            await expect(guardar(page)).toBeDisabled();
            for (const [pantalla, ruta] of [[publico, "/inicio"], [publico, "/publicaciones"], [operador, "/publicaciones-productor"]] as const) {
                await pantalla.goto(ruta);
                await expect(pantalla.getByRole("button", { name: "Ordenar por", exact: true })).toBeVisible();
            }
        } finally {
            await publico.close();
            await operador.close();
        }
    });
}

test("CP-18.1-03: abandonar cambios mantiene los órdenes y el estado guardados", async ({ page, precargaOperadores: datos }) => {
    await iniciarSesionAdministrador(page, datos.administrador);
    await abrirSeccion(page, "General");
    await expect(guardar(page)).toBeDisabled();
    await seleccionar(page, tarjeta(page), "Orden predeterminado de Inicio", "Z-A");
    await tarjeta(page).getByRole("switch", { name: "Permitir cambiar el orden" }).uncheck();
    await expect(guardar(page)).toBeEnabled();
    await page.reload();
    await abrirSeccion(page, "General");
    for (const campo of campos) await expect(tarjeta(page).getByRole("combobox", { name: `Orden predeterminado de ${campo}`, exact: true })).toHaveText("A-Z");
    await expect(tarjeta(page).getByRole("switch", { name: "Permitir cambiar el orden" })).toBeChecked();
    await expect(guardar(page)).toBeDisabled();
});
