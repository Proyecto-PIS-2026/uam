import { completarFecha, esperarFecha } from "../soporte/fechas";
import { expect, test, type Page } from "@playwright/test";

async function seleccionarProducto(page: Page) {
  await page.goto("/precios-referencia");
  const fila = page.getByRole("table").locator("tbody tr").first();
  await expect(fila).toBeVisible();
  const celdas = await fila.getByRole("cell").allTextContents();
  await fila.click();
  await expect(page).toHaveURL((url) => url.pathname === "/precios-historicos" && url.searchParams.get("species_id") === "1", { timeout: 60_000 });
  return {
    producto: celdas[0].trim(), variedad: celdas[1].trim(),
    pais: celdas[5].trim(), calibre: celdas[6].trim(), categoria: celdas[7].trim(),
  };
}

async function esperarHistorico(page: Page) {
  await expect(page.getByRole("button", { name: "Consultar", exact: true })).toBeEnabled({ timeout: 60_000 });
  await expect(page.getByRole("region", { name: "Evolución del precio", exact: true })).toHaveAttribute("aria-busy", "false");
  await expect(page.getByRole("region", { name: "Notificaciones", exact: true }).getByRole("alert")).toHaveCount(0);
}

async function elegirFiltro(page: Page, nombre: string, valor: string) {
  const selector = page.getByRole("combobox", { name: nombre, exact: true });
  await expect(selector).toBeEnabled();
  await selector.click();
  await page.getByRole("option", { name: valor, exact: true }).click();
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
    const fechas = (await filas.locator("td:first-child").allInnerTexts())
      .map((texto) => texto.trim().split("/").reverse().join("-"));
    expect(fechas, "Los registros deben ir de la fecha más reciente a la más antigua").toEqual([...fechas].sort().reverse());
  });

  test("@new aplica variedad y limpieza inmediatamente y permite ampliar los resultados después de recargar", async ({ page }) => {
    const filas = await cargarHistorico(page);
    const selector = page.getByRole("combobox", { name: "Variedad", exact: true });
    await elegirFiltro(page, "Variedad", "Variedad E2E");
    await expect(page).toHaveURL((url) => url.searchParams.get("variedad") === "Variedad E2E");
    await expect(filas).toHaveCount(2);
    await expect(page.getByRole("region", { name: "Evolución del precio", exact: true })).toContainText("2 días con datos y 2 registros.");
    for (const fila of await filas.all()) await expect(fila.getByRole("cell").nth(1)).toHaveText("Variedad E2E");
    await page.reload();
    await esperarHistorico(page);
    await expect(selector).toHaveText("Variedad E2E");
    await expect(filas).toHaveCount(2);
    await elegirFiltro(page, "Variedad", "-");
    await expect(page).toHaveURL((url) => url.searchParams.get("variedad") === "-");
    await expect(filas).toHaveCount(10);
    await page.getByRole("button", { name: "Limpiar filtros" }).click();
    await expect(page).toHaveURL((url) => !url.searchParams.has("variedad"));
    await expect(filas).toHaveCount(12);
    await selector.click();
    await expect(page.getByRole("option", { name: "Todas las variedades", exact: true })).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("region", { name: "Evolución del precio", exact: true })).toContainText("2 días con datos y 12 registros.");
  });

  test("@new consulta un día y muestra solamente registros de esa fecha", async ({ page }) => {
    const filas = await cargarHistorico(page);
    const fecha = (await filas.first().getByRole("cell").nth(0).innerText()).trim();
    const [dia, mes, anio] = fecha.split("/");
    const iso = `${anio}-${mes}-${dia}`;
    await completarFecha(page.getByRole("group", { name: /^Desde(?:\s*\*)?$/ }), iso);
    await completarFecha(page.getByRole("group", { name: /^Hasta(?:\s*\*)?$/ }), iso);
    await page.getByRole("button", { name: "Consultar", exact: true }).click();
    await expect(page).toHaveURL((url) => url.searchParams.get("from") === iso && url.searchParams.get("to") === iso);
    await expect(filas).toHaveCount(6);
    for (const fila of await filas.all()) await expect(fila.getByRole("cell").nth(0)).toHaveText(fecha);
    await page.reload();
    await esperarHistorico(page);
    await esperarFecha(page.getByRole("group", { name: /^Desde(?:\s*\*)?$/ }), iso);
    await esperarFecha(page.getByRole("group", { name: /^Hasta(?:\s*\*)?$/ }), iso);
    await expect(filas).toHaveCount(6);
    for (const fila of await filas.all()) await expect(fila.getByRole("cell").nth(0)).toHaveText(fecha);
  });

  test("@new impide consultar un período invertido", async ({ page }) => {
    await cargarHistorico(page);
    const anterior = page.url();
    await completarFecha(page.getByRole("group", { name: /^Desde(?:\s*\*)?$/ }), "2025-02-02");
    await completarFecha(page.getByRole("group", { name: /^Hasta(?:\s*\*)?$/ }), "2025-02-01");
    await expect(page.getByRole("region", { name: "Notificaciones", exact: true }).getByRole("alert")).toHaveText("La fecha de inicio debe ser anterior o igual a la fecha de fin.");
    await expect(page.getByRole("button", { name: "Consultar", exact: true })).toBeDisabled();
    expect(page.url()).toBe(anterior);
  });

  test("@new muestra el estado sin registros y descarta las opciones del período anterior", async ({ page }) => {
    await cargarHistorico(page);
    await elegirFiltro(page, "Variedad", "Variedad E2E");
    await expect(page).toHaveURL((url) => url.searchParams.get("variedad") === "Variedad E2E");
    await completarFecha(page.getByRole("group", { name: /^Desde(?:\s*\*)?$/ }), "2019-01-01");
    await completarFecha(page.getByRole("group", { name: /^Hasta(?:\s*\*)?$/ }), "2019-01-02");
    await page.getByRole("button", { name: "Consultar", exact: true }).click();
    await esperarHistorico(page);
    await expect(page.getByRole("main").getByRole("status")).toHaveText("No hay registros históricos para los filtros y el período seleccionados.");
    await expect(page.getByRole("region", { name: "Notificaciones", exact: true }).getByRole("alert")).toHaveCount(0);
    await expect(page).toHaveURL((url) => url.searchParams.get("from") === "2019-01-01"
      && url.searchParams.get("to") === "2019-01-02"
      && ["variedad", "pais", "calibre", "categoria"].every((clave) => !url.searchParams.has(clave)));
    for (const [nombre, todas] of [
      ["Variedad", "Todas las variedades"], ["País", "Todos los países"],
      ["Calibre", "Todos los calibres"], ["Categoría", "Todas las categorías"],
    ]) {
      const selector = page.getByRole("combobox", { name: nombre, exact: true });
      await selector.click();
      await expect(page.getByRole("listbox").getByRole("option")).toHaveText([todas]);
      await expect(page.getByRole("option", { name: todas, exact: true })).toHaveAttribute("aria-selected", "true");
      await page.keyboard.press("Escape");
    }
  });

  test("@new carga la especie automáticamente y aplica filtros sucesivos sin cerrar Más filtros en mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/precios-historicos");
    await expect(page.getByRole("heading", { name: "Histórico de precios", exact: true, level: 1 })).toBeVisible();
    await expect(page.getByRole("region", { name: "Notificaciones", exact: true }).getByRole("alert")).toHaveCount(0);
    await expect(page.getByRole("main").getByRole("status")).toHaveText("Seleccioná una especie para consultar su histórico de precios.");
    const consultar = page.getByRole("button", { name: "Consultar", exact: true });
    await expect(consultar).toBeDisabled();

    await elegirFiltro(page, "Especie", "Acelga");
    await expect(page).toHaveURL((url) => url.searchParams.get("species_id") === "1");
    await esperarHistorico(page);
    await expect(page.getByRole("heading", { name: "Histórico de Acelga", exact: true })).toBeVisible();
    const grafica = page.getByRole("region", { name: "Evolución del precio", exact: true });
    const tarjetas = page.getByRole("article");
    await expect(tarjetas).toHaveCount(12);
    await expect(grafica.locator(".recharts-wrapper")).toBeVisible();
    await expect(grafica).toContainText("2 días con datos y 12 registros.");
    const masFiltros = page.getByRole("button", { name: "Más filtros", exact: true });
    await masFiltros.click();
    for (const [nombre, valor, cantidad] of [["Variedad", "-", 10], ["País", "URUGUAY", 10], ["Calibre", "M", 4], ["Categoría", "II", 2]] as const) {
      await elegirFiltro(page, nombre, valor);
      await expect(tarjetas).toHaveCount(cantidad);
      await expect(grafica).toContainText(`2 días con datos y ${cantidad} registros.`);
      await expect(masFiltros).toHaveAttribute("aria-expanded", "true");
    }
    await expect(page).toHaveURL((url) => url.searchParams.get("variedad") === "-"
      && url.searchParams.get("pais") === "URUGUAY" && url.searchParams.get("calibre") === "M"
      && url.searchParams.get("categoria") === "II");
    for (const tarjeta of await tarjetas.all()) {
      await expect(tarjeta).toContainText("URUGUAY · Cal. M · Cat. II");
    }
    const urlFiltrada = page.url();
    const periodo = new URL(urlFiltrada).searchParams;
    await elegirFiltro(page, "Especie", "Brócoli");
    await expect(page).toHaveURL((url) => url.searchParams.get("species_id") === "2"
      && ["variedad", "pais", "calibre", "categoria"].every((clave) => !url.searchParams.has(clave))
      && url.searchParams.get("from") === periodo.get("from") && url.searchParams.get("to") === periodo.get("to"));
    await esperarHistorico(page);
    await expect(page.getByRole("heading", { name: "Histórico de Brócoli", exact: true })).toBeVisible();
    await expect(tarjetas).toHaveCount(4);
    await expect(grafica).toContainText("2 días con datos y 4 registros.");
    await page.goBack();
    await expect(page).toHaveURL(urlFiltrada);
    await esperarHistorico(page);
    await expect(page.getByRole("heading", { name: "Histórico de Acelga", exact: true })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Especie", exact: true })).toHaveText("Acelga");
    await expect(tarjetas).toHaveCount(2);
    await expect(grafica).toContainText("2 días con datos y 2 registros.");
    for (const tarjeta of await tarjetas.all()) {
      await expect(tarjeta).toContainText("URUGUAY · Cal. M · Cat. II");
    }
  });

  test("@new vuelve a la primera página al filtrar y limpiar el histórico", async ({ page }) => {
    await page.goto("/precios-historicos?species_id=3&producto=Manzana");
    await esperarHistorico(page);
    const paginacion = page.getByRole("navigation", { name: "Páginas de precios históricos", exact: true });
    const filas = page.getByRole("table").locator("tbody tr");
    await paginacion.getByRole("button", { name: "Página 4", exact: true }).click();
    await expect(paginacion.getByRole("button", { name: "Página 4", exact: true })).toHaveAttribute("aria-current", "page");
    await elegirFiltro(page, "Variedad", "Variedad 01");
    await expect(filas).toHaveCount(2);
    await expect(paginacion).toHaveCount(0);
    await page.getByRole("button", { name: "Limpiar filtros" }).click();
    await expect(filas).toHaveCount(40);
    await expect(paginacion.getByRole("button", { name: "Página 1", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(filas.first().getByRole("cell").nth(1)).toHaveText("Variedad 01");
  });

  for (const id of ["abc", "0"]) {
    test(`@new rechaza un producto inválido (${id})`, async ({ page }) => {
      await page.goto(`/precios-historicos?species_id=${id}`);
      await expect(page.getByRole("region", { name: "Notificaciones", exact: true }).getByRole("alert")).toHaveText("Seleccioná un producto válido desde precios de referencia para consultar su histórico.");
    });
  }
});
