import { test, expect, type Locator } from "@playwright/test";

test("BP-07: alta, consulta, modificación y baja", async ({ page }) => {
  test.slow();

  const rutaMercado = "/mi-mercado";

  async function seleccionar(
    formulario: Locator,
    campo: string,
    opcion: string,
  ) {
    await formulario.getByRole("combobox", { name: campo }).click();
    await page.getByRole("option", { name: opcion, exact: true }).click({
      timeout: 5_000,
    });
  }

  function tarjeta(precio: string) {
    return page
      .getByRole("button", { name: `$${precio}`, exact: true })
      .locator(
        'xpath=ancestor::div[.//button[@aria-label="Aumentar precio"] and .//button[@aria-label="Disminuir precio"] and .//button[contains(@aria-label, "Ver detalle de")]][1]',
      );
  }

  async function crear(calibre: string, precio: string) {
    await page.getByRole("button", { name: "Nueva publicación" }).click();

    const alta = page.getByRole("dialog", {
      name: "Nueva publicación",
    });

    await seleccionar(alta, "Especie", "Uchuva");
    await seleccionar(alta, "Variedad", "-");
    await seleccionar(alta, "Presentación", "Unidad");
    await seleccionar(alta, "País de origen", "URUGUAY");
    await seleccionar(alta, "Categoría", "-");
    await seleccionar(alta, "Calibre", calibre);

    await alta
      .getByRole("textbox", { name: "Precio en pesos" })
      .fill(precio);

    await alta.getByRole("button", { name: "Confirmar" }).click();
    await expect(tarjeta(precio)).toBeVisible();
  }

  async function abrir(precio: string) {
    await tarjeta(precio)
      .getByRole("button", { name: "Ver detalle de Uchuva" })
      .first()
      .click();

    const consulta = page.getByRole("dialog", {
      name: "Consultar publicación",
    });

    await expect(consulta).toBeVisible();
    return consulta;
  }

  async function eliminar(precio: string) {
    const consulta = await abrir(precio);
    await consulta.getByRole("button", { name: "Eliminar" }).click();

    const confirmacion = page.getByRole("alertdialog", {
      name: "Eliminar publicación",
    });

    await expect(confirmacion).toBeVisible();
    await confirmacion
      .getByRole("button", { name: "Sí, eliminar" })
      .click();

    await expect(tarjeta(precio)).toHaveCount(0);
  }

  await page.goto(rutaMercado);
  await expect(
    page.getByRole("heading", { name: "Mi Mercado" }),
  ).toBeVisible();

  await expect(tarjeta("1371")).toHaveCount(0);
  await expect(tarjeta("1482")).toHaveCount(0);
  await expect(tarjeta("2637")).toHaveCount(0);

  try {
    // ALTA: el calibre distingue las dos publicaciones.
    await crear("CHICO", "1371");
    await crear("GRANDE", "2637");

    // CONSULTA de la primera.
    let consulta = await abrir("1371");

    await expect(
      consulta.getByRole("combobox", { name: "Especie" }),
    ).toContainText("Uchuva");

    await expect(
      consulta.getByRole("combobox", { name: "Categoría" }),
    ).toContainText("-");

    await expect(
      consulta.getByRole("combobox", { name: "Calibre" }),
    ).toContainText("CHICO");

    await expect(
      consulta.getByRole("textbox", { name: "Precio en pesos" }),
    ).toHaveValue("1371");

    // MODIFICACIÓN: cambiamos el precio de la primera.
    await consulta.getByRole("button", { name: "Editar" }).click();

    const edicion = page.getByRole("dialog", {
      name: "Editar publicación",
    });

    await edicion
      .getByRole("textbox", { name: "Precio en pesos" })
      .fill("1482");

    await edicion.getByRole("button", { name: "Guardar" }).click();

    consulta = page.getByRole("dialog", {
      name: "Consultar publicación",
    });
    await expect(consulta).toBeVisible();

    await expect(
      consulta.getByRole("textbox", { name: "Precio en pesos" }),
    ).toHaveValue("1482");

    // Recargamos para comprobar que el cambio quedó guardado.
    await page.reload();
    consulta = await abrir("1482");

    await expect(
      consulta.getByRole("textbox", { name: "Precio en pesos" }),
    ).toHaveValue("1482");

    await expect(
      consulta.getByRole("combobox", { name: "Calibre" }),
    ).toContainText("CHICO");

    await consulta
      .getByRole("button", { name: "Cerrar consulta" })
      .click();

    // La segunda publicación sigue con su precio original.
    await expect(tarjeta("2637")).toBeVisible();

    // BAJA de ambas publicaciones.
    await eliminar("1482");
    await page.reload();
    await expect(tarjeta("2637")).toBeVisible();

    await eliminar("2637");
    await page.reload();

    await expect(tarjeta("1371")).toHaveCount(0);
    await expect(tarjeta("1482")).toHaveCount(0);
    await expect(tarjeta("2637")).toHaveCount(0);
  } finally {
    await test.step("Limpiar publicaciones de la prueba", async () => {
      await page.goto(rutaMercado);

      if (await tarjeta("1482").count()) {
        await eliminar("1482");
      } else if (await tarjeta("1371").count()) {
        await eliminar("1371");
      }

      if (await tarjeta("2637").count()) {
        await eliminar("2637");
      }
    });
  }
});