import { expect } from "@playwright/test";
import { test } from "./precarga-operadores";

test("BP-06: modificación rápida del precio", async ({ page, precargaOperadores }) => {
    test.slow();

    const { db, operadorA } = precargaOperadores;
    const configuracion = await page.request.get("/api/configuracion/incremento_precio");
    expect(configuracion.ok()).toBe(true);

    const { valor } = await configuracion.json();
    const incremento = Number(valor);
    const precioInicial = 100;

    expect(Number.isSafeInteger(incremento)).toBe(true);
    expect(incremento).toBeGreaterThan(0);
    expect(precioInicial + incremento).toBeLessThanOrEqual(9999999999);

    const especie = await db.orm.public.Especie.select("id").first();
    expect(especie, "La base E2E debe tener especies disponibles").not.toBeNull();
    if (!especie) throw new Error("No hay especies para preparar la publicación.");

    type Precio = Parameters<typeof db.orm.public.Publicacion.create>[0]["precio"];

    const publicacion = await db.transaction(async (tx) => {
        const creada = await tx.orm.public.Publicacion.create({
            especieId: especie.id,
            tipoPublicacion: "OPERADOR",
            precio: String(precioInicial) as Precio,
            publicacionActiva: true,
            publicacionDisponible: true,
        });
        await tx.orm.public.PublicacionOperador.create({ publicacionId: creada.id, operadorId: operadorA.id });
        return creada;
    });

    await page.goto("/iniciar-sesion");
    await page.getByLabel("Correo electrónico o nombre de usuario").fill(operadorA.credenciales.usuario);
    await page.getByLabel("Contraseña", { exact: true }).fill(operadorA.credenciales.contrasena);
    await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
    await expect(page).toHaveURL((url) => decodeURIComponent(url.pathname) === `/mi-mercado/${operadorA.nombre}`, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Mi Mercado", exact: true })).toBeVisible({ timeout: 30_000 });

    const precio = page.getByRole("button").and(page.getByTitle("Editar precio", { exact: true }));
    const aumentar = page.getByRole("button", { name: "Aumentar precio", exact: true });
    const disminuir = page.getByRole("button", { name: "Disminuir precio", exact: true });
    const rutaInicial = new URL(page.url()).pathname;

    await expect(precio).toHaveCount(1);
    await expect(precio).toHaveText(`$${precioInicial}`);
    await expect(precio).toBeEnabled();
    await expect(aumentar).toBeVisible();
    await expect(aumentar).toBeEnabled();
    await expect(disminuir).toBeVisible();
    await expect(disminuir).toBeEnabled();

    async function comprobarPrecioGuardado(esperado: number) {
        await expect.poll(async () => {
            const guardada = await db.orm.public.Publicacion.where({ id: publicacion.id }).select("precio").first();
            return guardada?.precio == null ? null : Number(guardada.precio);
        }, { timeout: 30_000 }).toBe(esperado);
    }

    await test.step("Aumentar el precio sin cambiar de pantalla", async () => {
        await aumentar.click();
        await expect(precio).toHaveText(`$${precioInicial + incremento}`);
        await comprobarPrecioGuardado(precioInicial + incremento);
        await expect(precio).toBeEnabled({ timeout: 30_000 });
        await expect(precio).toHaveText(`$${precioInicial + incremento}`);
        await expect(page).toHaveURL((url) => url.pathname === rutaInicial);
    });

    await test.step("Disminuir el precio y recuperar el valor original", async () => {
        await disminuir.click();
        await expect(precio).toHaveText(`$${precioInicial}`);
        await comprobarPrecioGuardado(precioInicial);
        await expect(precio).toBeEnabled({ timeout: 30_000 });
        await expect(precio).toHaveText(`$${precioInicial}`);
        await expect(page).toHaveURL((url) => url.pathname === rutaInicial);
    });
});