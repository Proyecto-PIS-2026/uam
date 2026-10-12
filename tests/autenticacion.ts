import { expect, type Page } from "@playwright/test";

export type Credenciales = { usuario: string; contrasena: string };

async function enviarCredenciales(page: Page, usuario: string, contrasena: string) {
  await page.goto("/iniciar-sesion");
  await page.getByLabel("Correo electrónico o nombre de usuario").fill(usuario);
  await page.getByLabel("Contraseña", { exact: true }).fill(contrasena);
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
}

export async function iniciarSesionAdministrador(page: Page, credenciales: Credenciales) {
  await enviarCredenciales(page, credenciales.usuario, credenciales.contrasena);
  await expect(page).toHaveURL(/\/inicio$/, { timeout: 30_000 });
  await page.getByRole("link", { name: "Administración", exact: true }).click();
  await expect(page).toHaveURL(/\/administracion$/);
  await expect(
    page.getByRole("heading", { name: "Panel Administrativo", exact: true, level: 1 }),
  ).toBeVisible();
}

export async function iniciarSesionProductor(page: Page, credenciales: Credenciales) {
  await enviarCredenciales(page, credenciales.usuario, credenciales.contrasena);
  await expect(page).toHaveURL(/\/inicio$/, { timeout: 30_000 });
  await expect(page.getByRole("link", { name: "Mi mercado", exact: true }))
    .toHaveAttribute("href", "/mi-mercado/productor");
}

export async function iniciarSesionOperadorInhabilitado(page: Page) {
  const usuario = process.env.E2E_INHABILITADO_USU;
  const contrasena = process.env.E2E_INHABILITADO_PASS;
 
  if (!usuario || !contrasena) {
    throw new Error(
      "Configure E2E_INHABILITADO_USU y E2E_INHABILITADO_PASS con las credenciales del operador inhabilitado de la seed.",
    );
  }
 
  await enviarCredenciales(page, usuario, contrasena);
}

export async function iniciarSesionOperador(page: Page) {
  const usuario = process.env.E2E_OPERADOR_USU;
  const contrasena = process.env.E2E_OPERADOR_PASS;

  if (!usuario || !contrasena) {
    throw new Error(
      "Configure E2E_OPERADOR_USU y E2E_OPERADOR_PASS con las credenciales del operador de la seed.",
    );
  }

  await enviarCredenciales(page, usuario, contrasena);

  await expect(
    page.getByRole("heading", { name: "Mi Mercado", exact: true, level: 1 }),
  ).toBeVisible({ timeout: 30_000 });

  await expect(page).toHaveURL(
    (url) =>
      url.pathname === "/mi-mercado" ||
      url.pathname.startsWith("/mi-mercado/"),
  );

  
}
