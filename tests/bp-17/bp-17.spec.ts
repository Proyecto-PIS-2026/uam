import { expect, test, type Page } from "@playwright/test";

async function seleccionarProducto(page: Page) {
  await page.goto("/precios-referencia");
  const fila = page.getByRole("table").locator("tbody tr").first();
  await expect(fila).toBeVisible();
  const celdas = await fila.getByRole("cell").allTextContents();
  await fila.click();
  await expect(page).toHaveURL((url) => url.pathname === "/precios-historicos" && url.searchParams.get("species_id") === "1");
  return {
    producto: celdas[0].trim(), variedad: celdas[1].trim(),
    pais: celdas[5].trim(), calibre: celdas[6].trim(), categoria: celdas[7].trim(),
  };
}

async function esperarHistorico(page: Page) {
  await expect(page.getByRole("button", { name: "Consultar", exact: true })).toBeEnabled({ timeout: 60_000 });
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
}

async function cargarHistorico(page: Page) {
  await seleccionarProducto(page);
  await esperarHistorico(page);
  await page.getByRole("button", { name: "Limpiar filtros" }).click();
  const filas = page.getByRole("table").locator("tbody tr");
  await expect(filas).toHaveCount(12);
  await expect(filas.first().getByRole("cell")).toHaveCount(8);
  return filas;
}

test.describe("BP-17.1 histórico de precios", () => {
  test.setTimeout(90_000);

  test("@new selecciona un producto y conserva los atributos de la fila", async ({ page }) => {
    const producto = await seleccionarProducto(page);
    const url = new URL(page.url());
    for (const [nombre, valor] of Object.entries(producto)) expect(url.searchParams.get(nombre)).toBe(valor);
    expect(url.searchParams.has("classification_id")).toBe(false);
    await esperarHistorico(page);
    await expect(page.getByRole("heading", { name: `Histórico de ${producto.producto}`, exact: true })).toBeVisible();
    const filas = page.getByRole("table").locator("tbody tr");
    await expect(filas).toHaveCount(2);
    for (const fila of await filas.all()) {
      const celdas = fila.getByRole("cell");
      await expect(celdas.nth(1)).toHaveText(producto.variedad);
      await expect(celdas.nth(2)).toHaveText(producto.pais);
      await expect(celdas.nth(3)).toHaveText(producto.calibre);
      await expect(celdas.nth(4)).toHaveText(producto.categoria);
    }
    await page.getByRole("link", { name: "Volver a precios de referencia" }).click();
    await expect(page).toHaveURL(/\/precios-referencia$/);
  });

  test("@new muestra el detalle de los registros históricos", async ({ page }) => {
    const filas = await cargarHistorico(page);
    for (const nombre of ["Fecha", "Variedad", "País", "Calibre", "Categoría", "Referencia", "Precio por kg", "Volumen"]) {
      await expect(page.getByRole("columnheader", { name: nombre, exact: true })).toBeVisible();
    }
    const celdas = filas.first().getByRole("cell");
    const [anio, mes, dia] = new URL(page.url()).searchParams.get("to")!.split("-");
    await expect(celdas.nth(0)).toHaveText(`${dia}/${mes}/${anio}`);
    await expect(celdas.nth(1)).toHaveText("-");
    await expect(celdas.nth(2)).toHaveText("URUGUAY");
    await expect(celdas.nth(3)).toHaveText("G");
    await expect(celdas.nth(4)).toHaveText("E");
    await expect(celdas.nth(5)).toHaveText("");
    await expect(celdas.nth(6)).toHaveText("$23,33 - $26,67");
    await expect(celdas.nth(7)).toHaveText("1 200 kg");
  });

  test("@new filtra por variedad, conserva la selección al recargar y limpia", async ({ page }) => {
    const filas = await cargarHistorico(page);
    const selector = page.getByRole("combobox", { name: "Variedad", exact: true });
    await selector.click();
    await page.getByRole("option", { name: "Variedad E2E", exact: true }).click();
    await expect(page).toHaveURL((url) => url.searchParams.get("variedad") === "Variedad E2E");
    await expect(filas).toHaveCount(2);
    for (const fila of await filas.all()) await expect(fila.getByRole("cell").nth(1)).toHaveText("Variedad E2E");
    await page.reload();
    await esperarHistorico(page);
    await expect(selector).toHaveText("Variedad E2E");
    await expect(filas).toHaveCount(2);
    await page.getByRole("button", { name: "Limpiar filtros" }).click();
    await expect(page).toHaveURL((url) => !url.searchParams.has("variedad"));
    await selector.click();
    await expect(page.getByRole("option", { name: "Todas las variedades", exact: true })).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Escape");
    await expect(filas).toHaveCount(12);
  });

  test("@new consulta un día y muestra solamente registros de esa fecha", async ({ page }) => {
    const filas = await cargarHistorico(page);
    const fecha = (await filas.first().getByRole("cell").nth(0).innerText()).trim();
    const [dia, mes, anio] = fecha.split("/");
    const iso = `${anio}-${mes}-${dia}`;
    await page.getByRole("textbox", { name: "Desde", exact: true }).fill(iso);
    await page.getByRole("textbox", { name: "Hasta", exact: true }).fill(iso);
    await page.getByRole("button", { name: "Consultar", exact: true }).click();
    await expect(page).toHaveURL((url) => url.searchParams.get("from") === iso && url.searchParams.get("to") === iso);
    await expect(filas).toHaveCount(6);
    for (const fila of await filas.all()) await expect(fila.getByRole("cell").nth(0)).toHaveText(fecha);
    await page.reload();
    await esperarHistorico(page);
    await expect(page.getByRole("textbox", { name: "Desde", exact: true })).toHaveValue(iso);
    await expect(page.getByRole("textbox", { name: "Hasta", exact: true })).toHaveValue(iso);
    await expect(filas).toHaveCount(6);
    for (const fila of await filas.all()) await expect(fila.getByRole("cell").nth(0)).toHaveText(fecha);
  });

  test("@new impide consultar un período invertido", async ({ page }) => {
    await cargarHistorico(page);
    const anterior = page.url();
    await page.getByRole("textbox", { name: "Desde", exact: true }).fill("2025-02-02");
    await page.getByRole("textbox", { name: "Hasta", exact: true }).fill("2025-02-01");
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("La fecha de inicio debe ser anterior o igual a la fecha de fin.");
    await expect(page.getByRole("button", { name: "Consultar", exact: true })).toBeDisabled();
    expect(page.url()).toBe(anterior);
  });

  test("@new muestra el estado sin registros", async ({ page }) => {
    await cargarHistorico(page);
    await page.getByRole("textbox", { name: "Desde", exact: true }).fill("2019-01-01");
    await page.getByRole("textbox", { name: "Hasta", exact: true }).fill("2019-01-02");
    await page.getByRole("button", { name: "Consultar", exact: true }).click();
    await expect(page.getByRole("main").getByRole("status")).toHaveText("No hay registros históricos para la selección y el período indicados.");
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  });

  for (const id of [undefined, "abc", "0"]) {
    test(`@new rechaza un producto inválido (${id ?? "sin identificador"})`, async ({ page }) => {
      await page.goto(`/precios-historicos${id === undefined ? "" : `?species_id=${id}`}`);
      await expect(page.getByRole("main").getByRole("alert").filter({ visible: true })).toHaveText("Seleccioná un producto válido desde precios de referencia para consultar su histórico.");
    });
  }
});
