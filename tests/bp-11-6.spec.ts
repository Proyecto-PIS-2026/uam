import { expect } from "@playwright/test";
import { test } from "./usuarios-administrativos";
import { iniciarSesionProductor } from "./autenticacion";

test("BP-11.6 CP-01, CP-02, CP-04, CP-05, CP-06: el perfil muestra los datos de la cuenta y los accesos", async ({ page, usuariosAdministrativos }) => {
  test.slow();
  const { productor } = usuariosAdministrativos;
  await iniciarSesionProductor(page, productor);

  await page.goto("/mi-perfil/productor");
  await expect(page.getByRole("heading", { level: 1, name: "Mi perfil", exact: true })).toBeVisible();
  const datos = page.getByRole("region", { name: "Datos de mi perfil" });

  // CP-01 y CP-02: identificación y contacto.
  await expect(datos.getByRole("heading", { level: 2 })).toHaveText(/^Productor de prueba \d+$/);
  await expect(datos.locator("p").filter({ hasText: /^Número de contacto:/ })).toContainText("+598 90000000");

  // CP-04: no se expone la contraseña.
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  expect(await page.content()).not.toContain(productor.contrasena);

  // CP-05: acceso a la modificación.
  await expect(datos.getByRole("link", { name: "Modificar mi perfil", exact: true }))
    .toHaveAttribute("href", "/mi-perfil/productor/editar");

  // CP-06: acceso al cambio de contraseña con contraseña actual.
  await datos.getByRole("link", { name: "Cambiar contraseña", exact: true }).click();
  await expect(page).toHaveURL(/\/mi-perfil\/cambiar-contrasena$/);
  await expect(page.getByLabel("Contraseña actual", { exact: false })).toBeVisible();
});
