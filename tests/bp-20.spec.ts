import { expect, test } from "@playwright/test";

const rutaListado = "/operadores";

test("BP-20.1 muestra el listado público de operadores", async ({ page }) => {
  test.slow();

  await page.goto(rutaListado);

  await expect(page.getByRole("heading", { name: "Operadores" })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Buscar operadores" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Nave" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Ordenar por" })).toBeVisible();

  const tarjetasOperador = page.locator('a[href^="/operadores/"]');
  await expect(tarjetasOperador.first()).toBeVisible();
});

test("BP-20.1 permite buscar un operador por nombre", async ({ page }) => {
  test.slow();

  await page.goto(rutaListado);

  const tarjetasOperador = page.locator('a[href^="/operadores/"]');
  await expect(tarjetasOperador.first()).toBeVisible();
  const nombreOperador = (await tarjetasOperador.first().locator("p").first().innerText()).trim();

  await page.getByRole("searchbox", { name: "Buscar operadores" }).fill(nombreOperador);

  await expect(tarjetasOperador.first()).toBeVisible();
  await expect(tarjetasOperador.first()).toContainText(nombreOperador);
});

test("BP-20 y BP-20.2 muestra el perfil público y el detalle de sus productos", async ({ page }) => {
  test.slow();

  await page.goto(rutaListado);

  const tarjetasOperador = page.locator('a[href^="/operadores/"]');
  await expect(tarjetasOperador.first()).toBeVisible();

  // Elegimos un operador con productos si existe; si no, validamos su perfil y el estado vacío del catálogo.
  let operadorSeleccionado = tarjetasOperador.first();
  for (let indice = 0; indice < await tarjetasOperador.count(); indice += 1) {
    const tarjeta = tarjetasOperador.nth(indice);
    const texto = (await tarjeta.innerText()).replace(/\s+/g, " ");
    if (/\b[1-9]\d*\s*productos?\b/i.test(texto)) {
      operadorSeleccionado = tarjeta;
      break;
    }
  }

  const nombreOperador = (await operadorSeleccionado.locator("p").first().innerText()).trim();
  const rutaPerfil = await operadorSeleccionado.getAttribute("href");
  expect(rutaPerfil).toBeTruthy();

  await page.goto(rutaPerfil!);

  await expect(page.getByRole("heading", { name: nombreOperador, level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: `Contactar a ${nombreOperador} por WhatsApp` })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Publicaciones" })).toBeVisible();

  const tarjetasProducto = page.getByRole("button", { name: /^Ver detalles de / });
  if (await tarjetasProducto.count()) {
    await tarjetasProducto.first().click();

    const detalle = page.getByRole("dialog", { name: "Detalle de publicación" });
    await expect(detalle).toBeVisible();
    await expect(detalle.getByText("Presentación")).toBeVisible();
    await expect(detalle.getByText("Calibre")).toBeVisible();
    await expect(detalle.getByText("Categoría")).toBeVisible();
    await expect(detalle.getByText("País")).toBeVisible();
    await expect(detalle.getByRole("link", { name: /Consultar por .* por WhatsApp/ })).toBeVisible();
  } else {
    await expect(page.getByText("No hay publicaciones disponibles.")).toBeVisible();
  }
});
