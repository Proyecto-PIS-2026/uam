
import { test, expect } from "@playwright/test";
import { iniciarSesionOperador } from "./autenticacion";

test("BP-06: modificación rápida del precio", async ({ page }) => {
  const rutaMercado = "/mi-mercado";

  await iniciarSesionOperador(page);
  await page.goto(rutaMercado);

  await expect(
    page.getByRole("heading", { name: "Mi Mercado" }),
  ).toBeVisible();

  const botonPrecio = page
    .getByRole("button", { name: /^\$\d+$/ })
    .first();

  await expect(botonPrecio).toBeVisible();

  const controlesPrecio = botonPrecio.locator("..");

  const aumentar = controlesPrecio.getByRole("button", {
    name: "Aumentar precio",
  });

  const disminuir = controlesPrecio.getByRole("button", {
    name: "Disminuir precio",
  });

  // CA-1 y CA-2
  await expect(aumentar).toBeVisible();
  await expect(disminuir).toBeVisible();
  await expect(controlesPrecio.getByTitle("Editar precio")).toBeVisible();

  const textoInicial = await botonPrecio.textContent();

  if (!textoInicial) {
    throw new Error("No se pudo obtener el precio inicial.");
  }

  const precioInicial = Number(textoInicial.replace("$", ""));
  let aumentoRealizado = false;

  try {
    // CA-3: aumentar sin cambiar de pantalla.
    await aumentar.click();
    aumentoRealizado = true;

    await expect(
      controlesPrecio.getByRole("button", {
        name: `$${precioInicial + 10}`,
        exact: true,
      }),
    ).toBeVisible();

    await expect(page).toHaveURL((url) =>
      url.pathname.startsWith("/mi-mercado"),
    );
  } finally {
    // Restauramos el precio original.
    if (aumentoRealizado) {
      await disminuir.click();

      await expect(
        controlesPrecio.getByRole("button", {
          name: `$${precioInicial}`,
          exact: true,
        }),
      ).toBeVisible();
      await expect(disminuir).toBeEnabled();
    }
  }
});
