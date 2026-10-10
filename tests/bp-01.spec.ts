
import { test, expect } from "@playwright/test";

test.use({
  channel: process.env.PW_USE_EDGE === "1" ? "msedge" : undefined,
  screenshot: "only-on-failure",
});

test("BP-01: alta, consulta, modificación y baja de operador", async ({
  page,
}) => {
  test.setTimeout(120_000);

  // Datos únicos para no afectar operadores existentes.
  const sufijo = Date.now().toString(36);
  const usuario = `e2e_${sufijo}`;
  const nombreInicial = `Operador E2E ${sufijo}`;
  const nombreModificado = `Operador Modificado ${sufijo}`;
  const numeroLocal = `9${Date.now().toString().slice(-8)}`;
  const numeroLocalModificado = `${numeroLocal}1`;

  const telefonoInicial = "99123456";
  const telefonoModificado = "99234567";
  const fechaInicial = "2027-12-31";
  const fechaModificada = "2028-06-30";

  // =========================================
  // BP-01.1: Alta de operador
  // =========================================

  await page.goto("/alta-usuario");

  await expect(
    page.getByRole("heading", { name: "Alta de usuario" }),
  ).toBeVisible();

  await page.locator("#rol").selectOption("operador");

  await page.locator("#nombreUsuario").fill(usuario);
  await page.locator("#contraseña").fill("Prueba12345!");
  await page.locator("#confirmacionContraseña").fill("Prueba12345!");

  await page.locator("#nombre").fill(nombreInicial);
  await page.locator("#numero").fill(telefonoInicial);

  await page.getByPlaceholder("Número de local").fill(numeroLocal);

  // Seleccionar una nave disponible.
  const selectorNave = page
    .locator("select")
    .filter({ hasText: "Seleccionar nave" });

  const naveId = await selectorNave
    .locator('option:not([value=""])')
    .first()
    .getAttribute("value");

  expect(naveId, "Debe existir al menos una nave").toBeTruthy();

  await selectorNave.selectOption(naveId!);

  // Agregar fecha de fin de contrato.
  await page
    .getByRole("button", { name: /Agregar fin de contrato/ })
    .click();

  await page.locator('input[type="date"]').fill(fechaInicial);

  // Capturar la respuesta del alta para obtener el ID creado.
  const respuestaAlta = page.waitForResponse(
    (respuesta) =>
      respuesta.url().includes("/alta-usuario") &&
      respuesta.request().method() === "POST" &&
      Boolean(respuesta.request().headers()["next-action"]),
  );

  await page
    .getByRole("button", { name: "Registrar usuario" })
    .click();

  const respuesta = await respuestaAlta;

  // CA: El sistema informa el alta exitosa.
  await expect(
    page.getByRole("heading", {
      name: "Operador creado satisfactoriamente",
    }),
  ).toBeVisible();

  const contenido = (await respuesta.text()).replace(/\\"/g, '"');

  expect(contenido).toMatch(/"esValido"\s*:\s*true/);

  const coincidencia = contenido.match(/"id"\s*:\s*(\d+)/);

  expect(
    coincidencia,
    "No se pudo obtener el ID del operador creado",
  ).not.toBeNull();

  const operadorId = Number(coincidencia![1]);

  await page.getByRole("button", { name: "Ahora no" }).click();

  // =========================================
  // BP-01.2: Consulta de operador
  // =========================================

  await page.goto("/operadores");

  // CA: El operador aparece en el listado.
  await expect(
    page.getByRole("link", {
      name: new RegExp(nombreInicial),
    }),
  ).toBeVisible();

  // Consultar el perfil administrativo.
  await page.goto(`/gestion-operadores/${operadorId}`);

  // CA: Se muestran los datos del operador.
  await expect(
    page.locator("#nombre-operador"),
  ).toHaveText(nombreInicial);

  await expect(
    page.getByText(`+598${telefonoInicial}`),
  ).toBeVisible();

  await expect(
    page.getByText(`Local ${numeroLocal}`, {
      exact: false,
    }),
  ).toBeVisible();

  await expect(
    page.getByText("Vence: 31/12/2027"),
  ).toBeVisible();

  // =========================================
  // BP-01.4: Modificación de operador
  // =========================================

  await page.getByRole("link", { name: "Editar operador" }).click();

  await expect(
    page.getByRole("heading", {
      name: "Modificar operador",
    }),
  ).toBeVisible();

  // CA: El formulario carga los datos actuales.
  await expect(
    page.getByRole("textbox", { name: "Nombre", exact: true }),
  ).toHaveValue(nombreInicial);

  await expect(
    page.getByRole("textbox", { name: "WhatsApp" }),
  ).toHaveValue(telefonoInicial);

  // Modificar los datos.
  await page
    .getByRole("textbox", { name: "Nombre", exact: true })
    .fill(nombreModificado);

  await page
    .getByRole("textbox", { name: "WhatsApp" })
    .fill(telefonoModificado);

  await page
    .getByRole("textbox", { name: "Número de local" })
    .fill(numeroLocalModificado);

  await page.locator('input[type="date"]').fill(fechaModificada);

  // Guardar los cambios.
  await page
    .getByRole("button", { name: "Guardar cambios" })
    .click();

  // CA: Regresa al perfil del operador.
  await expect(page).toHaveURL(
    new RegExp(`/gestion-operadores/${operadorId}/?$`),
  );

  // CA: Los cambios persisten después de recargar.
  await page.reload();

  await expect(
    page.locator("#nombre-operador"),
  ).toHaveText(nombreModificado);

  await expect(
    page.getByText(`+598${telefonoModificado}`),
  ).toBeVisible();

  await expect(
    page.getByText(`Local ${numeroLocalModificado}`, {
      exact: false,
    }),
  ).toBeVisible();

  await expect(
    page.getByText("Vence: 30/06/2028"),
  ).toBeVisible();

  // =========================================
  // BP-01.3: Baja de operador
  // =========================================

  await page.getByRole("link", { name: "Editar operador" }).click();

  // CA: Existe una opción de baja.
  const botonEliminar = page.getByRole("button", {
    name: "Eliminar operador",
  });

  await expect(botonEliminar).toBeVisible();

  // Detectar si se utiliza una confirmación nativa.
  let confirmacionNativa = false;

  page.once("dialog", async (dialogo) => {
    expect(dialogo.type()).toBe("confirm");
    confirmacionNativa = true;
    await dialogo.accept();
  });

  await botonEliminar.click();

  // CA: El sistema solicita confirmar la eliminación.
  const modal = page.getByRole("dialog");

  if (await modal.isVisible()) {
    await expect(modal).toContainText(/eliminar/i);

    await modal
      .getByRole("button", { name: /eliminar|confirmar/i })
      .click();
  } else {
    expect(
      confirmacionNativa,
      "La baja debe solicitar confirmación",
    ).toBe(true);
  }

  // CA: El operador deja de aparecer en el listado.
  await page.goto("/operadores");

  await expect(
    page.getByRole("link", {
      name: new RegExp(nombreModificado),
    }),
  ).toHaveCount(0);

  // CA: El perfil eliminado ya no está disponible.
  await page.goto(`/gestion-operadores/${operadorId}`);

  await expect(
    page.locator("#nombre-operador"),
  ).toHaveCount(0);

  await expect(
    page.getByText("404", { exact: true }),
  ).toBeVisible();
});
