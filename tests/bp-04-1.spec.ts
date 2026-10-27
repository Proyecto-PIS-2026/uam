import { test, expect } from "@playwright/test";
import {
  iniciarSesionOperador,
  iniciarSesionOperadorInhabilitado,
  iniciarSesionProductor,
} from "./autenticacion";

const rutaInicioSesion = "/iniciar-sesion";

test("BP-04.1: inicio de sesión de Operador y Productor", async ({ page }) => {
  const operador = {
    usuario: process.env.E2E_OPERADOR_USU ?? "",
    contrasena: process.env.E2E_OPERADOR_PASS ?? "",
  };
  const productor = {
    usuario: process.env.E2E_PRODUCTOR_USU ?? "",
    contrasena: process.env.E2E_PRODUCTOR_PASS ?? "",
  };

  const mensajeError = page.locator("form").getByRole("alert");
  const menuUsuario = page.getByRole("button", { name: "Abrir menú de usuario" });

  async function comprobarQueNoInicioSesion(mensaje: string) {
    await expect(mensajeError).toHaveText(mensaje);
    await expect(page).toHaveURL(rutaInicioSesion);
    await expect(menuUsuario).toHaveCount(0);
  }

  await test.step("CP-01: iniciar sesión como Operador", async () => {
    await iniciarSesionOperador(page);
    await expect(page.getByRole("link", { name: "Ir a Mi mercado" })).toBeVisible();
    await expect(menuUsuario).toBeVisible();
  });

  await test.step("CP-02: iniciar sesión como Productor", async () => {
    await page.context().clearCookies();
    await iniciarSesionProductor(page, productor);
    await expect(menuUsuario).toBeVisible();
  });

  await test.step("CP-04: contraseña incorrecta", async () => {
    await page.context().clearCookies();
    await page.goto(rutaInicioSesion);
    await page.getByLabel("Correo electrónico o nombre de usuario").fill(operador.usuario);
    await page.getByLabel("Contraseña", { exact: true }).fill("PruebaIncorrecta123");
    await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
    await comprobarQueNoInicioSesion("Las credenciales ingresadas no son correctas.");
  });

  await test.step("CP-05: cuenta inhabilitada", async () => {
    await iniciarSesionOperadorInhabilitado(page);
    await comprobarQueNoInicioSesion(
      "No tenés ningún contrato vigente para iniciar sesión. Comunicate con los administradores de la UAM.",
    );
  });

  await test.step("CP-08: solicitar el restablecimiento de contraseña", async () => {
    for (const cuenta of [operador, productor]) {
      await page.goto(rutaInicioSesion);

      const solicitarRecuperacion = page.getByRole("button", { name: "Solicitar recuperación de contraseña" });
      await expect(solicitarRecuperacion).toBeVisible();
      await solicitarRecuperacion.click();

      const modal = page.getByRole("dialog", { name: "Solicitar recuperación de contraseña" });
      await modal.getByLabel("Nombre de usuario").fill(cuenta.usuario);
      await modal.getByRole("button", { name: "Aceptar" }).click();

      await expect(page.getByRole("status").filter({ hasText: "La solicitud de recuperación fue realizada correctamente." }))
        .toHaveText("La solicitud de recuperación fue realizada correctamente.");
      await modal.getByRole("button", { name: "Cancelar" }).click();
      await expect(modal).toHaveCount(0);
    }
  });
});
