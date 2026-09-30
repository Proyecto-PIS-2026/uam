import { test, expect } from "@playwright/test";

test("BP-06: modificación rápida del precio", async ({ page }) => {
  const rutaMercado = "/mi-mercado/Mercado%20Verde%20UAM";

  await page.goto(rutaMercado);

  await expect(
    page.getByRole("heading", { name: "Mi Mercado" }),
  ).toBeVisible();

  // Buscamos una publicación que tenga precio.
  const botonPrecio = page
    .getByRole("button", { name: /^\$\d+$/ })
    .first();

  await expect(botonPrecio).toBeVisible();

  // Obtenemos la tarjeta de esa publicación.
  const tarjeta = botonPrecio.locator(
    'xpath=ancestor::div[contains(@class,"rounded-2xl")][1]',
  );

  const aumentar = tarjeta.getByRole("button", {
    name: "Aumentar precio",
  });

  const disminuir = tarjeta.getByRole("button", {
    name: "Disminuir precio",
  });

  // CA-1 y CA-2: los controles deben estar visibles.
  await expect(aumentar).toBeVisible();
  await expect(disminuir).toBeVisible();

  await expect(
    tarjeta.getByTitle("Editar precio"),
  ).toBeVisible();

  // Guardamos el precio original.
  const textoInicial = await botonPrecio.textContent();

  if (!textoInicial) {
    throw new Error("No se pudo obtener el precio inicial.");
  }

  const precioInicial = Number(textoInicial.replace("$", ""));

  // CA-3: aumentar precio sin cambiar de pantalla.
  await aumentar.click();

  await expect(
    tarjeta.getByRole("button", {
      name: `$${precioInicial + 10}`,
      exact: true,
    }),
  ).toBeVisible();

  await expect(page).toHaveURL(rutaMercado);

  // Disminuir nuevamente.
  await disminuir.click();

  await expect(
    tarjeta.getByRole("button", {
      name: `$${precioInicial}`,
      exact: true,
    }),
  ).toBeVisible();

  await expect(page).toHaveURL(rutaMercado);
});