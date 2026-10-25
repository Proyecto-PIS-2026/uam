import { expect, test, type Page } from "@playwright/test";

// Comparte el servicio histórico controlado de BP-17 (puertos 3100/3101).

const grafica = (page: Page) => page.getByRole("region", { name: "Evolución del precio", exact: true });
const filas = (page: Page) => page.getByRole("table").locator("tbody tr");
const consultar = (page: Page) => page.getByRole("button", { name: "Consultar", exact: true });
const fechaVisible = (iso: string) => iso.split("-").reverse().join("/");
const precioVisible = (valor: number) => new Intl.NumberFormat("es-UY", { maximumFractionDigits: 2 }).format(valor);

async function esperarConsulta(page: Page) {
  await expect(consultar(page)).toBeEnabled({ timeout: 60_000 });
  await expect(grafica(page)).toHaveAttribute("aria-busy", "false");
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
}

async function cambiarRango(page: Page, desde: string, hasta: string) {
  await page.getByRole("textbox", { name: "Desde", exact: true }).fill(desde);
  await page.getByRole("textbox", { name: "Hasta", exact: true }).fill(hasta);
  await consultar(page).click();
  await expect(page).toHaveURL((url) => url.searchParams.get("from") === desde && url.searchParams.get("to") === hasta);
  await esperarConsulta(page);
}

async function esperarCurvas(page: Page) {
  const curvas = grafica(page).locator("path.recharts-line-curve");
  await expect(grafica(page).locator(".recharts-wrapper")).toBeVisible();
  await expect(curvas).toHaveCount(2);
  for (const curva of await curvas.all()) {
    await expect(curva).toHaveAttribute("d", /^M.+L/);
    await expect(curva).toHaveAttribute("stroke-width", "2");
  }
}

test.describe("BP-26: gráfica de precios históricos", () => {
  test.setTimeout(90_000);
  test.use({ viewport: { width: 1280, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await page.goto("/precios-referencia");
    const primera = page.getByRole("table").locator("tbody tr").first();
    await expect(primera).toBeVisible();
    await page.waitForLoadState("networkidle");
    const producto = (await primera.getByRole("cell").first().innerText()).trim();
    await primera.click();
    await expect(page).toHaveURL((url) => url.pathname === "/precios-historicos", { timeout: 60_000 });
    await expect(page.getByRole("heading", { name: `Histórico de ${producto}`, exact: true })).toBeVisible();
    await esperarConsulta(page);
    await expect(filas(page)).toHaveCount(2);
  });

  test("CP-26-01: muestra listado y gráfica para el rango inicial con datos", async ({ page }) => {
    const desde = await page.getByRole("textbox", { name: "Desde", exact: true }).inputValue();
    const hasta = await page.getByRole("textbox", { name: "Hasta", exact: true }).inputValue();
    expect(desde).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(hasta).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(desde <= hasta).toBe(true);
    await expect(grafica(page).getByText("Mínimo diario", { exact: true })).toBeVisible();
    await expect(grafica(page).getByText("Máximo diario", { exact: true })).toBeVisible();
    await expect(grafica(page).getByText("Pesos por kilogramo ($/kg)", { exact: true })).toBeVisible();
    await expect(grafica(page)).toContainText("2 días con datos y 2 registros.");
    await esperarCurvas(page);
  });

  test("CP-26-02: cambiar el rango actualiza el listado y la gráfica", async ({ page }) => {
    const fechasAnteriores = await filas(page).locator("td:first-child").allTextContents();
    await cambiarRango(page, "2021-05-01", "2021-05-10");
    await expect(filas(page)).toHaveCount(2);
    await expect(filas(page).locator("td:first-child")).toHaveText(["10/05/2021", "09/05/2021"]);
    expect(await filas(page).locator("td:first-child").allTextContents()).not.toEqual(fechasAnteriores);
    await expect(grafica(page)).toContainText("2 días con datos y 2 registros.");
    await expect(grafica(page).locator("svg text").filter({ hasText: "09/05/2021" })).toHaveCount(2);
    await esperarCurvas(page);
  });

  test("CP-26-03: un rango sin datos informa el estado vacío y no dibuja la gráfica", async ({ page }) => {
    await cambiarRango(page, "2019-01-01", "2019-01-02");
    await expect(filas(page)).toHaveCount(0);
    await expect(page.getByRole("main").getByRole("status")).toHaveText("No hay registros históricos para los filtros y el período seleccionados.");
    await expect(grafica(page).getByText("No hay precios para graficar con los filtros y el período seleccionados.", { exact: true })).toBeVisible();
    await expect(grafica(page).locator(".recharts-wrapper")).toHaveCount(0);
  });

  test("CP-26-04: los precios mínimo y máximo de la gráfica coinciden con el listado", async ({ page }) => {
    await cambiarRango(page, "2021-05-01", "2021-05-10");
    await expect(filas(page)).toHaveCount(2);
    const registros = await Promise.all((await filas(page).all()).map(async (fila) => {
      const celdas = await fila.getByRole("cell").allTextContents();
      const precios = celdas[6].match(/\d+(?:[ .,]\d+)*/g)!;
      expect(precios).toHaveLength(2);
      const numero = (texto: string) => Number(texto.replace(/\s/g, "").replace(",", "."));
      return { fecha: celdas[0].trim(), minimo: numero(precios[0]), maximo: numero(precios[1]) };
    }));
    const minimo = Math.min(...registros.map((registro) => registro.minimo));
    const maximo = Math.max(...registros.map((registro) => registro.maximo));
    const fechaMinima = registros.filter((registro) => registro.minimo === minimo).map((registro) => registro.fecha).sort()[0];
    const fechaMaxima = registros.filter((registro) => registro.maximo === maximo).map((registro) => registro.fecha).sort()[0];
    await expect(grafica(page)).toContainText(`Mínimo del período: $${precioVisible(minimo)}/kg el ${fechaMinima}.`);
    await expect(grafica(page)).toContainText(`Máximo del período: $${precioVisible(maximo)}/kg el ${fechaMaxima}.`);
    await expect(grafica(page).locator("svg text").filter({ hasText: `Mínimo $${precioVisible(minimo)} · ${fechaMinima}` })).toHaveCount(1);
    await expect(grafica(page).locator("svg text").filter({ hasText: `Máximo $${precioVisible(maximo)} · ${fechaMaxima}` })).toHaveCount(1);
    await esperarCurvas(page);
  });

  test("CP-26-05: un único registro se representa con puntos visibles", async ({ page }) => {
    const dia = await page.getByRole("textbox", { name: "Hasta", exact: true }).inputValue();
    await cambiarRango(page, dia, dia);
    await expect(filas(page)).toHaveCount(1);
    await expect(filas(page).first().getByRole("cell").first()).toHaveText(fechaVisible(dia));
    await expect(grafica(page)).toContainText("1 día con datos y 1 registro.");
    const puntos = grafica(page).locator("circle.recharts-line-dot");
    await expect(puntos).toHaveCount(2);
    for (const punto of await puntos.all()) {
      await expect(punto).toBeVisible();
      await expect(punto).toHaveAttribute("r", "4");
      await expect(punto).toHaveAttribute("cx", /^\d+(?:\.\d+)?$/);
      await expect(punto).toHaveAttribute("cy", /^\d+(?:\.\d+)?$/);
    }
  });
});
