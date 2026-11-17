import { expect, test } from "@playwright/test";

const rutaListado = "/operadores";

test("BP-20.1 muestra el listado público de operadores", async ({ page }) => {
  test.slow();

  await page.goto(rutaListado);

  await expect(page.getByRole("heading", { name: "Operadores" })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Buscar operadores" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Nave" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ordenar por" })).toBeVisible();

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

  const conProductos = tarjetasOperador.filter({ hasText: /\b[1-9]\d*\s*productos?\b/i });
  await expect(conProductos.first(), "El seed debe tener un operador con productos publicados").toBeVisible();
  const operadorSeleccionado = conProductos.first();

  const nombreOperador = (await operadorSeleccionado.locator("p").first().innerText()).trim();
  const rutaPerfil = await operadorSeleccionado.getAttribute("href");
  expect(rutaPerfil).toBeTruthy();

  await operadorSeleccionado.click();
  await expect(page).toHaveURL((url) => decodeURIComponent(url.pathname) === decodeURIComponent(new URL(rutaPerfil!, url.origin).pathname));

  await expect(page.getByRole("heading", { name: nombreOperador, level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: `Contactar a ${nombreOperador} por WhatsApp` })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Publicaciones" })).toBeVisible();

  const tarjetasProducto = page.getByRole("button", { name: /^Ver detalles de / });
  await expect(tarjetasProducto.first()).toBeVisible();
  await tarjetasProducto.first().click();

  const detalle = page.getByRole("dialog", { name: "Detalle de publicación" });
  await expect(detalle).toBeVisible();
  await expect(detalle.getByText("Empaquetado", { exact: true })).toBeVisible();
  await expect(detalle.getByText("Kilos", { exact: true })).toHaveCount(0);
  await expect(detalle.getByText("Calibre")).toBeVisible();
  await expect(detalle.getByText("Categoría")).toBeVisible();
  await expect(detalle.getByText("País")).toBeVisible();
  await expect(detalle.getByRole("link", { name: `Contactar a ${nombreOperador} por WhatsApp`, exact: true })).toBeVisible();
});
