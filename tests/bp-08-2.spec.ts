import { test, expect } from "@playwright/test";

const rutaListado = "/publicaciones";

// Comprobamos las dos variantes del detalle: lateral y desde abajo.
for (const pantalla of [
  { nombre: "escritorio", viewport: { width: 1280, height: 900 } },
  { nombre: "móvil", viewport: { width: 390, height: 844 } },
]) {
  test(`BP-08.2: consulta pública del producto y su operador (${pantalla.nombre})`, async ({ page }) => {
    test.slow();

    await page.setViewportSize(pantalla.viewport);
    await page.goto(rutaListado);

    // Elegimos una publicación del listado y guardamos sus datos.
    const tarjeta = page.getByRole("button", { name: /^Ver detalles de / }).first();
    await expect(tarjeta).toBeVisible();

    const nombreProducto = (await tarjeta.getByRole("heading").innerText()).trim();
    const nombreOperador = (await tarjeta.locator("p[title]").first().textContent())!.trim();
    const presentacion = (await tarjeta.locator('span[title^="por "]').getAttribute("title"))!.slice(4);
    const textoTarjeta = (await tarjeta.textContent())!;
    const consultarPrecio = textoTarjeta.includes("Consultar precio");
    const precio = consultarPrecio
      ? null
      : Number(
        (await tarjeta.getByText(/^\$\s*[\d.,]+$/).innerText())
          .replace(/[$\s.]/g, "")
          .replace(",", "."),
      );

    expect(nombreProducto).not.toBe("");
    expect(nombreOperador).not.toBe("");

    await tarjeta.click();

    const detalle = page.getByRole("dialog", { name: "Detalle de publicación" });
    await expect(detalle).toBeVisible();
    await expect(page).toHaveURL(rutaListado);

    // Especie y variedad se muestran por separado dentro del detalle.
    for (const parte of nombreProducto.split(" - ")) {
      await expect(detalle.getByText(parte, { exact: true }).first()).toBeVisible();
    }

    await expect(
      detalle.getByText(consultarPrecio ? "Consultar precio" : `$${precio}`, {
        exact: true,
      }),
    ).toBeVisible();

    for (const campo of ["Presentación", "Calibre", "Categoría", "País"]) {
      const etiqueta = detalle.getByText(campo, { exact: true });
      await expect(etiqueta).toBeVisible();

      const valor = etiqueta.locator("xpath=following-sibling::span");
      await expect(valor).toBeVisible();
      await expect(valor).toHaveText(/\S/);

      if (campo === "Presentación") {
        await expect(valor).toHaveText(presentacion);
      } else if (campo === "Calibre" || campo === "Categoría") {
        expect(textoTarjeta).toContain((await valor.innerText()).trim());
      }
    }

    await expect(detalle.getByText("Publicado por", { exact: true })).toBeVisible();
    await expect(detalle.getByText(nombreOperador, { exact: true })).toBeVisible();

    const enlaceWhatsApp = detalle.getByRole("link", {
      name: `Contactar a ${nombreOperador} por WhatsApp`,
    });
    await expect(enlaceWhatsApp).toBeVisible();
    await expect(enlaceWhatsApp).toHaveAttribute("target", "_blank");

    const destino = new URL((await enlaceWhatsApp.getAttribute("href"))!);
    expect(destino.hostname).toBe("wa.me");
    expect(destino.pathname).toMatch(/^\/\d+$/);

    // Cerrar y volver a abrir conserva el listado y la publicación seleccionada.
    await page.keyboard.press("Escape");
    await expect(detalle).not.toBeVisible();
    await expect(tarjeta).toBeVisible();
    await tarjeta.click();
    await expect(detalle).toBeVisible();
    await expect(detalle.getByText(nombreOperador, { exact: true })).toBeVisible();

    const enlacePerfil = detalle.getByRole("link", { name: "Ver Perfil", exact: true });
    await expect(enlacePerfil).toHaveAttribute("href", `/operadores/${encodeURIComponent(nombreOperador)}`);
    await enlacePerfil.click();

    await expect(page).toHaveURL((url) =>
      decodeURIComponent(url.pathname) === `/operadores/${nombreOperador}`,
    );
    await expect(page.getByRole("heading", { name: nombreOperador, level: 1, exact: true })).toBeVisible();
    await expect(detalle).not.toBeVisible();
  });
}
