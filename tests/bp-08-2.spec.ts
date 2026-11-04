import { test, expect } from "@playwright/test";

const rutaListado = "/publicaciones";

for (const pantalla of [
    { nombre: "escritorio", viewport: { width: 1280, height: 900 } },
    { nombre: "móvil", viewport: { width: 390, height: 844 } },
]) {
    test(`BP-08.2: consulta pública del producto y su operador (${pantalla.nombre})`, async ({ page }) => {
        test.slow();

        await page.setViewportSize(pantalla.viewport);
        await page.goto(rutaListado);

        const tarjeta = page.getByRole("button", { name: /^Ver detalles de / }).first();
        await expect(tarjeta).toBeVisible();

        const nombreProducto = (await tarjeta.getByRole("heading").innerText()).trim();
        const nombreOperador = (await tarjeta.locator("p[title]").first().getAttribute("title"))?.trim() ?? "";
        const empaquetado = await tarjeta.evaluate((elemento) =>
            elemento.querySelector('span[title^="por "]')?.getAttribute("title")?.slice(4).trim() || "-"
        );
        const envaseConKilos = empaquetado.match(/^(.*?) \(([^)]+) kg\)$/);
        const soloKilos = empaquetado.match(/^([\d-]+) kg$/);
        const envase = envaseConKilos?.[1] ?? (soloKilos ? "-" : empaquetado);
        const kilos = envaseConKilos?.[2] ?? soloKilos?.[1];
        const textoTarjeta = await tarjeta.textContent() ?? "";
        const consultarPrecio = textoTarjeta.includes("Consultar precio");
        let precio: number | null = null;

        if (!consultarPrecio) {
            const textoPrecio = await tarjeta.getByText(/^\$\s*[\d.,]+$/).innerText();
            precio = Number(textoPrecio.replace(/[$\s.]/g, "").replace(",", "."));
            expect(Number.isFinite(precio)).toBe(true);
        }

        expect(nombreProducto).not.toBe("");
        expect(nombreOperador).not.toBe("");

        await tarjeta.click();

        const detalle = page.getByRole("dialog", { name: "Detalle de publicación", exact: true });
        await expect(detalle).toBeVisible();
        await expect(page).toHaveURL(rutaListado);

        for (const parte of nombreProducto.split(" - ")) {
            await expect(detalle.getByText(parte, { exact: true }).first()).toBeVisible();
        }

        await expect(detalle.getByText(consultarPrecio ? "Consultar precio" : `$${precio}`, { exact: true })).toBeVisible();

        for (const campo of ["Envase", "Kilos", "Calibre", "Categoría", "País"]) {
            const etiqueta = detalle.getByText(campo, { exact: true });
            await expect(etiqueta).toBeVisible();

            const valor = etiqueta.locator("xpath=following-sibling::span");
            await expect(valor).toBeVisible();
            await expect(valor).toHaveText(/\S/);

            if (campo === "Envase") {
                await expect(valor).toHaveText(envase);
            } else if (campo === "Kilos") {
                await expect(valor).toHaveText(kilos ? `${kilos} kg` : "-");
            } else if (campo === "Calibre" || campo === "Categoría") {
                expect(textoTarjeta).toContain((await valor.innerText()).trim());
            }
        }

        await expect(detalle.getByText("Publicado por", { exact: true })).toBeVisible();
        await expect(detalle.getByRole("link", { name: nombreOperador, exact: true })).toBeVisible();

        const enlaceWhatsApp = detalle.getByRole("link", { name: `Contactar a ${nombreOperador} por WhatsApp`, exact: true });
        await expect(enlaceWhatsApp).toBeVisible();
        await expect(enlaceWhatsApp).toHaveAttribute("target", "_blank");
        await expect(enlaceWhatsApp).toHaveAttribute("rel", /noopener/);

        const hrefWhatsApp = await enlaceWhatsApp.getAttribute("href");
        expect(hrefWhatsApp).toBeTruthy();

        const destino = new URL(hrefWhatsApp!);
        expect(destino.hostname).toBe("web.whatsapp.com");
        expect(destino.pathname).toBe("/send");
        expect(destino.searchParams.get("phone")).toMatch(/^\d+$/);

        await page.keyboard.press("Escape");
        await expect(detalle).not.toBeVisible();
        await expect(tarjeta).toBeVisible();

        await tarjeta.click();
        await expect(detalle).toBeVisible();
        await expect(detalle.getByRole("link", { name: nombreOperador, exact: true })).toBeVisible();

        const enlacePerfil = detalle.getByRole("link", { name: "Ver Perfil", exact: true });
        await expect(enlacePerfil).toHaveAttribute("href", `/operadores/${encodeURIComponent(nombreOperador)}?origen=publicaciones`);

        await enlacePerfil.click();
        await expect(page).toHaveURL((url) => decodeURIComponent(url.pathname) === `/operadores/${nombreOperador}`, { timeout: 30_000 });
        await expect(page.getByRole("heading", { name: nombreOperador, level: 1, exact: true })).toBeVisible();
        await expect(detalle).not.toBeVisible();
    });
}