import { test } from "./restablecimiento-contrasena-fixtures";
import { expect } from "@playwright/test";

test.describe("BP-16-1: Solicitar restablecimiento de contraseña", () => {
  test("BP-16.1: Solicitar restablecimiento con usuario existente", async ({ page, crearCuenta }) => {
    const cuenta = await crearCuenta("OPERADOR");
    test.slow();

    await page.goto("/iniciar-sesion");

    const botonRecuperar = page.getByRole("button", {name: "Solicitar recuperación de contraseña",});
    await expect(botonRecuperar).toBeVisible();
    await botonRecuperar.click();

    const dialogo = page.getByRole("dialog", { name: "Solicitar recuperación de contraseña", exact: true });
    const campoUsuario = dialogo.getByRole("textbox", { name: "Nombre de usuario", exact: true });
    await expect(campoUsuario).toBeVisible();
    await campoUsuario.fill(cuenta.username);

    const botonAceptar = dialogo.getByRole("button", { name: "Aceptar", exact: true });
    await expect(botonAceptar).toBeVisible();
    await botonAceptar.click();

    const mensajeExito = page.getByRole("status").filter({ hasText: "La solicitud de recuperación fue realizada correctamente." });
    await expect(mensajeExito).toBeVisible();
  });

  test("BP-16.1: Notifica error si el usuario ingresado no existe", async ({ page, crearCuenta }) => {
    const cuenta = await crearCuenta("OPERADOR");
    test.slow();
    await page.goto("/iniciar-sesion");
    const botonRecuperar = page.getByRole("button", {name: "Solicitar recuperación de contraseña",});
    await expect(botonRecuperar).toBeVisible();
    await botonRecuperar.click();

    const dialogo = page.getByRole("dialog", { name: "Solicitar recuperación de contraseña", exact: true });
    const campoUsuario = dialogo.getByRole("textbox", { name: "Nombre de usuario", exact: true });
    await expect(campoUsuario).toBeVisible();
    await campoUsuario.fill(`inexistente_${cuenta.username}`);

    const botonAceptar = dialogo.getByRole("button", { name: "Aceptar", exact: true });
    await expect(botonAceptar).toBeVisible();
    await botonAceptar.click();

    await expect(dialogo.getByRole("alert")).toHaveText("No existe ningún usuario con ese nombre.");
  });

});
