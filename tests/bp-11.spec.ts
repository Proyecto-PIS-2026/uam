
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

      const perfil = page.getByRole("region", {
        name: "Datos de mi cuenta",
      });

      // consulta de nombre y correo propios
      await expect(
        perfil.getByRole("heading", { name: nombre, exact: true, level: 1 })
      ).toBeVisible();
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
        }).getByLabel("Contraseña actual", { exact: true })
      ).toHaveAttribute("autocomplete", "current-password");
    });
  });

  test("BP-11.2: valida los datos y permite cancelar", async ({
    page,
    usuariosAdministrativos,
  }, info) => {

    const cuenta = usuariosAdministrativos.administrador;
    const nombre = cuenta.usuario.split("@")[0];

    await iniciarSesionAdministrador(page, cuenta);
    await page.goto("/mi-perfil/editar");

    const formulario = page.getByRole("form", {
      name: "Editar mi perfil",
    });

    await expect(formulario).toBeVisible();
    await expect(formulario.getByLabel("Correo electrónico")).toHaveCount(0);

    // validar el único dato editable
    await formulario.getByLabel("Nombre de usuario").fill("ab");

    await formulario.getByRole("button", {
      name: "Guardar cambios",
    }).click();

    const alerta = formulario.getByRole("alert");

    await expect(alerta).toContainText(
      "El nombre de usuario debe tener al menos 3 caracteres."
    );

    await evidencia(page, info, "BP-11-datos-invalidos");

    // cancelar no guarda
    await formulario.getByLabel("Nombre de usuario").fill(`${nombre}_editado`);
    await formulario.getByRole("button", {
      name: "Cancelar",
    }).click();

    await expect(page).toHaveURL(/\/mi-perfil$/);

    const perfil = page.getByRole("region", { name: "Datos de mi cuenta" });
    await expect(
      perfil.getByRole("heading", { name: nombre, exact: true, level: 1 })
    ).toBeVisible();
    await expect(perfil).toContainText(cuenta.usuario);

    await evidencia(page, info, "BP-11-cancelacion");
  });

  test("BP-11.2: guarda el nombre y conserva el correo", async ({
    page,
    usuariosAdministrativos,
  }, info) => {

    const cuenta = usuariosAdministrativos.administrador;
    const sufijo = randomUUID().slice(0, 8);
    const nombreNuevo = `e2e_bp11_${sufijo}`;

    await iniciarSesionAdministrador(page, cuenta);

    await page.goto("/mi-perfil/editar");

    const formulario = page.getByRole("form", {
      name: "Editar mi perfil",
    });

    await expect(formulario).toBeVisible();
    await expect(formulario.getByLabel("Correo electrónico")).toHaveCount(0);

    // modificar el nombre sin cambiar el correo del administrador
    await formulario.getByLabel("Nombre de usuario")
      .fill(nombreNuevo);

    await formulario.getByRole("button", {
      name: "Guardar cambios",
    }).click();

    await expect(page).toHaveURL(/\/mi-perfil$/, {
      timeout: 30000,
    });

    const perfil = page.getByRole("region", {
      name: "Datos de mi cuenta",
    });

    await expect(
      perfil.getByRole("heading", { name: nombreNuevo, exact: true, level: 1 })
    ).toBeVisible();
    await expect(perfil).toContainText(cuenta.usuario);

    // ambos datos se conservan al recargar
    await page.reload();

    await expect(
      perfil.getByRole("heading", { name: nombreNuevo, exact: true, level: 1 })
    ).toBeVisible();
    await expect(perfil).toContainText(cuenta.usuario);

    await evidencia(page, info, "BP-11-cambios-persistidos");
  });

});
