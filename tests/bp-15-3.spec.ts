import { expect, test, type Page } from "@playwright/test";
import { iniciarSesionProductor } from "./autenticacion";

// Requiere la seed y la aplicación iniciada, igual que BP-15.2.
// CP-15.3-02 (administrador), 03 (cámara) y 04 (foto web) quedan fuera de esta selección.
const usuario = "productor_norte_salto";
const ruta = "/mi-mercado/productor";
const detalle = (page: Page) => page.getByRole("dialog", { name: "Detalle de publicación", exact: true });
const edicion = (page: Page) => page.getByRole("dialog", { name: "Editar publicación de Productor", exact: true });
const tarjetas = (page: Page) => page.getByRole("button", { name: /^Ver detalle de / });
const tarjeta = (page: Page, producto: string) => page.getByRole("button", { name: `Ver detalle de ${producto}`, exact: true });

async function abrirDetalle(page: Page, producto: string) {
  await tarjeta(page, producto).click();
  await expect(detalle(page)).toBeVisible();
}

async function editar(page: Page) {
  const carga = page.waitForResponse((respuesta) =>
    /\/api\/publicaciones\/productor\/\d+$/.test(new URL(respuesta.url()).pathname)
    && respuesta.request().method() === "GET", { timeout: 30_000 });
  await detalle(page).getByRole("button", { name: "Editar", exact: true }).click();
  expect((await carga).ok(), "El servidor debe devolver los datos de edición").toBe(true);
  await expect(edicion(page)).toBeVisible({ timeout: 30_000 });
}

async function guardar(page: Page) {
  const respuesta = page.waitForResponse((respuesta) =>
    /\/api\/publicaciones\/productor\/\d+$/.test(new URL(respuesta.url()).pathname)
    && respuesta.request().method() === "PATCH");
  await edicion(page).getByRole("button", { name: "Confirmar", exact: true }).click();
  expect((await respuesta).ok(), "El servidor debe aceptar la modificación").toBe(true);
  await expect(edicion(page)).not.toBeVisible();
  await expect(detalle(page)).toBeVisible();
}

async function listado(page: Page) {
  return Promise.all((await tarjetas(page).all()).map(async (elemento) => ({
    nombre: await elemento.getAttribute("aria-label"),
    // El contenido comercial es independiente de la carga o el reemplazo de la foto.
    texto: await elemento.locator('span[class*="contenido"]').innerText(),
  })));
}

test.describe("BP-15.3: modificación de publicaciones del productor", () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  // Las pruebas guardan y restauran precios del mismo productor.
  test.describe.configure({ mode: "default" });

  test.beforeEach(async ({ page }) => {
    test.slow();
    await iniciarSesionProductor(page, { usuario, contrasena: `${usuario}123` });
    await page.getByRole("link", { name: "Mi mercado", exact: true }).click();
    await expect(page).toHaveURL(ruta);
    await expect(tarjetas(page)).toHaveCount(9);
  });

  test("CP-15.3-01: el productor abre el panel de modificación de su publicación", async ({ page }) => {
    await abrirDetalle(page, "Mandarina · Afourer");
    await editar(page);
    const panel = edicion(page);
    for (const campo of ["Presentación", "Categoría", "Calibre"]) {
      await expect(panel.getByRole("combobox", { name: campo, exact: true })).toBeEnabled();
    }
    await expect(panel.getByRole("textbox", { name: "Precio en pesos", exact: true })).toBeEditable();
    await expect(panel.getByRole("button", { name: "Editar foto", exact: true })).toBeEnabled();
    await expect(panel.locator('input[type="file"][aria-label="Fotografía"]')).toHaveAttribute("accept", "image/png,image/jpeg,image/webp");
    await expect(panel.getByRole("button", { name: "Confirmar", exact: true })).toBeEnabled();
    await panel.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(detalle(page)).toBeVisible();
  });

  test("CP-15.3-05: salir sin guardar conserva la publicación y su fecha", async ({ page }) => {
    await abrirDetalle(page, "Mandarina · Afourer");
    const camposDetalle = detalle(page).locator("dl dt, dl dd");
    const datosIniciales = await camposDetalle.allTextContents();
    const fechaInicial = await detalle(page).locator("time").getAttribute("datetime");
    await editar(page);
    const precio = edicion(page).getByRole("textbox", { name: "Precio en pesos", exact: true });
    const original = await precio.inputValue();
    await precio.fill(String(Number(original) + 17));
    await edicion(page).getByRole("button", { name: "Cerrar edición", exact: true }).click();
    await expect(detalle(page)).toBeVisible();
    await expect(detalle(page).getByText(`$${original}`, { exact: true })).toBeVisible();
    // Recargar comprueba que tampoco hubo cambios persistidos en el servidor.
    await page.reload();
    await abrirDetalle(page, "Mandarina · Afourer");
    await expect(camposDetalle).toHaveText(datosIniciales);
    await expect(detalle(page).locator("time")).toHaveAttribute("datetime", fechaInicial!);
    await editar(page);
    await expect(edicion(page).getByRole("textbox", { name: "Precio en pesos", exact: true })).toHaveValue(original);
  });

  test("CP-15.3-06 y CP-15.3-07: guarda solo la publicación elegida y actualiza su fecha", async ({ page }) => {
    const producto = "Quinoto";
    const iniciales = await listado(page);
    const otras = iniciales.filter((item) => item.nombre !== `Ver detalle de ${producto}`);
    await abrirDetalle(page, producto);
    const fechaInicial = await detalle(page).locator("time").getAttribute("datetime");
    await editar(page);
    const original = await edicion(page).getByRole("textbox", { name: "Precio en pesos", exact: true }).inputValue();
    const nuevo = original === "150" ? "151" : "150";
    let guardarIntentado = false;
    try {
      await edicion(page).getByRole("textbox", { name: "Precio en pesos", exact: true }).fill(nuevo);
      const antes = Date.now();
      guardarIntentado = true;
      await guardar(page);
      const despues = Date.now();
      await expect(detalle(page).getByText(`$${nuevo}`, { exact: true })).toBeVisible();
      const fechaGuardada = await detalle(page).locator("time").getAttribute("datetime");
      expect(fechaGuardada).not.toBe(fechaInicial);
      const instante = Date.parse(fechaGuardada!);
      expect(instante).toBeGreaterThanOrEqual(antes - 5000);
      expect(instante).toBeLessThanOrEqual(despues + 5000);
      const fechaLocal = new Intl.DateTimeFormat("es-UY", {
        day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Montevideo",
      }).format(new Date(instante));
      await expect(detalle(page).locator("time")).toHaveText(fechaLocal);
      await page.reload();
      await expect(tarjetas(page)).toHaveCount(iniciales.length);
      expect((await listado(page)).filter((item) => item.nombre !== `Ver detalle de ${producto}`)).toEqual(otras);
      await expect(tarjeta(page, producto)).toContainText(`$${nuevo}`);
      await abrirDetalle(page, producto);
      await expect(detalle(page).locator("time")).toHaveAttribute("datetime", fechaGuardada!);
      await editar(page);
      await expect(edicion(page).getByRole("textbox", { name: "Precio en pesos", exact: true })).toHaveValue(nuevo);
    } finally {
      if (guardarIntentado) {
        // Restaura el precio incluso si falla una comprobación posterior al guardado.
        // La fecha queda actualizada porque la restauración también es una edición real.
        await page.goto(ruta);
        await abrirDetalle(page, producto);
        await editar(page);
        await edicion(page).getByRole("textbox", { name: "Precio en pesos", exact: true }).fill(original);
        await guardar(page);
        await page.reload();
        await abrirDetalle(page, producto);
        await editar(page);
        await expect(edicion(page).getByRole("textbox", { name: "Precio en pesos", exact: true })).toHaveValue(original);
      }
    }
  });

});
