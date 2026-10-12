import { test, expect } from "@playwright/test";
import {
  iniciarSesionAdministrador
} from "./autenticacion";

const rutaInicioSesion = "/iniciar-sesion";

test("BP-04.2: inicio de sesión de Administrador", async ({ page }) => {
  const administrador = {
    usuario: process.env.E2E_ADMINISTRADOR_USU ?? "",
    contrasena: process.env.E2E_ADMINISTRADOR_PASS ?? "",
  };

  const mensajeError = page.locator("form").getByRole("alert");
  const menuUsuario = page.getByRole("button", { name: "Abrir menú de usuario" });

  async function comprobarQueNoInicioSesion(mensaje: string) {
    await expect(mensajeError).toHaveText(mensaje);
    await expect(page).toHaveURL(rutaInicioSesion);
    await expect(menuUsuario).toHaveCount(0);
  }

  await test.step("CP-01: iniciar sesión como Administrador", async () => {
    await iniciarSesionAdministrador(page, administrador);
    await expect(page.getByRole("link", { name: "Administración" })).toBeVisible();
    await expect(menuUsuario).toBeVisible();
  });

  await test.step("CP-04: contraseña incorrecta", async () => {
    await page.context().clearCookies();
    await page.goto(rutaInicioSesion);
    await page.getByLabel("Correo electrónico o nombre de usuario").fill(administrador.usuario);
    await page.getByLabel("Contraseña", { exact: true }).fill("PruebaIncorrecta123");
    await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
    await comprobarQueNoInicioSesion("Las credenciales ingresadas no son correctas.");
  });

});
