import { expect, type Page } from "@playwright/test";
import { Secret, TOTP } from "otpauth";

export type Credenciales = { usuario: string; contrasena: string; secretoSegundoFactor?: string };

const secretosVinculados = new Map<string, { secreto: string; ultimoPaso: number }>();

async function enviarCredenciales(page: Page, usuario: string, contrasena: string) {
  await page.goto("/iniciar-sesion");
  await page.getByLabel("Correo electrónico o nombre de usuario").fill(usuario);
  await page.getByLabel("Contraseña", { exact: true }).fill(contrasena);
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
}

export async function iniciarSesionAdministrador(page: Page, credenciales: Credenciales) {
  await enviarCredenciales(page, credenciales.usuario, credenciales.contrasena);
  await expect(page).toHaveURL(/\/iniciar-sesion\/segundo-factor$/, { timeout: 30_000 });
  const claveManual = page.getByTestId("clave-segundo-factor");
  const anterior = secretosVinculados.get(credenciales.usuario);
  const secreto = await claveManual.count() ? await claveManual.textContent() : credenciales.secretoSegundoFactor ?? anterior?.secreto ?? process.env.E2E_ADMINISTRADOR_TOTP_SECRET;
  if (!secreto) throw new Error("Configurá E2E_ADMINISTRADOR_TOTP_SECRET con la clave de la cuenta administrativa ya vinculada.");
  // Un código aceptado no puede reutilizarse en otro ingreso de la misma cuenta.
  if (anterior && anterior.ultimoPaso >= Math.floor(Date.now() / 30_000)) {
    await page.waitForTimeout((anterior.ultimoPaso + 1) * 30_000 - Date.now() + 100);
  }
  const ultimoPaso = Math.floor(Date.now() / 30_000);
  const codigo = new TOTP({ secret: Secret.fromBase32(secreto), digits: 6, period: 30, algorithm: "SHA1" }).generate();
  await page.getByLabel("Código de verificación").fill(codigo);
  await page.getByRole("button", { name: /^(Confirmar|Verificar) e ingresar$/ }).click();
  await expect(page).toHaveURL(/\/inicio$/, { timeout: 30_000 });
  secretosVinculados.set(credenciales.usuario, { secreto, ultimoPaso });
  await page.getByRole("link", { name: "Administración", exact: true }).click();
  await expect(page).toHaveURL(/\/administracion$/);
  await expect(
    page.getByRole("heading", { name: "Panel Administrativo", exact: true, level: 1 }),
  ).toBeVisible();
}

export async function iniciarSesionProductor(page: Page, credenciales: Credenciales) {
  await enviarCredenciales(page, credenciales.usuario, credenciales.contrasena);
  await expect(page).toHaveURL(/\/mi-mercado\/productor$/, { timeout: 30_000 });
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
