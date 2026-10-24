import { randomUUID } from "node:crypto";
import { expect, test, type BrowserContext, type Page, type TestInfo } from "@playwright/test";
import { iniciarSesionAdministrador, iniciarSesionProductor } from "./autenticacion";

/**
 * E2E de BP-02 (alta, consulta, modificación y baja de Productor).
 * Crea UN productor ficticio por ejecución y lo elimina al terminar.
 * No usa ni elimina productores de la seed.
 *
 * Requiere la aplicación ya funcionando y las variables
 * E2E_BP02_ADMIN_USU / E2E_BP02_ADMIN_PASS (sin interferir con el config de Playwright).
 */
const CLAVE = "Prueba12345!";

test.use({ channel: process.env.PW_USE_EDGE === "1" ? "msedge" : undefined, screenshot: "only-on-failure", trace: "retain-on-failure" });

type Opcion = { id: number; nombre: string };
type Catalogos = {
  especies: Opcion[];
  variedades: (Opcion & { especieId: number })[];
  presentaciones: (Opcion & { variedadId: number })[];
  categorias: (Opcion & { especieId: number | null })[];
  calibres: Opcion[];
  paises: Opcion[];
};

async function accederComoAdmin(page: Page) {
  const usuario = process.env.E2E_BP02_ADMIN_USU;
  const contrasena = process.env.E2E_BP02_ADMIN_PASS;
  if (!usuario || !contrasena) {
    throw new Error("Configurá E2E_BP02_ADMIN_USU y E2E_BP02_ADMIN_PASS antes de ejecutar BP-02.");
  }
  await iniciarSesionAdministrador(page, { usuario, contrasena });
}

async function abrirGestion(page: Page) {
  await page.goto("/administracion#usuarios");
  await expect(page.getByRole("heading", { name: "Gestión de Usuarios" })).toBeVisible();
}

async function filaProductor(page: Page, username: string) {
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

async function abrirAltaProductor(page: Page) {
  await page.goto("/alta-usuario?rol=productor");
  await expect(page.locator("#rol")).toHaveValue("productor");
}

async function completarAlta(page: Page, username: string, nombre: string) {
  await page.locator("#nombreUsuario").fill(username);
  await page.locator("#contraseña").fill(CLAVE);
  await page.locator("#confirmacionContraseña").fill(CLAVE);
  await page.locator("#nombre").fill(nombre);
  await page.locator("#numero").fill("99123456");
}

/** Prepara una publicación por API como dato de prueba. La baja se ejecuta por la interfaz. */
async function crearPublicacionDePrueba(page: Page, productorId: number) {
  const respuestaCatalogos = await page.request.get("/api/publicaciones/productor");
  expect(respuestaCatalogos.ok(), "No se pudieron consultar los catálogos del Productor").toBe(true);
  const c = (await respuestaCatalogos.json()) as Catalogos;

  let ids: {
    especieId: number; variedadId: number; presentacionId: number; categoriaId: number;
  } | null = null;

  for (const especie of c.especies) {
    const variedad = c.variedades.find((v) => v.especieId === especie.id);
    if (!variedad) continue;
    const presentacion = c.presentaciones.find((p) => p.variedadId === variedad.id);
    const categoria = c.categorias.find((a) => a.especieId === especie.id || a.especieId === null);
    if (!presentacion || !categoria) continue;
    ids = {
      especieId: especie.id, variedadId: variedad.id,
      presentacionId: presentacion.id, categoriaId: categoria.id,
    };
    break;
  }
  if (!ids || !c.calibres[0] || !c.paises[0]) {
    throw new Error("Faltan catálogos para preparar una publicación de BP-02.3.");
  }

  const respuesta = await page.request.post("/api/publicaciones/productor", {
    data: {
      productorId, ...ids,
      calibreId: c.calibres[0].id, paisId: c.paises[0].id,
      latitud: -34.9, longitud: -56.16,
      departamento: "Montevideo", nombreLugar: "Ubicación E2E BP-02",
      disponibilidad: true, precio: "150", cantidadUnidades: 10, fotografia: "",
    },
  });
  expect(respuesta.status(), `No se creó la publicación de prueba: ${await respuesta.text()}`).toBe(201);
}

async function eliminarDesdeListado(page: Page, username: string) {
  await abrirGestion(page);
  const fila = await filaProductor(page, username);
  await fila.getByTitle("Eliminar usuario").click();
  const modal = page.getByRole("dialog", { name: "¿Eliminar usuario?" });
  await expect(modal).toContainText(`@${username}`);
  await modal.getByRole("button", { name: "Eliminar", exact: true }).click();
  await expect(page.getByText(`El usuario ${username} fue eliminado correctamente.`)).toBeVisible();
  await expect(fila).toHaveCount(0);
}

// Seguridad: leer rutas de administración sin sesión no debe ser posible.
test("BP-02: sin sesión no se accede al alta, listado ni perfiles administrativos", async ({ page }) => {
  for (const ruta of [
    "/alta-usuario?rol=productor",
    "/administracion",
    "/gestion-productores/999999",
    "/gestion-productores/999999/editar",
  ]) {
    await page.goto(ruta);
    await expect(page).toHaveURL(/\/iniciar-sesion(?:\?.*)?$/);
  }
});

test("BP-02.1 a 02.4: alta, consulta, modificación, permisos y baja del mismo Productor", async ({ page, browser }, info) => {
  test.setTimeout(240_000);
  const sufijo = randomUUID().slice(0, 8);
  const username = `e2e_bp02_${sufijo}`;
  const nombre = `Productor E2E ${sufijo}`;
  const nombreModificado = `Productor Actualizado ${sufijo}`;
  let productorId = 0;
  let creado = false;
  let eliminado = false;
  let contextoProductor: BrowserContext | undefined;
  let segundaPestana: Page | undefined;

  await accederComoAdmin(page);
  try {
    await test.step("BP-02.1: validaciones del formulario (matriz: campos y datos inválidos)", async () => {
      await abrirAltaProductor(page);
      await expect(page.locator("#nombreUsuario")).toBeVisible();
      await expect(page.locator("#nombre")).toBeVisible();
      await expect(page.locator("#numero")).toBeVisible();
      await completarAlta(page, username, nombre);

      // La confirmación distinta debe rechazarse, sin crear el usuario.
      await page.locator("#confirmacionContraseña").fill("OtraClave123!");
      await page.getByRole("button", { name: "Registrar usuario" }).click();
      await expect(page.getByText("Las contraseñas no coinciden.")).toBeVisible();
      await page.locator("#confirmacionContraseña").fill(CLAVE);

      // Número inválido: debe informar el error.
      await page.locator("#numero").fill("123");
      await page.getByRole("button", { name: "Registrar usuario" }).click();
      await expect(page.getByText("El teléfono no es válido.")).toBeVisible();
      await page.locator("#numero").fill("99123456");
      await evidencia(page, info, "BP-02.1-validaciones");
    });

    await test.step("BP-02.1: alta exitosa y opción de precarga", async () => {
      await page.getByRole("button", { name: "Registrar usuario" }).click();
      await expect(page.getByRole("heading", { name: "Productor creado satisfactoriamente" })).toBeVisible();
      creado = true;
      const precargar = page.getByRole("link", { name: "Precargar productos" });
      const href = await precargar.getAttribute("href");
      expect(href).toMatch(/^\/gestion-productores\/\d+$/);
      productorId = Number(href!.split("/").pop());
      await evidencia(page, info, "BP-02.1-alta-exitosa");
      await precargar.click();
    });

    await test.step("BP-02.2: consulta del Productor desde el listado y estado sin productos", async () => {
      await expect(page).toHaveURL(new RegExp(`/gestion-productores/${productorId}$`));
      await expect(page.getByRole("heading", { name: nombre, exact: true })).toBeVisible();
      await expect(page.getByText("El productor no tiene publicaciones.")).toBeVisible();
      await expect(page.getByRole("link", { name: "Editar productor" })).toBeVisible();
      await evidencia(page, info, "BP-02.2-perfil-sin-productos");

      await page.getByRole("link", { name: /Volver al listado/ }).click();
      await expect(page.getByRole("heading", { name: "Gestión de Usuarios" })).toBeVisible();
      const fila = await filaProductor(page, username);
      await fila.click();
      await expect(page).toHaveURL(new RegExp(`/gestion-productores/${productorId}$`));
      await expect(page.getByRole("heading", { name: nombre, exact: true })).toBeVisible();
    });

    await test.step("BP-02.4: cancelar, validar y persistir modificación", async () => {
      await page.getByRole("link", { name: "Editar productor" }).click();
      await expect(page.getByRole("heading", { name: "Modificar productor" })).toBeVisible();
      const nombreCampo = page.getByRole("textbox", { name: "Nombre", exact: true });
      const telefono = page.getByRole("textbox", { name: "WhatsApp" });
      await expect(nombreCampo).toHaveValue(nombre);
      await expect(telefono).toHaveValue("99123456");

      await nombreCampo.fill("Cambio que se cancela");
      await page.getByRole("button", { name: "Cancelar", exact: true }).click();
      await expect(page.getByRole("heading", { name: nombre, exact: true })).toBeVisible();
      await page.getByRole("link", { name: "Editar productor" }).click();

      await page.getByRole("textbox", { name: "WhatsApp" }).fill("123");
      await page.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText("El teléfono no es válido.");
      await page.getByRole("textbox", { name: "WhatsApp" }).fill("99234567");

      await page.getByRole("textbox", { name: "Nombre", exact: true }).fill("");
      await page.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText("El nombre es obligatorio.");
      await page.getByRole("textbox", { name: "Nombre", exact: true }).fill(nombreModificado);

      await page.getByLabel("Nueva contraseña").fill(CLAVE);
      await page.getByLabel("Confirmar contraseña").fill("OtraClave123!");
      await page.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText("Las contraseñas no coinciden.");
      // No cambiar realmente la contraseña: la necesitamos para comprobar la sesión activa.
      await page.getByLabel("Nueva contraseña").fill("");
      await page.getByLabel("Confirmar contraseña").fill("");

      await page.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(page).toHaveURL(new RegExp(`/gestion-productores/${productorId}$`), { timeout: 30_000 });
      await page.reload();
      await expect(page.getByRole("heading", { name: nombreModificado, exact: true })).toBeVisible();
      await expect(page.getByText("+59899234567", { exact: false })).toBeVisible();
      await evidencia(page, info, "BP-02.4-modificacion-persistida");
    });

    await test.step("BP-02.3: acceso denegado para Productor, con sesión activa", async () => {
      contextoProductor = await browser.newContext({ baseURL: new URL(page.url()).origin });
      const pantallaProductor = await contextoProductor.newPage();
      await iniciarSesionProductor(pantallaProductor, { usuario: username, contrasena: CLAVE });
      await pantallaProductor.goto(`/gestion-productores/${productorId}`);
      await expect(pantallaProductor).toHaveURL(/\/inicio$/);
      await pantallaProductor.goto(`/gestion-productores/${productorId}/editar`);
      await expect(pantallaProductor).toHaveURL(/\/inicio$/);
      await pantallaProductor.goto("/administracion");
      await expect(pantallaProductor).toHaveURL(/\/inicio$/);
      await evidencia(pantallaProductor, info, "EV-CP-02.3-06-sin-permisos-de-administrador");
      await pantallaProductor.goto("/mi-mercado/productor");
      await expect(pantallaProductor).toHaveURL(/\/mi-mercado\/productor$/);
    });

    await test.step("BP-02.3: preparar una publicación propia y comprobar que figura en el perfil", async () => {
      await crearPublicacionDePrueba(page, productorId);
      await page.goto(`/gestion-productores/${productorId}`);
      await expect(page.getByRole("heading", { name: "Publicaciones (1)" })).toBeVisible();
      await evidencia(page, info, "EV-CP-02.3-02-productor-con-publicacion-antes");
    });

    await test.step("CP-02.3-04/05: confirmación y cancelación (advertencia pendiente)", async () => {
      await abrirGestion(page);
      const fila = await filaProductor(page, username);
      await fila.getByTitle("Eliminar usuario").click();
      const modal = page.getByRole("dialog", { name: "¿Eliminar usuario?" });
      await expect(modal).toContainText(`@${username}`);
      // La matriz pide advertencia de irreversibilidad, pero el popup actual NO la muestra.
      // Este paso prueba la confirmación; el texto faltante debe registrarse como defecto.
      await evidencia(page, info, "EV-CP-02.3-04-popup-confirmacion");
      await modal.getByRole("button", { name: "Cancelar" }).click();
      await expect(modal).not.toBeVisible();
      await expect(fila).toBeVisible();
      await evidencia(page, info, "EV-CP-02.3-05-cancelacion");
    });

    await test.step("CP-02.3-01/02/03: baja exitosa y segundo intento desde pestaña desactualizada", async () => {
      segundaPestana = await page.context().newPage();
      await abrirGestion(segundaPestana);
      const filaSegunda = await filaProductor(segundaPestana, username);
      await filaSegunda.getByTitle("Eliminar usuario").click();
      const dialogoSegunda = segundaPestana.getByRole("dialog", { name: "¿Eliminar usuario?" });
      await expect(dialogoSegunda).toContainText(`@${username}`);

      const filaPrimera = await filaProductor(page, username);
      await filaPrimera.getByTitle("Eliminar usuario").click();
      const dialogoPrimera = page.getByRole("dialog", { name: "¿Eliminar usuario?" });
      await dialogoPrimera.getByRole("button", { name: "Eliminar", exact: true }).click();
      await expect(page.getByText(`El usuario ${username} fue eliminado correctamente.`)).toBeVisible();
      eliminado = true;
      await evidencia(page, info, "EV-CP-02.3-01-baja-exitosa");
      await expect(filaPrimera).toHaveCount(0);

      await dialogoSegunda.getByRole("button", { name: "Eliminar", exact: true }).click();
      await expect(segundaPestana.getByText("El productor seleccionado ya no existe.")).toBeVisible();
      await evidencia(segundaPestana, info, "EV-CP-02.3-03-productor-ya-eliminado");
      await segundaPestana.close();
      segundaPestana = undefined;

      await page.goto(`/gestion-productores/${productorId}`);
      await expect(page.getByText("404", { exact: true })).toBeVisible();
      await evidencia(page, info, "EV-CP-02.3-02-perfil-eliminado");
    });

    await test.step("CP-02.3-07: la sesión del Productor eliminado deja de funcionar", async () => {
      const pantallaProductor = contextoProductor!.pages()[0];
      await pantallaProductor.goto("/mi-mercado/productor");
      await expect(pantallaProductor).toHaveURL(/\/iniciar-sesion(?:\?.*)?$/);
      await evidencia(pantallaProductor, info, "EV-CP-02.3-07-sesion-invalida");
    });
  } finally {
    if (segundaPestana && !segundaPestana.isClosed()) await segundaPestana.close();
    if (contextoProductor) await contextoProductor.close();
    if (creado && !eliminado) {
      // Limpieza: no dejar productores E2E si se interrumpe una aserción.
      try {
        await eliminarDesdeListado(page, username);
      } catch (error) {
        console.warn(`Limpieza pendiente para ${username}:`, error);
      }
    }
  }
});
