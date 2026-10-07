import { expect, test, type Page } from "@playwright/test";
import relevamiento from "../src/modulos/informacion-uam/precios-referencia/consulta-referencia.json" with { type: "json" };

// Ejecutar contra una aplicación iniciada con PRECIOS_REFERENCIA_FUENTE=local.
// La consulta se realiza en el servidor: page.route no intercepta el webservice.
const registros = relevamiento.types.flatMap((tipo) => tipo.products.flatMap((producto) =>
  producto.varieties.flatMap((variedad) => variedad.presentations.flatMap((presentacion) =>
    presentacion.prices.map((precio) => ({
      especie: producto.species, variedad: variedad.variety, ...presentacion, ...precio,
    })),
  )),
));
const filtros = (page: Page) => page.getByRole("region", { name: "Filtros de precios de referencia" });
const filas = (page: Page) => page.getByRole("table").locator("tbody tr");
const normalizar = (texto: string) => texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const formato = new Intl.NumberFormat("es-UY", { maximumFractionDigits: 2 });
function rango(minimo: number, maximo: number) {
  const inicio = formato.format(minimo);
  const fin = formato.format(maximo);
  return inicio === fin ? `$${inicio}` : `$${inicio} - ${fin}`;
}
async function seleccionar(page: Page, nombre: string, opcion: string) {
  await filtros(page).getByRole("combobox", { name: nombre, exact: true }).click();
  await page.getByRole("option", { name: opcion, exact: true }).click();
}
async function resultados(page: Page, cantidad: number) {
  await expect(filtros(page).getByText(`${cantidad} resultados`, { exact: true })).toBeVisible();
}

test.describe("BP-19.1 — Panel de precios de referencia", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/precios-referencia");
    await expect(page.getByRole("heading", { name: "Precios de referencia", exact: true })).toBeVisible();
  });

  test("muestra la fecha, las columnas y los precios del relevamiento", async ({ page }) => {
    const [anio, mes, dia] = relevamiento.survey_date.split("-");
    await expect(page.getByText(`${dia}/${mes}/${anio}`, { exact: true })).toBeVisible();
    await resultados(page, registros.length);
    for (const columna of ["Especie", "Variedad", "Referencia", "Precio por unidad", "Precio por kg", "País", "Calibre", "Categoría"]) {
      await expect(page.getByRole("columnheader", { name: columna, exact: true })).toBeVisible();
    }
    await expect(filas(page)).toHaveCount(40);
    await filtros(page).getByRole("searchbox").fill("Acelga");
    const esperadas = registros.filter((registro) => registro.especie === "Acelga");
    await resultados(page, esperadas.length);
    // Compara todos los atributos y ambos rangos, sin depender del orden del JSON.
    for (const registro of esperadas) {
      const fila = filas(page).filter({ has: page.getByRole("cell", { name: registro.country, exact: true }) })
        .filter({ has: page.getByRole("cell", { name: registro.caliber, exact: true }) })
        .filter({ has: page.getByRole("cell", { name: registro.category, exact: true }) });
      await expect(fila).toHaveCount(1);
      await expect(fila.locator("td").nth(0)).toHaveText(registro.especie);
      await expect(fila.locator("td").nth(1)).toHaveText(registro.variedad);
      await expect(fila.locator("td").nth(2)).toHaveText(registro.is_reference ? "Referencia" : "-");
      await expect(fila.locator("td").nth(3).locator("strong")).toHaveText(rango(registro.min_un, registro.max_un));
      await expect(fila.locator("td").nth(3).locator("small")).toHaveText(`/${registro.measure_unit}`);
      await expect(fila.locator("td").nth(4).locator("strong")).toHaveText(rango(registro.min_kg, registro.max_kg));
    }
  });

  test("busca sin tildes y permite recuperar el listado desde un resultado vacío", async ({ page }) => {
    const buscador = filtros(page).getByRole("searchbox");
    await buscador.fill("BROCOLI");
    const esperadas = registros.filter((registro) => normalizar(registro.especie).includes("brocoli"));
    expect(esperadas.length).toBeGreaterThan(0);
    await resultados(page, esperadas.length);
    await expect(filas(page)).toHaveCount(esperadas.length);
    for (const fila of await filas(page).all()) await expect(fila.locator("td").first()).toHaveText("Brócoli");
    await buscador.fill("especie-inexistente-bp19");
    await resultados(page, 0);
    await expect(page.getByText("No hay registros que coincidan con los filtros.")).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);
    await filtros(page).getByRole("button", { name: "Limpiar filtros" }).click();
    await expect(buscador).toHaveValue("");
    await resultados(page, registros.length);
  });

  test("filtra únicamente los registros marcados como referencia", async ({ page }) => {
    await filtros(page).getByRole("checkbox").check();
    const cantidad = registros.filter((registro) => registro.is_reference).length;
    await resultados(page, cantidad);
    await expect(filas(page)).toHaveCount(Math.min(40, cantidad));
    for (const fila of await filas(page).all()) await expect(fila.locator("td").nth(2)).toHaveText("Referencia");
    await filtros(page).getByRole("checkbox").uncheck();
    await resultados(page, registros.length);
  });

  test("combina especie, variedad y presentación y reinicia los filtros dependientes", async ({ page }) => {
    const variedad = filtros(page).getByRole("combobox", { name: "Variedad", exact: true });
    const presentacion = filtros(page).getByRole("combobox", { name: "Presentación", exact: true });
    await expect(variedad).toHaveAttribute("aria-disabled", "true");
    // En escritorio los filtros adicionales ya están visibles; el botón es solo móvil.
    await expect(presentacion).toHaveAttribute("aria-disabled", "true");
    const registro = registros.find((fila) => fila.especie === "Manzana" && fila.variedad !== "-")!;
    await seleccionar(page, "Especie", registro.especie);
    await expect(variedad).not.toHaveAttribute("aria-disabled", "true");
    await seleccionar(page, "Variedad", registro.variedad);
    await seleccionar(page, "Presentación", registro.measure_unit);
    const esperadas = registros.filter((fila) => fila.especie === registro.especie && fila.variedad === registro.variedad && fila.measure_unit === registro.measure_unit);
    await resultados(page, esperadas.length);
    for (const fila of await filas(page).all()) {
      await expect(fila.locator("td").first()).toHaveText(registro.especie);
      await expect(fila.locator("td").nth(1)).toHaveText(registro.variedad);
      await expect(fila.locator("td").nth(3).locator("small")).toHaveText(`/${registro.measure_unit}`);
    }
    await seleccionar(page, "Especie", "Todas las especies");
    await expect(variedad).toHaveAttribute("aria-disabled", "true");
    await expect(presentacion).toHaveAttribute("aria-disabled", "true");
    await resultados(page, registros.length);
  });

  test("filtra rangos por unidad y kg, valida límites y permite limpiarlos", async ({ page }) => {
    const minimo = filtros(page).getByRole("textbox", { name: "Precio mínimo", exact: true });
    const maximo = filtros(page).getByRole("textbox", { name: "Precio máximo", exact: true });
    await minimo.fill("20,5");
    await maximo.fill("100");
    await resultados(page, registros.filter((fila) => fila.min_un >= 20.5 && fila.max_un <= 100).length);
    await seleccionar(page, "Precio por", "Kg");
    await resultados(page, registros.filter((fila) => fila.min_kg >= 20.5 && fila.max_kg <= 100).length);
    await maximo.fill("10");
    await expect(filtros(page).getByRole("alert")).toHaveText("El precio máximo no puede ser menor al mínimo.");
    await resultados(page, 0);
    await filtros(page).getByRole("button", { name: "Limpiar filtros" }).click();
    await expect(minimo).toHaveValue("");
    await expect(maximo).toHaveValue("");
    await expect(filtros(page).getByRole("combobox", { name: "Precio por", exact: true })).toHaveText("Unidad");
    await expect(filtros(page).getByRole("alert")).toHaveCount(0);
    await resultados(page, registros.length);
  });

  test("pagina el listado y vuelve a la primera página al filtrar", async ({ page }) => {
    const paginacion = page.getByRole("navigation", { name: "Páginas de precios de referencia" });
    const paginas = Math.ceil(registros.length / 40);
    await expect(paginacion.getByRole("button", { name: "Anterior" })).toBeDisabled();
    for (let numero = 2; numero <= paginas; numero++) {
      await paginacion.getByRole("button", { name: "Siguiente" }).click();
      await expect(paginacion.getByText(`Página ${numero} de ${paginas}`, { exact: true })).toBeVisible();
    }
    await expect(filas(page)).toHaveCount(registros.length - (paginas - 1) * 40);
    await expect(paginacion.getByRole("button", { name: "Siguiente" })).toBeDisabled();
    await paginacion.getByRole("button", { name: "Anterior" }).click();
    await expect(paginacion.getByText(`Página ${paginas - 1} de ${paginas}`, { exact: true })).toBeVisible();
    await filtros(page).getByRole("checkbox").check();
    await expect(paginacion.getByRole("button", { name: "Anterior" })).toBeDisabled();
    await expect(paginacion.getByText(/^Página 1 de /)).toBeVisible();
  });

  test("permite consultar y filtrar precios desde un celular", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const lista = page.getByRole("list", { name: "Precios relevados" });
    await expect(lista).toBeVisible();
    await expect(lista.getByRole("listitem")).toHaveCount(40);
    const boton = filtros(page).getByRole("button", { name: "Más filtros" });
    await expect(boton).toHaveAttribute("aria-expanded", "false");
    await boton.click();
    await expect(boton).toHaveAttribute("aria-expanded", "true");
    await seleccionar(page, "País", "URUGUAY");
    await filtros(page).getByRole("checkbox").check();
    const cantidad = registros.filter((fila) => fila.country === "URUGUAY" && fila.is_reference).length;
    await resultados(page, cantidad);
    await expect(lista.getByRole("listitem")).toHaveCount(Math.min(40, cantidad));
    for (const tarjeta of await lista.getByRole("listitem").all()) {
      await expect(tarjeta.getByText("URUGUAY", { exact: true })).toBeVisible();
      await expect(tarjeta.getByText("Referencia", { exact: true })).toBeVisible();
      await expect(tarjeta.locator("strong").filter({ hasText: /^\$/ })).toHaveCount(2);
    }
    await boton.click();
    await expect(boton).toHaveAttribute("aria-expanded", "false");
    await resultados(page, cantidad);
  });
});
