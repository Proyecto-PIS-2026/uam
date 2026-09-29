import { test, expect, type Locator } from "@playwright/test";

test("BP-07: alta, consulta, modificación y baja", async ({ page }) => {
  test.setTimeout(120_000);

  const rutaMercado = "/mi-mercado/Mercado%20Verde%20UAM";

  // Abre un combo y elige una opción por su nombre.
  async function seleccionar(
    formulario: Locator,
    campo: string,
    opcion: string,
  ) {
    await formulario.getByRole("combobox", { name: campo }).click();
    await page.getByRole("option", { name: opcion, exact: true }).click();
  }

  // Busca la tarjeta que muestra un precio determinado.
  function tarjeta(precio: string) {
    return page
      .getByRole("button", { name: `$${precio}`, exact: true })
      .locator(
        'xpath=ancestor::div[contains(@class,"rounded-2xl")][1]',
      );
  }

  // Crea una publicación de Uchuva.
  async function crear(categoria: string, precio: string) {
    await page.getByRole("button", { name: "Nueva publicación" }).click();

    const alta = page.getByRole("dialog", {
      name: "Nueva publicación",
    });

    await seleccionar(alta, "Especie", "Uchuva");
    await seleccionar(alta, "Variedad", "-");
    await seleccionar(alta, "Presentación", "Petaca");
    await seleccionar(alta, "País de origen", "AFGANISTÁN");
    await seleccionar(alta, "Categoría", categoria);
    await seleccionar(alta, "Calibre", "EXTRA");

    await alta
      .getByRole("textbox", { name: "Precio en pesos" })
      .fill(precio);

    await alta.getByRole("button", { name: "Confirmar" }).click();
    await expect(tarjeta(precio)).toBeVisible();
  }

  // Abre el detalle de una publicación y devuelve su diálogo.
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

  // Elimina una publicación desde su detalle.
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

  // Evita mezclar esta prueba con Uchuvas de ejecuciones anteriores.
  await expect(page.locator('h3[title="Uchuva"]')).toHaveCount(0);

  try {
    // ALTA: creamos dos publicaciones del mismo producto.
    await crear("I", "1371");
    await crear("E", "2637");

    // CONSULTA: revisamos los datos de la primera.
    let consulta = await abrir("1371");

    await expect(
      consulta.getByRole("combobox", { name: "Especie" }),
    ).toContainText("Uchuva");

    await expect(
      consulta.getByRole("combobox", { name: "Categoría" }),
    ).toContainText("I");

    await expect(
      consulta.getByRole("textbox", { name: "Precio en pesos" }),
    ).toHaveValue("1371");

    // MODIFICACIÓN: cambiamos precio y categoría de la primera.
    await consulta.getByRole("button", { name: "Editar" }).click();

    const edicion = page.getByRole("dialog", {
      name: "Editar publicación",
    });

    await edicion
      .getByRole("textbox", { name: "Precio en pesos" })
      .fill("1482");

    await seleccionar(edicion, "Categoría", "II");
    await edicion.getByRole("button", { name: "Guardar" }).click();

    // Comprobamos lo que muestra la consulta después de guardar.
    consulta = page.getByRole("dialog", {
      name: "Consultar publicación",
    });

    await expect(consulta).toBeVisible();

    await expect(
      consulta.getByRole("textbox", { name: "Precio en pesos" }),
    ).toHaveValue("1482");

    await expect(
      consulta.getByRole("combobox", { name: "Categoría" }),
    ).toContainText("II");

    // Recargamos para verificar que el cambio quedó guardado.
    await page.reload();
    consulta = await abrir("1482");

    await expect(
      consulta.getByRole("textbox", { name: "Precio en pesos" }),
    ).toHaveValue("1482");

    await expect(
      consulta.getByRole("combobox", { name: "Categoría" }),
    ).toContainText("II");

    await consulta
      .getByRole("button", { name: "Cerrar consulta" })
      .click();

    // La segunda publicación no debe haber cambiado.
    await expect(tarjeta("2637")).toContainText("Cat. E");

    // BAJA: eliminamos la primera y verificamos que la segunda siga.
    await eliminar("1482");
    await page.reload();
    await expect(tarjeta("2637")).toBeVisible();

    // Eliminamos la segunda.
    await eliminar("2637");
    await page.reload();
    await expect(page.locator('h3[title="Uchuva"]')).toHaveCount(0);
  } finally {
    await page.goto(rutaMercado);

    // La primera puede tener el precio inicial o el modificado
    if (await tarjeta("1482").count()) {
      await eliminar("1482");
    } else if (await tarjeta("1371").count()) {
      await eliminar("1371");
    }

    // Eliminamos la segunda si todavía existe.
    if (await tarjeta("2637").count()) {
      await eliminar("2637");
    }
  }
});