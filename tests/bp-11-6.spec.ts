import { conRestablecimientoHabilitado } from "./restablecimiento-contrasena-db";
import { expect } from "@playwright/test";
import { test } from "./usuarios-administrativos";
import { iniciarSesionProductor } from "./autenticacion";

test("BP-11.6 CP-01, CP-02, CP-04, CP-05, CP-06: el perfil muestra los datos de la cuenta y los accesos", async ({ page, usuariosAdministrativos }) => conRestablecimientoHabilitado(async () => {
  test.slow();
  const { productor } = usuariosAdministrativos;
  await iniciarSesionProductor(page, productor);

  await page.goto("/mi-perfil/productor");
  // La tarjeta del perfil se identifica por el nombre del productor (h1).
  const datos = page.getByRole("region", { name: /^Productor de prueba \d+$/ });
  await expect(datos.getByText("Mi perfil", { exact: true })).toBeVisible();

  // CP-01 y CP-02: identificación y contacto.
  await expect(datos.getByRole("heading", { level: 1 })).toHaveText(/^Productor de prueba \d+$/);
  await expect(datos.getByText(`Usuario: ${productor.usuario}`, { exact: true })).toBeVisible();
  await expect(datos.locator("p").filter({ hasText: /^Teléfono:/ })).toContainText("+598 90000000");

  // CP-04: no se expone la contraseña.
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  expect(await page.content()).not.toContain(productor.contrasena);

  // CP-05: acceso a la modificación.
  await expect(datos.getByRole("link", { name: "Editar", exact: true }))
    .toHaveAttribute("href", "/mi-perfil/productor/editar");

  // CP-06: acceso al cambio de contraseña con contraseña actual.
  await page.getByRole("main").getByRole("link", { name: "Cambiar contraseña", exact: true }).click();
  await expect(page).toHaveURL(/\/mi-perfil\/cambiar-contrasena$/);
  const contrasenaActual = page.getByRole("form", { name: "Cambio de contraseña" }).getByLabel("Contraseña", { exact: true });
  await expect(contrasenaActual).toBeVisible();
  await expect(contrasenaActual).toHaveAttribute("autocomplete", "current-password");
}));
