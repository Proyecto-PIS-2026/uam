import { test, expect } from "@playwright/test";
import { iniciarSesionOperador } from "./autenticacion";

test("BP: Cierre de sesion", async ({ page }) => {
  await iniciarSesionOperador(page);
  const cookieAnterior = (await page.context().cookies()).find(
    (cookie) => cookie.name === "uam_sesion",
  );
  expect(cookieAnterior).toBeDefined();
  expect((await page.request.get("/api/sesion")).status()).toBe(204);

  await page.getByRole("button", { name: "Abrir menú de usuario" }).click();
  await page.getByRole("menuitem", { name: "Cerrar sesión" }).click();

  await expect(page).toHaveURL(/inicio/);
  expect((await page.context().cookies()).some((cookie) => cookie.name === "uam_sesion")).toBe(false);

  // Una copia de la cookie anterior tampoco debe permitir recuperar el acceso.
  await page.context().addCookies([cookieAnterior!]);
  expect((await page.request.get("/api/sesion")).status()).toBe(401);
  await page.goto("/mi-perfil");
  await expect(page).toHaveURL(/\/iniciar-sesion(?:\?|$)/);
});
