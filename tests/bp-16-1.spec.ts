import { expect, test } from "@playwright/test";

export const USUARIO_OPERADOR_EXISTENTE = process.env.E2E_OPERADOR_USU ?? "operador";

test.describe("BP-16-1: Solicitar restablecimiento de contraseña", () => {
  test("BP-16.1: Solicitar restablecimiento con usuario existente", async ({ page }) => {
    test.slow();

    await page.goto("/iniciar-sesion");

    const botonRecuperar = page.getByRole("button", {name: "Solicitar recuperación de contraseña",});
    await expect(botonRecuperar).toBeVisible();
    await botonRecuperar.click();

    const campoUsuario = page.locator("#usuarioRecuperacion");
    await expect(campoUsuario).toBeVisible();
    await campoUsuario.fill(USUARIO_OPERADOR_EXISTENTE);

    const botonAceptar = page.getByRole("button", { name: "Aceptar" });
    await expect(botonAceptar).toBeVisible();
    await botonAceptar.click();

    const mensajeExito = page.getByText("La solicitud de recuperación fue realizada correctamente.");
    await expect(mensajeExito).toBeVisible();
  });

  test("BP-16.1: Notifica error si el usuario ingresado no existe", async ({ page }) => {
    test.slow();
    await page.goto("/iniciar-sesion");
    // Abrir formulario (usando el locator correcto)
    const botonRecuperar = page.getByRole("button", {name: "Solicitar recuperación de contraseña",});
    await expect(botonRecuperar).toBeVisible();
    await botonRecuperar.click();

    const campoUsuario = page.locator("#usuarioRecuperacion");
    await expect(campoUsuario).toBeVisible();
    await campoUsuario.fill("usuarioquenoexisteeeeee");

    const botonAceptar = page.getByRole("button", { name: "Aceptar" });
    await expect(botonAceptar).toBeVisible();
    await botonAceptar.click();

    // Validar mensaje de error
    const mensajeError = page.getByText("No existe ningún usuario con ese nombre.");
    await expect(mensajeError).toBeVisible();
  });

});