
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { iniciarSesionAdministrador } from "./autenticacion";

// Este archivo crea, modifica y elimina un operador de prueba
const CLAVE_INICIAL = "Prueba12345!";
const CLAVE_NUEVA = "Prueba67890!";

test.use({
  channel: process.env.PW_USE_EDGE === "1" ? "msedge" : undefined,
  screenshot: "only-on-failure",
  trace: "retain-on-failure",
});

async function entrarComoAdmin(page: Page) {
  const usuario = process.env.E2E_ADMINISTRADOR_USU || process.env.E2E_ADMIN_USU;
  const contrasena = process.env.E2E_ADMINISTRADOR_PASS || process.env.E2E_ADMIN_PASS;
  if (!usuario || !contrasena) {
    throw new Error("Configurá E2E_ADMIN_USU y E2E_ADMIN_PASS antes de ejecutar BP-01.");
  }
  await iniciarSesionAdministrador(page, { usuario, contrasena });
}

async function abrirGestionUsuarios(page: Page) {
  await page.goto("/administracion#usuarios");
  await expect(page.getByRole("heading", { name: "Gestión de Usuarios" })).toBeVisible();
}

async function buscarUsuario(page: Page, username: string) {
  await page.getByRole("searchbox", { name: "Buscar usuarios" }).fill(username);
  const fila = page.locator('[role="button"]').filter({ hasText: username });
  await expect(fila).toHaveCount(1);
  return fila;
}

async function completarAlta(
  page: Page,
  datos: { usuario: string; nombre: string; local: string; naveId: string; telefono?: string },
) {
  await page.locator("#rol").selectOption("operador");
  await page.locator("#nombreUsuario").fill(datos.usuario);
  await page.locator("#contraseña").fill(CLAVE_INICIAL);
  await page.locator("#confirmacionContraseña").fill(CLAVE_INICIAL);
  await page.locator("#nombre").fill(datos.nombre);
  await page.locator("#numero").fill(datos.telefono ?? "99123456");
  await page.getByPlaceholder("Número de local").first().fill(datos.local);
  await page.locator("select").filter({ hasText: "Seleccionar nave" }).first()
    .selectOption(datos.naveId);
}

async function primerIdNave(page: Page): Promise<string> {
  const id = await page.locator("select").filter({ hasText: "Seleccionar nave" })
    .first().locator('option:not([value=""])').first().getAttribute("value");
  expect(id, "No hay naves disponibles para las pruebas").toBeTruthy();
  return id!;
}

async function iniciarSesionOperador(page: Page, usuario: string, clave: string) {
  await page.goto("/iniciar-sesion");
  await page.getByLabel("Correo electrónico o nombre de usuario").fill(usuario);
  await page.getByLabel("Contraseña", { exact: true }).fill(clave);
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await expect(page).toHaveURL(/\/mi-mercado(?:\/.*)?$/, { timeout: 30_000 });
}

async function eliminarOperadorCreado(page: Page, usuario: string) {
  await abrirGestionUsuarios(page);
  const fila = await buscarUsuario(page, usuario);
  await fila.getByTitle("Eliminar usuario").click();
  const dialogo = page.getByRole("dialog", { name: "¿Eliminar usuario?" });
  await expect(dialogo).toBeVisible();
  await expect(dialogo).toContainText(`@${usuario}`);
  await dialogo.getByRole("button", { name: "Eliminar", exact: true }).click();
  await expect(page.getByText(`El usuario ${usuario} fue eliminado correctamente.`)).toBeVisible();
  await expect(fila).toHaveCount(0);
}

test("CP-01.1-25: sin sesión no se puede acceder al alta", async ({ page }) => {
  await page.goto("/alta-usuario");
  await expect(page).toHaveURL(/\/iniciar-sesion(?:\?.*)?$/);
});

test("BP-01.1: validaciones de alta y controles del formulario", async ({ page }, info) => {
  test.setTimeout(120_000);
  await entrarComoAdmin(page);
  await page.goto("/alta-usuario");
  await page.locator("#rol").selectOption("operador");
  const sufijo = randomUUID().slice(0, 8);
  const nave = await primerIdNave(page);
  await completarAlta(page, {
    usuario: `e2e_val_${sufijo}`,
    nombre: `Validación E2E ${sufijo}`,
    local: `9${Date.now().toString().slice(-8)}`,
    naveId: nave,
  });

  // 4 5 6 9 10 12 y 13
  for (const selector of ["#nombreUsuario", "#contraseña", "#confirmacionContraseña", "#nombre", "#numero"]) {
    const campo = page.locator(selector);
    const original = await campo.inputValue();
    await campo.fill("");
    expect(await campo.evaluate((elemento: HTMLInputElement) => elemento.validity.valueMissing),
      `${selector} debería ser obligatorio`).toBe(true);
    await campo.fill(original);
  }
  const primerLocal = page.getByPlaceholder("Número de local").first();
  const numeroOriginal = await primerLocal.inputValue();
  await primerLocal.fill("");
  expect(await primerLocal.evaluate((elemento: HTMLInputElement) => elemento.validity.valueMissing)).toBe(true);
  await primerLocal.fill(numeroOriginal);

  // 8
  await page.locator("#contraseña").fill("1234567");
  expect(await page.locator("#contraseña").evaluate((elemento: HTMLInputElement) => elemento.validity.tooShort)).toBe(true);
  await page.locator("#contraseña").fill(CLAVE_INICIAL);

  // 22
  await page.getByRole("button", { name: "Agregar fin de contrato" }).first().click();
  await expect(page.locator('input[type="date"]')).toHaveCount(1);
  await page.getByRole("button", { name: "Eliminar fecha" }).click();
  await expect(page.locator('input[type="date"]')).toHaveCount(0);

  // 23
  await page.getByRole("button", { name: "Agregar local" }).click();
  await expect(page.getByPlaceholder("Número de local")).toHaveCount(2);
  await page.getByRole("button", { name: "Eliminar local" }).last().click();
  await expect(page.getByPlaceholder("Número de local")).toHaveCount(1);

  // 07
  await page.locator("#confirmacionContraseña").fill("OtraClave123!");
  await page.getByRole("button", { name: "Registrar usuario" }).click();
  await expect(page.getByText("Las contraseñas no coinciden.")).toBeVisible();
  await page.locator("#confirmacionContraseña").fill(CLAVE_INICIAL);

  // CP 11
  await page.locator("#numero").fill("123");
  await page.getByRole("button", { name: "Registrar usuario" }).click();
  await expect(page.getByText("El teléfono no es válido.")).toBeVisible();
  await page.locator("#numero").fill("99123456");

  // CP-19
  const usuarioOriginal = await page.locator("#nombreUsuario").inputValue();
  await page.locator("#nombreUsuario").fill("ab");
  await page.getByRole("button", { name: "Registrar usuario" }).click();
  await expect(page.getByText("El nombre de usuario debe tener al menos 3 caracteres.")).toBeVisible();
  await page.locator("#nombreUsuario").fill(usuarioOriginal);

  // Cp 20
  await page.getByRole("button", { name: "Agregar local" }).click();
  await page.getByPlaceholder("Número de local").last().fill(numeroOriginal);
  await page.locator("select").filter({ hasText: "Seleccionar nave" }).last().selectOption(nave);
  await page.getByRole("button", { name: "Registrar usuario" }).click();
  await expect(page.getByText(/Local 2: está repetido en el formulario/)).toBeVisible();
  await info.attach("CP-01.1-20-locales-duplicados", {
    body: await page.screenshot({ fullPage: true }), contentType: "image/png",
  });

  // CP-18
  await page.getByRole("button", { name: "Limpiar" }).click();
  await expect(page.locator("#nombreUsuario")).toHaveValue("");
  await expect(page.locator("#nombre")).toHaveValue("");
  await expect(page.getByPlaceholder("Número de local")).toHaveCount(1);
  await expect(page.getByPlaceholder("Número de local").first()).toHaveValue("");
});

test("BP-01: alta, consulta, modificación, permisos y baja", async ({ page, browser }, info) => {
  test.setTimeout(240_000);
  await entrarComoAdmin(page);

  const sufijo = randomUUID().slice(0, 8);
  const usuario = `e2e_${sufijo}`;
  const nombre = `Operador E2E ${sufijo}`;
  const nombreNuevo = `Operador Modificado ${sufijo}`;
  const local = `9${Date.now().toString().slice(-8)}`;
  const localNuevo = `${local}1`;
  let creado = false;
  let eliminado = false;
  let operadorId = 0;

  try {
    await test.step("BP-01.1: registrar con dos locales en naves distintas", async () => {
      await page.goto("/alta-usuario");
      await page.locator("#rol").selectOption("operador");
      const opciones = await page.locator("select").filter({ hasText: "Seleccionar nave" })
        .first().locator('option:not([value=""])').evaluateAll((elementos) =>
          elementos.map((opcion) => (opcion as HTMLOptionElement).value));
      expect(opciones.length, "Se necesitan al menos dos naves para este caso").toBeGreaterThanOrEqual(2);

      await completarAlta(page, { usuario, nombre, local, naveId: opciones[0] });
      await page.getByRole("button", { name: "Agregar fin de contrato" }).click();
      await page.locator('input[type="date"]').fill("2027-12-31");
      await page.getByRole("button", { name: "Agregar local" }).click();
      await page.getByPlaceholder("Número de local").last().fill(local);
      await page.locator("select").filter({ hasText: "Seleccionar nave" }).last().selectOption(opciones[1]);

      await page.getByRole("button", { name: "Registrar usuario" }).click();
      await expect(page.getByRole("heading", { name: "Operador creado satisfactoriamente" })).toBeVisible();
      creado = true;
      await expect(page.getByRole("link", { name: "Precargar productos" }))
        .toHaveAttribute("href", /^\/gestion-operadores\/\d+$/);
      await info.attach("BP-01.1-alta-exitosa", {
        body: await page.screenshot({ fullPage: true }), contentType: "image/png",
      });
      await page.getByRole("button", { name: "Ahora no" }).click();

      // CP-14: username repetido; CP-15: nombre repetido; CP-16: local+nave ocupado.
      await completarAlta(page, { usuario, nombre: `Otro ${sufijo}`, local: `${local}2`, naveId: opciones[0] });
      await page.getByRole("button", { name: "Registrar usuario" }).click();
      await expect(page.getByText("Ya existe un usuario con ese nombre de usuario.")).toBeVisible();

      await completarAlta(page, { usuario: `${usuario}_n`, nombre, local: `${local}2`, naveId: opciones[0] });
      await page.getByRole("button", { name: "Registrar usuario" }).click();
      await expect(page.getByText("Ya existe un operador con ese nombre.")).toBeVisible();

      await completarAlta(page, { usuario: `${usuario}_l`, nombre: `Otro Local ${sufijo}`, local, naveId: opciones[0] });
      await page.getByRole("button", { name: "Registrar usuario" }).click();
      await expect(page.getByText(`El local ${local} ya existe en la nave seleccionada.`)).toBeVisible();
    });

    await test.step("BP-01.2: consultar perfil desde Gestión de Usuarios", async () => {
      await abrirGestionUsuarios(page);
      const fila = await buscarUsuario(page, usuario);
      await fila.click();
      await expect(page).toHaveURL(/\/gestion-operadores\/\d+$/);
      const coincidencia = new URL(page.url()).pathname.match(/\/gestion-operadores\/(\d+)$/);
      expect(coincidencia).not.toBeNull();
      operadorId = Number(coincidencia![1]);

      await expect(page.locator("#nombre-operador")).toHaveText(nombre);
      await expect(page.getByText("+59899123456")).toBeVisible();
      await expect(page.getByText(`Local ${local}`, { exact: false })).toHaveCount(2);
      await expect(page.getByText("Vence: 31/12/2027")).toBeVisible();
      await expect(page.getByText("Sin fecha de fin")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Publicaciones (0)" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Editar operador" })).toBeVisible();
      await info.attach("BP-01.2-perfil", {
        body: await page.screenshot({ fullPage: true }), contentType: "image/png",
      });
    });

    await test.step("BP-01.1/01.2/01.4: un operador no accede a las páginas administrativas", async () => {
      const contexto = await browser.newContext({ baseURL: new URL(page.url()).origin });
      try {
        const paginaOperador = await contexto.newPage();
        await iniciarSesionOperador(paginaOperador, usuario, CLAVE_INICIAL);
        for (const ruta of ["/alta-usuario", `/gestion-operadores/${operadorId}`, `/gestion-operadores/${operadorId}/editar`]) {
          await paginaOperador.goto(ruta);
          await expect(paginaOperador).toHaveURL(
            (url) =>
              url.pathname === "/mi-mercado" ||
              url.pathname.startsWith("/mi-mercado/"),
          );
        }
      } finally {
        await contexto.close();
      }
    });

    await test.step("BP-01.4: cancelar, validar y guardar modificaciones", async () => {
      await page.getByRole("link", { name: "Editar operador" }).click();
      await expect(page.getByRole("heading", { name: "Modificar operador" })).toBeVisible();
      const campoNombre = page.getByRole("textbox", { name: "Nombre", exact: true });
      const campoTelefono = page.getByRole("textbox", { name: "WhatsApp" });
      await expect(campoNombre).toHaveValue(nombre);
      await expect(campoTelefono).toHaveValue("99123456");

      // CP-11: Cancelar no guarda.
      await campoNombre.fill("No debe guardarse");
      await page.getByRole("button", { name: "Cancelar", exact: true }).click();
      await expect(page.locator("#nombre-operador")).toHaveText(nombre);
      await page.getByRole("link", { name: "Editar operador" }).click();

      // CP-08/09/10: entradas inválidas.
      await page.getByRole("textbox", { name: "WhatsApp" }).fill("abc");
      await page.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText("El teléfono no es válido.");
      await page.getByRole("textbox", { name: "WhatsApp" }).fill("99234567");

      await page.getByLabel("Nueva contraseña").fill("123");
      await page.getByLabel("Confirmar contraseña").fill("123");
      await page.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText("La contraseña debe tener al menos 8 caracteres.");

      await page.getByLabel("Nueva contraseña").fill(CLAVE_NUEVA);
      await page.getByLabel("Confirmar contraseña").fill("OtraClave123!");
      await page.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText("Las contraseñas no coinciden.");

      // CP-05/06/07/12: modificación válida + nueva contraseña + persistencia.
      await page.getByLabel("Confirmar contraseña").fill(CLAVE_NUEVA);
      await page.getByRole("textbox", { name: "Nombre", exact: true }).fill(nombreNuevo);
      await page.getByRole("textbox", { name: "Número de local" }).first().fill(localNuevo);
      await page.locator('input[type="date"]').first().fill("2028-06-30");
      await page.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(page).toHaveURL(new RegExp(`/gestion-operadores/${operadorId}$`), { timeout: 20_000 });
      await page.reload();
      await expect(page.locator("#nombre-operador")).toHaveText(nombreNuevo);
      await expect(page.getByText("+59899234567")).toBeVisible();
      await expect(page.getByText(`Local ${localNuevo}`, { exact: false })).toBeVisible();
      await expect(page.getByText("Vence: 30/06/2028")).toBeVisible();
      await info.attach("BP-01.4-modificacion-persistida", {
        body: await page.screenshot({ fullPage: true }), contentType: "image/png",
      });

      const contexto = await browser.newContext({ baseURL: new URL(page.url()).origin });
      try {
        await iniciarSesionOperador(await contexto.newPage(), usuario, CLAVE_NUEVA);
      } finally {
        await contexto.close();
      }
    });

    await test.step("BP-01.3: cancelar baja y luego eliminar", async () => {
      await abrirGestionUsuarios(page);
      const fila = await buscarUsuario(page, usuario);
      await fila.getByTitle("Eliminar usuario").click();
      const dialogo = page.getByRole("dialog", { name: "¿Eliminar usuario?" });
      await expect(dialogo).toContainText(`@${usuario}`);
      await dialogo.getByRole("button", { name: "Cancelar" }).click();
      await expect(dialogo).not.toBeVisible();
      await expect(fila).toBeVisible();
      await eliminarOperadorCreado(page, usuario);
      eliminado = true;
      await page.goto(`/gestion-operadores/${operadorId}`);
      await expect(page.getByText("404", { exact: true })).toBeVisible();
    });
  } finally {
    if (creado && !eliminado) {
      // Mejor esfuerzo: si falla una aserción, intentar no dejar basura en testing.
      try {
        await eliminarOperadorCreado(page, usuario);
      } catch (error) {
        console.warn(`No se pudo limpiar el operador de prueba ${usuario}:`, error);
      }
    }
  }
});
