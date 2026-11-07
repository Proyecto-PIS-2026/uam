
import { randomUUID } from "node:crypto";
import { expect, type Page, type TestInfo } from "@playwright/test";
import { test } from "./usuarios-administrativos";
import { iniciarSesionAdministrador, iniciarSesionProductor } from "./autenticacion";

// e2e del 3 c: 

const CLAVE = "Prueba12345!";

test.use({
  channel: process.env.PW_USE_EDGE === "1" ? "msedge" : undefined,
  screenshot: "only-on-failure",
  trace: "retain-on-failure",
});

async function abrirGestion(page: Page) {
  await page.goto("/administracion#usuarios");
  await expect(
    page.getByRole("heading", { name: "Gestión de Usuarios" })
  ).toBeVisible();
}

async function buscarFila(page: Page, username: string) {
  await page.getByRole("searchbox", { name: "Buscar usuarios" }).fill(username);
  const fila = page.locator('[role="button"]').filter({ hasText: username });
  await expect(fila).toHaveCount(1);
  return fila;
}

async function evidencia(page: Page, info: TestInfo, nombre: string) {
  await info.attach(nombre, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
}

test("BP-03 CA-1: usuarios sin permisos no acceden a la gestión", async ({
  page,
  usuariosAdministrativos,
}, info) => {
  for (const ruta of [
    "/administracion",
    "/alta-usuario",
    "/gestion-administradores/999999/editar",
  ]) {
    await page.goto(ruta);
    await expect(page).toHaveURL(/\/iniciar-sesion(?:\?.*)?$/);
  }

  await iniciarSesionProductor(page, usuariosAdministrativos.productor);

  for (const ruta of [
    "/administracion",
    "/alta-usuario",
    "/gestion-administradores/999999/editar",
  ]) {
    await page.goto(ruta);
    await expect(page).toHaveURL(/\/mi-mercado\/productor(?:\?.*)?$/);
  }

  await evidencia(page, info, "BP-03-acceso-denegado");
});

test("BP-03: alta, consulta, modificación, errores y baja", async ({
  page,
  browser,
  usuariosAdministrativos,
}, info) => {
  test.setTimeout(240_000);

  await iniciarSesionAdministrador(
    page,
    usuariosAdministrativos.administrador
  );

  const sufijo = randomUUID().slice(0, 8);
  const nombreInicial = `e2e_admin03_${sufijo}`;
  const correoInicial = `${nombreInicial}@example.com`;
  const nombreModificado = `e2e_admin03_mod_${sufijo}`;

  let nombreActual = nombreInicial;
  let creado = false;
  let eliminado = false;
  let idAdministrador = 0;

  try {
    await test.step("CA-2: alta de administrador", async () => {
      await page.goto("/alta-usuario?rol=administrador");

      await expect(
        page.getByRole("combobox", { name: /^Rol del usuario/ })
      ).toHaveText("Administrador");

      await page.locator("#nombreUsuario").fill(nombreInicial);
      await page.locator("#email").fill(correoInicial);
      await page.locator("#contraseña").fill(CLAVE);
      await page.locator("#confirmacionContraseña").fill(CLAVE);

      await page.getByRole("button", { name: "Registrar usuario" }).click();

      await expect(
        page.getByText("Administrador creado correctamente.", { exact: true })
      ).toBeVisible();

      creado = true;
      await evidencia(page, info, "BP-03-alta-exitosa");

      await abrirGestion(page);
      await expect(await buscarFila(page, nombreInicial))
        .toContainText(correoInicial);
    });

    await test.step("CA-6: correo duplicado", async () => {
      const duplicado = `e2e_admin03_dup_${sufijo}`;

      await page.goto("/alta-usuario?rol=administrador");
      await page.locator("#nombreUsuario").fill(duplicado);
      await page.locator("#email").fill(correoInicial);
      await page.locator("#contraseña").fill(CLAVE);
      await page.locator("#confirmacionContraseña").fill(CLAVE);

      await page.getByRole("button", { name: "Registrar usuario" }).click();

      await expect(
        page.getByText("Ya existe un administrador con ese email.")
      ).toBeVisible();

      await evidencia(page, info, "BP-03-correo-duplicado");

      await abrirGestion(page);
      await page.getByRole("searchbox", { name: "Buscar usuarios" })
        .fill(duplicado);

      await expect(
        page.locator('[role="button"]').filter({ hasText: duplicado })
      ).toHaveCount(0);
    });

    await test.step("CA-3 y CA-7: consulta sin mostrar contraseña", async () => {
      const fila = await buscarFila(page, nombreInicial);
      await fila.click();

      await expect(page).toHaveURL(/\/gestion-administradores\/\d+$/);

      const coincidencia = new URL(page.url()).pathname.match(
        /\/gestion-administradores\/(\d+)$/
      );

      expect(coincidencia).not.toBeNull();
      idAdministrador = Number(coincidencia![1]);

      await expect(
        page.getByRole("heading", { name: nombreInicial, exact: true })
      ).toBeVisible();

      await expect(page.getByText(correoInicial, { exact: false }))
        .toBeVisible();

      await expect(page.locator('input[type="password"]')).toHaveCount(0);
      await expect(page.getByText(CLAVE, { exact: false })).toHaveCount(0);

      await evidencia(page, info, "BP-03-consulta-perfil");
    });

    await test.step("CA-3: consultar cuentas diferentes", async () => {
      await abrirGestion(page);

      const actor = usuariosAdministrativos.administrador.usuario.split("@")[0];

      await (await buscarFila(page, actor)).click();

      await expect(
        page.getByRole("heading", { name: actor, exact: true })
      ).toBeVisible();

      await expect(
        page.getByText(correoInicial, { exact: false })
      ).toHaveCount(0);

      await abrirGestion(page);
      await (await buscarFila(page, nombreInicial)).click();

      await expect(
        page.getByRole("heading", { name: nombreInicial, exact: true })
      ).toBeVisible();
    });

    await test.step("CA-4: cancelar modificación", async () => {
      await page.getByRole("link", { name: "Editar administrador" }).click();

      await page.getByLabel("Nombre de usuario")
        .fill("nombre_que_no_debe_guardarse");

      await page.getByRole("button", { name: "Cancelar", exact: true })
        .click();

      await expect(
        page.getByRole("heading", { name: nombreInicial, exact: true })
      ).toBeVisible();
    });

    await test.step("CA-6: error de modificación no guarda", async () => {
      await page.getByRole("link", { name: "Editar administrador" }).click();

      await page.getByLabel("Nombre de usuario")
        .fill(usuariosAdministrativos.productor.usuario);

      await page.getByRole("button", { name: "Guardar cambios" }).click();

      await expect(
        page.locator('[role="alert"]:not(#__next-route-announcer__)')
      ).toContainText(
        "Ya existe un usuario con ese nombre."
      );

      await evidencia(page, info, "BP-03-error-modificacion");

      await page.getByRole("button", { name: "Cancelar", exact: true })
        .click();

      await expect(page).toHaveURL(
        new RegExp(`/gestion-administradores/${idAdministrador}$`),
        { timeout: 15000 }
      );

      await page.reload();

      await expect(page.getByText(correoInicial, { exact: false }))
        .toBeVisible();
    });

    await test.step("CA-4: modificación persistida", async () => {
      await page.getByRole("link", { name: "Editar administrador" }).click();

      await expect(page.getByLabel("Correo electrónico", { exact: true })).toHaveCount(0);
      await page.getByLabel("Nombre de usuario").fill(nombreModificado);

      await page.getByRole("button", { name: "Guardar cambios" }).click();

      await expect(page).toHaveURL(
        new RegExp(`/gestion-administradores/${idAdministrador}$`),
        { timeout: 30_000 }
      );

      nombreActual = nombreModificado;
      await page.reload();

      await expect(
        page.getByRole("heading", { name: nombreModificado, exact: true })
      ).toBeVisible();

      await expect(page.getByText(correoInicial, { exact: false }))
        .toBeVisible();

      await evidencia(page, info, "BP-03-modificacion-persistida");

      await abrirGestion(page);
      await expect(await buscarFila(page, nombreModificado))
        .toContainText(correoInicial);
    });

    const contextoNuevoAdmin = await browser.newContext({
      baseURL: new URL(page.url()).origin,
    });

    try {
      const nuevoAdmin = await contextoNuevoAdmin.newPage();

      await test.step("CA-4: iniciar sesión con el correo original después de editar", async () => {
        await iniciarSesionAdministrador(nuevoAdmin, {
          usuario: correoInicial,
          contrasena: CLAVE,
        });
      });

      await test.step("La edición de Mi perfil no incluye el campo de correo", async () => {
        await nuevoAdmin.goto("/mi-perfil");
        await nuevoAdmin.getByRole("link", { name: "Editar mi perfil" }).click();
        await expect(nuevoAdmin).toHaveURL(/\/mi-perfil\/editar$/);
        await expect(nuevoAdmin.getByLabel("Correo electrónico", { exact: true })).toHaveCount(0);
        await nuevoAdmin.getByRole("button", { name: "Cancelar", exact: true }).click();
        await expect(nuevoAdmin).toHaveURL(/\/mi-perfil$/);
      });

      await test.step("CA-5: cancelar y confirmar baja", async () => {
        await abrirGestion(page);

        const fila = await buscarFila(page, nombreModificado);
        await fila.getByTitle("Eliminar usuario").click();

        const dialogo = page.getByRole("dialog", {
          name: "¿Eliminar usuario?",
        });

        await expect(dialogo).toContainText(`@${nombreModificado}`);

        await dialogo.getByRole("button", { name: "Cancelar" }).click();
        await expect(dialogo).not.toBeVisible();
        await expect(fila).toBeVisible();

        await fila.getByTitle("Eliminar usuario").click();
        await dialogo.getByRole("button", {
          name: "Eliminar",
          exact: true,
        }).click();

        await expect(
          page.getByText(
            `El usuario ${nombreModificado} fue eliminado correctamente.`
          )
        ).toBeVisible();

        eliminado = true;

        await expect(fila).toHaveCount(0);
        await evidencia(page, info, "BP-03-baja-exitosa");
      });

      await test.step("CA-5: baja invalida el acceso", async () => {
        await page.goto(`/gestion-administradores/${idAdministrador}`);

        await expect(
          page.getByText(/404: Página no encontrada/)
        ).toBeVisible();

        await nuevoAdmin.goto("/administracion");

        await expect(nuevoAdmin).toHaveURL(
          /\/iniciar-sesion(?:\?.*)?$/
        );

        await nuevoAdmin.getByLabel("Correo electrónico o nombre de usuario")
          .fill(correoInicial);

        await nuevoAdmin.getByLabel("Contraseña", { exact: true })
          .fill(CLAVE);

        await nuevoAdmin.getByRole("button", {
          name: "Iniciar sesión",
          exact: true,
        }).click();
        await expect(
          nuevoAdmin.locator('form [role="alert"]')
        ).toContainText("Las credenciales ingresadas no son correctas.");
      });
    } finally {
      await contextoNuevoAdmin.close();
    }
  } finally {
    if (creado && !eliminado) {
      try {
        await abrirGestion(page);

        const busqueda = page.getByRole("searchbox", {
          name: "Buscar usuarios",
        });

        await busqueda.fill(nombreActual);

        if (
          await page.locator('[role="button"]')
            .filter({ hasText: nombreActual }).count() === 0
        ) {
          nombreActual =
            nombreActual === nombreInicial ? nombreModificado : nombreInicial;
          await busqueda.fill(nombreActual);
        }

        const fila = await buscarFila(page, nombreActual);

        await fila.getByTitle("Eliminar usuario").click();

        await page.getByRole("dialog", { name: "¿Eliminar usuario?" })
          .getByRole("button", { name: "Eliminar", exact: true }).click();

        await expect(
          page.getByText(
            `El usuario ${nombreActual} fue eliminado correctamente.`
          )
        ).toBeVisible();
      } catch (error) {
        console.warn("No se pudo limpiar el administrador E2E:", error);
      }
    }
  }
});

// Dps 

