import { test, expect, type Page } from "@playwright/test";
import { iniciarSesionOperador } from "./autenticacion";

function tarjetaProducto(page: Page, nombre: string) {
    return page.getByTitle(nombre, { exact: true }).locator('xpath=ancestor::div[./button[starts-with(@aria-label, "Ver detalle de ")] and .//div[@title]][1]');
}

async function buscarProducto(page: Page, incremento: number) {
    const precios = page.getByRole("button").and(page.getByTitle("Editar precio", { exact: true }));
    await expect(precios.first()).toBeVisible();

    for (let indice = 0; indice < await precios.count(); indice++) {
        const precio = precios.nth(indice);
        const texto = (await precio.innerText()).trim();
        if (!/^\$[1-9]\d*$/.test(texto)) continue;

        const tarjeta = precio.locator('xpath=ancestor::div[./button[starts-with(@aria-label, "Ver detalle de ")] and .//div[@title]][1]');
        const nombre = await tarjeta.locator("div[title]").getAttribute("title");
        if (!nombre || await page.getByTitle(nombre, { exact: true }).count() !== 1) continue;

        const valor = Number(texto.slice(1));
        if (!Number.isSafeInteger(valor) || valor + incremento > 9999999999) continue;

        return { nombre, precio: valor };
    }

    throw new Error("Se necesita una publicación con nombre único y precio válido para probar el ajuste rápido.");
}

test("BP-06: modificación rápida del precio", async ({ page }) => {
    test.slow();
    await iniciarSesionOperador(page);
    await expect(page.getByRole("heading", { name: "Mi Mercado", exact: true })).toBeVisible();

    const configuracion = await page.request.get("/api/configuracion/incremento_precio");
    expect(configuracion.ok()).toBe(true);

    const { valor } = await configuracion.json();
    const incremento = Number(valor);
    expect(Number.isSafeInteger(incremento)).toBe(true);
    expect(incremento).toBeGreaterThan(0);

    const producto = await buscarProducto(page, incremento);
    const tarjeta = tarjetaProducto(page, producto.nombre);
    const precio = tarjeta.getByRole("button").and(tarjeta.getByTitle("Editar precio", { exact: true }));
    const aumentar = tarjeta.getByRole("button", { name: "Aumentar precio", exact: true });
    const disminuir = tarjeta.getByRole("button", { name: "Disminuir precio", exact: true });
    const rutaInicial = new URL(page.url()).pathname;
    let cambioIntentado = false;
    let precioRestaurado = false;

    await expect(precio).toBeVisible();
    await expect(precio).toBeEnabled();
    await expect(aumentar).toBeVisible();
    await expect(aumentar).toBeEnabled();
    await expect(disminuir).toBeVisible();
    await expect(disminuir).toBeEnabled();

    try {
        await test.step("Aumentar el precio sin cambiar de pantalla", async () => {
            cambioIntentado = true;
            await aumentar.click();
            await expect(precio).toHaveText(`$${producto.precio + incremento}`);
            await expect(precio).toBeEnabled({ timeout: 30_000 });
            await expect(precio).toHaveText(`$${producto.precio + incremento}`);
            await expect(page).toHaveURL((url) => url.pathname === rutaInicial);
        });

        await test.step("Disminuir el precio y recuperar el valor original", async () => {
            await disminuir.click();
            await expect(precio).toHaveText(`$${producto.precio}`);
            await expect(precio).toBeEnabled({ timeout: 30_000 });
            await expect(precio).toHaveText(`$${producto.precio}`);
            await expect(page).toHaveURL((url) => url.pathname === rutaInicial);
            precioRestaurado = true;
        });
    } finally {
        if (cambioIntentado && !precioRestaurado) {
            await test.step("Restaurar el precio si falla una comprobación", async () => {
                await expect(precio).toBeEnabled({ timeout: 30_000 });

                if ((await precio.innerText()).trim() !== `$${producto.precio}`) {
                    await precio.click();
                    const entrada = tarjeta.getByRole("textbox", { name: "Editar precio", exact: true });
                    await entrada.fill(String(producto.precio));
                    await entrada.press("Enter");
                    await expect(precio).toBeEnabled({ timeout: 30_000 });
                    await expect(precio).toHaveText(`$${producto.precio}`);
                }
            });
        }
    }
});