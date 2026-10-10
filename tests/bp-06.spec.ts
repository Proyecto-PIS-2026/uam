
import { test, expect } from "@playwright/test";

test("BP-06: modificación rápida del precio", async ({ page }) => {
    const rutaMercado = "/mi-mercado";
    await page.goto(rutaMercado);
    await expect(page.getByRole("heading", { name: "Mi Mercado" })).toBeVisible();
    const botonPrecio = page
        .getByRole("button", { name: /^\$\d+$/ })
        .first();
    await expect(botonPrecio).toBeVisible();
    const tarjeta = botonPrecio.locator("xpath=ancestor::div[.//button[@aria-label='Aumentar precio'] and .//button[starts-with(@aria-label,'Ver detalle de')]][1]");
    const aumentar = tarjeta.getByRole("button", {name: "Aumentar precio"});
    const disminuir = tarjeta.getByRole("button", {name: "Disminuir precio"});
    // CA-1 y CA-2
    await expect(aumentar).toBeVisible();
    await expect(disminuir).toBeVisible();
    await expect(tarjeta.getByTitle("Editar precio")).toBeVisible();
    const textoInicial = await botonPrecio.textContent();
    if (!textoInicial) {
        throw new Error("No se pudo obtener el precio inicial.");
    }
    const precioInicial = Number(textoInicial.replace("$", ""));
    let aumentoRealizado = false;
    try {
        // CA-3: aumentar sin cambiar de pantalla.
        await aumentar.click();
        aumentoRealizado = true;

        // Verificamos que el precio aumentó.
        await expect(async () => {
            const textoActual = await tarjeta.getByTitle("Editar precio").textContent();
            const precioActual = Number(textoActual?.replace("$", ""));
            expect(precioActual).toBeGreaterThan(precioInicial);
        }).toPass();

        await expect(page).toHaveURL((url) => url.pathname.startsWith("/mi-mercado"));
    } finally {
        // Restauramos el precio original.
        if (aumentoRealizado && !page.isClosed()) {
            const textoActual = await tarjeta.getByTitle("Editar precio").textContent();
            const precioActual = Number(textoActual?.replace("$", ""));
            if (precioActual > precioInicial) {
                await disminuir.click();
            }
            await expect(
                tarjeta.getByRole("button", {name: `$${precioInicial}`, exact: true})
            ).toBeVisible();
        }
    }
});
