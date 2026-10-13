import { test, expect } from "@playwright/test";
import { iniciarSesionOperador } from "./autenticacion";

test("BP: Cierre de sesion", async ({ page }) => {
  await iniciarSesionOperador(page);
  await page.getByRole("button", { name: "Abrir menú de usuario" }).click();
  await page.getByRole("menuitem", { name: "Cerrar sesión" }).click();

  await expect(page).toHaveURL(/inicio/);
});