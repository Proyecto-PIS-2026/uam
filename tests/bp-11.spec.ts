
import { randomUUID } from "node:crypto";
import { expect, type Page, type TestInfo } from "@playwright/test";
import { test } from "./usuarios-administrativos";
import {
  iniciarSesionAdministrador,
  iniciarSesionProductor,
} from "./autenticacion";
import { conRestablecimientoHabilitado } from "./restablecimiento-contrasena-db";

test.use({
  channel: process.env.PW_USE_EDGE === "1" ? "msedge" : undefined,
  screenshot: "only-on-failure",
  trace: "retain-on-failure",
});

async function evidencia(page: Page, info: TestInfo, nombre: string) {
  await info.attach(nombre, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
}

test.describe("BP-11 - Mi perfil de Administrador", () => {

  test("BP-11: protege el acceso al perfil", async ({
    page,
    usuariosAdministrativos,
  }, info) => {

    // sin iniciar sesion
    await page.goto("/mi-perfil");

    await expect(page).toHaveURL(
      /\/(?:sesion-finalizada|iniciar-sesion)(?:\?.*)?$/
    );

    // un productor no puede editar el perfil de un administrador
    await iniciarSesionProductor(
      page,
      usuariosAdministrativos.productor
    );

    await page.goto("/mi-perfil/editar");

    await expect(page).toHaveURL(
      /\/mi-mercado\/productor(?:\?.*)?$/
    );

    await evidencia(page, info, "BP-11-acceso-protegido");
  });

  test("BP-11.1: consulta mi perfil y sus opciones", async ({
    page,
    usuariosAdministrativos,
  }, info) => {

    await conRestablecimientoHabilitado(async () => {
      const cuenta = usuariosAdministrativos.administrador;
      const nombre = cuenta.usuario.split("@")[0];

      await iniciarSesionAdministrador(page, cuenta);
      await page.goto("/mi-perfil");

      await expect(
        page.getByRole("heading", { name: "Mi perfil" })
      ).toBeVisible();

      const perfil = page.getByRole("region", {
        name: "Datos de mi cuenta",
      });

      // consulta de nombre y correo propios
      await expect(perfil).toContainText(nombre);
      await expect(perfil).toContainText(cuenta.usuario);

      // contra priv
      await expect(
        page.locator('input[type="password"]')
      ).toHaveCount(0);

      expect(await page.content()).not.toContain(cuenta.contrasena);

      // edicion
      const editar = page.getByRole("link", {
        name: "Editar mi perfil",
      });

      await expect(editar).toHaveAttribute(
        "href",
        "/mi-perfil/editar"
      );

      // cambiar contraseña
      const cambiar = page.getByRole("link", {
        name: "Cambiar contraseña",
      });

      await expect(cambiar).toBeVisible();

      await evidencia(page, info, "BP-11-consulta-perfil");

      await cambiar.click();

      await expect(page).toHaveURL(
        /\/mi-perfil\/cambiar-contrasena$/
      );

      await expect(
        page.getByRole("form", {
          name: "Cambio de contraseña",
        }).getByLabel("Contraseña", { exact: true })
      ).toHaveAttribute("autocomplete", "current-password");
    });
  });

  test("BP-11.2: valida los datos y permite cancelar", async ({
    page,
    usuariosAdministrativos,
  }, info) => {

    const cuenta = usuariosAdministrativos.administrador;

    await iniciarSesionAdministrador(page, cuenta);
    await page.goto("/mi-perfil/editar");

    const formulario = page.getByRole("form", {
      name: "Editar mi perfil",
    });

    await expect(formulario).toBeVisible();

    // datos incorrectos: 
    await formulario.getByLabel("Nombre de usuario").fill("ab");
    await formulario.getByLabel("Correo electrónico").fill("invalido");

    await formulario.getByRole("button", {
      name: "Guardar cambios",
    }).click();

    const alerta = formulario.getByRole("alert");

    await expect(alerta).toContainText(
      "El nombre de usuario debe tener al menos 3 caracteres."
    );

    await expect(alerta).toContainText(
      "El correo electrónico no es válido."
    );

    await evidencia(page, info, "BP-11-datos-invalidos");

    // cancelar no guarda
    await formulario.getByRole("button", {
      name: "Cancelar",
    }).click();

    await expect(page).toHaveURL(/\/mi-perfil$/);

    await expect(
      page.getByRole("region", { name: "Datos de mi cuenta" })
    ).toContainText(cuenta.usuario);

    await evidencia(page, info, "BP-11-cancelacion");
  });

  test("BP-11.2: guarda y conserva los cambios", async ({
    page,
    usuariosAdministrativos,
  }, info) => {

    const cuenta = usuariosAdministrativos.administrador;
    const sufijo = randomUUID().slice(0, 8);
    const nombreNuevo = `e2e_bp11_${sufijo}`;
    const correoNuevo = `${nombreNuevo}@example.com`;

    await iniciarSesionAdministrador(page, cuenta);

    await page.goto("/mi-perfil/editar");

    const formulario = page.getByRole("form", {
      name: "Editar mi perfil",
    });

    // modifico datos del admin autenticado
    await formulario.getByLabel("Nombre de usuario")
      .fill(nombreNuevo);

    await formulario.getByLabel("Correo electrónico")
      .fill(correoNuevo);

    await formulario.getByRole("button", {
      name: "Guardar cambios",
    }).click();

    await expect(page).toHaveURL(/\/mi-perfil$/, {
      timeout: 30000,
    });

    const perfil = page.getByRole("region", {
      name: "Datos de mi cuenta",
    });

    await expect(perfil).toContainText(nombreNuevo);
    await expect(perfil).toContainText(correoNuevo);

    // recargaa
    await page.reload();

    await expect(
      page.getByRole("region", { name: "Datos de mi cuenta" })
    ).toContainText(correoNuevo);

    await evidencia(page, info, "BP-11-cambios-persistidos");
  });

});
