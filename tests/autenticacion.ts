import { expect, type Page } from "@playwright/test";

export async function iniciarSesionOperador(page: Page) {
  const usuario = process.env.E2E_OPERADOR_USU;
  const contrasena = process.env.E2E_OPERADOR_PASS;
  if (!usuario || !contrasena) {
    throw new Error("Configure E2E_OPERADOR_USU y E2E_OPERADOR_PASS con las credenciales del operador de la seed.");
  }

  await page.goto("/iniciar-sesion");
  await page.getByLabel("Correo electrónico o nombre de usuario").fill(usuario);
  await page.getByLabel("Contraseña", { exact: true }).fill(contrasena);
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/inicio");
}
