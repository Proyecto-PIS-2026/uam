
import { expect, type Page } from "@playwright/test";
import { test } from "./usuarios-administrativos";
import { iniciarSesionAdministrador } from "./autenticacion";

test.use({
  channel: process.env.PW_USE_EDGE === "1" ? "msedge" : undefined,
  screenshot: "only-on-failure",
  trace: "retain-on-failure",
});

async function solicitarRestablecimiento(page: Page, username: string) {
  await page.goto("/iniciar-sesion");

  await page.getByRole("button", {
    name: "Solicitar recuperación de contraseña",
  }).click();

  const dialogo = page.getByRole("dialog", {
    name: "Solicitar recuperación de contraseña",
  });

  await dialogo.getByRole("textbox", {
    name: "Nombre de usuario",
  }).fill(username);

  await dialogo.getByRole("button", {
    name: "Aceptar",
    exact: true,
  }).click();

  await expect(
    page.getByRole("status").filter({
      hasText: "La solicitud de recuperación fue realizada correctamente.",
    }),
  ).toBeVisible();
}

async function seleccionarFiltro(
  page: Page,
  nombre: string,
  opcion: string,
) {
  await page.getByRole("combobox", {
    name: nombre,
    exact: true,
  }).click();

  await page.getByRole("option", {
    name: opcion,
    exact: true,
  }).click();
}

async function abrirGestionUsuarios(page: Page) {
  await page.getByRole("button", {
    name: "Usuarios",
    exact: true,
  }).click();

  await expect(
    page.getByRole("heading", {
      name: "Gestión de Usuarios",
    }),
  ).toBeVisible();
}

function filaUsuario(page: Page, username: string) {
  return page.locator('[role="button"]').filter({
    hasText: username,
  });
}

test("BP-16.3: visualizar y filtrar solicitudes de restablecimiento", async ({
  page,
  usuariosAdministrativos,
}, testInfo) => {
  test.slow();

  const productor = usuariosAdministrativos.productor.usuario;
  const administrador = usuariosAdministrativos.administrador.usuario.split("@")[0];

  await test.step("CP-01: generar una solicitud real", async () => {
    await solicitarRestablecimiento(page, productor);
  });

  await iniciarSesionAdministrador(
    page,
    usuariosAdministrativos.administrador,
  );

  await abrirGestionUsuarios(page);

  const buscar = page.getByRole("searchbox", {
    name: "Buscar usuarios",
  });

  const filaProductor = filaUsuario(page, productor);
  const filaAdministrador = filaUsuario(page, administrador);

  await test.step("CP-02: identificar al usuario que solicitó restablecimiento", async () => {
    await buscar.fill(productor);

    await expect(filaProductor).toBeVisible();
    await expect(filaProductor).toContainText(
      "Restablecimiento solicitado",
    );

    await buscar.fill(administrador);

    await expect(filaAdministrador).toBeVisible();
    await expect(filaAdministrador).not.toContainText(
      "Restablecimiento solicitado",
    );
  });

  await test.step("CP-03: filtrar por solicitudes pendientes", async () => {
    await seleccionarFiltro(
      page,
      "Restablecimiento",
      "Solicitado",
    );

    await expect(filaAdministrador).toHaveCount(0);
    await expect(
      page.getByText("No se encontraron usuarios."),
    ).toBeVisible();

    await buscar.fill(productor);

    await expect(filaProductor).toBeVisible();
    await expect(filaProductor).toContainText(
      "Restablecimiento solicitado",
    );

    await testInfo.attach("BP-16.3-filtro-solicitado", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
  });

  await test.step("CP-04: combinar filtros de rol y restablecimiento", async () => {
    await seleccionarFiltro(page, "Rol", "Operador");
    await buscar.fill(productor);
    await expect(filaProductor).toHaveCount(0);

    await seleccionarFiltro(page, "Rol", "Productor");
    await buscar.fill(productor);
    await expect(filaProductor).toBeVisible();

    await seleccionarFiltro(
      page,
      "Restablecimiento",
      "Todos",
    );

    await expect(filaProductor).toBeVisible();
  });
});

test("BP-16.3: filtro de restablecimiento en pantalla móvil", async ({
  page,
  usuariosAdministrativos,
}, testInfo) => {
  test.slow();

  const productor = usuariosAdministrativos.productor.usuario;
  const administrador = usuariosAdministrativos.administrador.usuario.split("@")[0];

  await solicitarRestablecimiento(page, productor);

  await iniciarSesionAdministrador(
    page,
    usuariosAdministrativos.administrador,
  );

  await page.setViewportSize({
    width: 390,
    height: 844,
  });

  await page.goto("/administracion");

  await abrirGestionUsuarios(page);

  const buscar = page.getByRole("searchbox", {
    name: "Buscar usuarios",
  });

  const filaProductor = filaUsuario(page, productor);
  const filaAdministrador = filaUsuario(page, administrador);

  await test.step("CP-05: mostrar y utilizar el filtro móvil", async () => {
    await buscar.fill(productor);

    await expect(filaProductor).toBeVisible();
    await expect(filaProductor).toContainText(
      "Restablecimiento solicitado",
    );

    await expect(
      page.getByText("Solicitaron reestablecimiento"),
    ).toBeVisible();

    await seleccionarFiltro(
      page,
      "Filtrar por restablecimiento",
      "Solicitado",
    );

    await expect(filaProductor).toBeVisible();

    await testInfo.attach("BP-16.3-filtro-movil", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });

    await buscar.fill(administrador);
    await expect(filaAdministrador).toHaveCount(0);

    await seleccionarFiltro(
      page,
      "Filtrar por restablecimiento",
      "Todos",
    );

    await expect(filaAdministrador).toBeVisible();
  });
});
