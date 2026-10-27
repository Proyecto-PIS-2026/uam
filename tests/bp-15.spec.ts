import { expect, test, type Page } from "@playwright/test";
import type { Credenciales } from "./autenticacion";

const ruta = "/mi-mercado/productor";
const api = "/api/publicaciones/productor";

const usuario = "productor_tacuarembo_frut";
const panel = (page: Page, nombre: string) => page.getByRole("dialog", { name: nombre, exact: true });
const alta = (page: Page) => panel(page, "Nueva publicación de Productor");
const detalle = (page: Page) => panel(page, "Consulta de publicación");
const edicion = (page: Page) => panel(page, "Editar publicación");
const tarjetas = (page: Page) => page.getByRole("button", { name: /^Ver detalle de / });
const tarjeta = (page: Page, precio: string) => page.getByRole("button", { name: "Ver detalle de Uchuva", exact: true })
  .filter({ has: page.getByText(`$${precio}`, { exact: true }) });
const confirmacion = (page: Page) => page.getByRole("alertdialog", { name: "Eliminar publicación", exact: true });

async function iniciarSesionProductor(page: Page, credenciales: Credenciales) {
  await page.goto("/iniciar-sesion");
  await page.getByLabel("Correo electrónico o nombre de usuario").fill(credenciales.usuario);
  await page.getByLabel("Contraseña", { exact: true }).fill(credenciales.contrasena);
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await expect(page).toHaveURL(/\/mi-mercado\/productor$/, { timeout: 30_000 });
  
  await expect(page.getByRole("heading", { name: "Mi Mercado", exact: true, level: 1 })).toBeVisible();
}

async function catalogo(page: Page) {
  return (await tarjetas(page).locator('span[class*="contenido"]').allTextContents()).sort();
}

async function respuestaOperacion(page: Page, metodo: string, accion: () => Promise<unknown>) {
  const [respuesta] = await Promise.all([
    page.waitForResponse((r) => {
      const pathname = new URL(r.url()).pathname;
      return r.request().method() === metodo && (metodo === "POST"
        ? pathname === api
        : /^\/api\/publicaciones\/productor\/\d+$/.test(pathname));
    }),
    accion(),
  ]);
  return respuesta;
}

async function abrirEdicion(page: Page) {
  const respuesta = await respuestaOperacion(page, "GET", () => detalle(page).getByRole("button", { name: "Editar", exact: true }).click());
  expect(respuesta.status()).toBe(200);
  expect(new URL(respuesta.url()).pathname).toMatch(/^\/api\/publicaciones\/productor\/\d+$/);
  await expect(edicion(page)).toBeVisible();
  return respuesta.url();
}

async function eliminar(page: Page) {
  await detalle(page).getByRole("button", { name: "Eliminar", exact: true }).click();
  const respuesta = await respuestaOperacion(page, "DELETE", () => confirmacion(page).getByRole("button", { name: "Sí, eliminar", exact: true }).click());
  expect(respuesta.status()).toBe(200);
  await expect(confirmacion(page)).not.toBeVisible();
  await expect(detalle(page)).not.toBeVisible();
}

test.describe("BP-15: ABM de Productos de un Productor", () => {
  test.describe.configure({ mode: "default" });
  test("CA-1: requiere autenticación para gestionar publicaciones", async ({ page }) => {
    await page.goto(ruta);
    await expect(page).toHaveURL(/\/iniciar-sesion(?:\?|$)/);
    for (const [method, url] of [
      ["GET", api], ["POST", api], ["GET", `${api}/1`],
      ["PATCH", `${api}/1`], ["DELETE", `${api}/1`],
    ]) {
      expect((await page.request.fetch(url, { method, data: {} })).status(), `${method} ${url}`).toBe(401);
    }
  });

  for (const [dispositivo, viewport] of [
    ["computadora", { width: 1280, height: 900 }],
    ["celular", { width: 390, height: 844 }],
  ] as const) {
    test(`CA-2 a CA-9: ciclo completo de gestión desde ${dispositivo}`, async ({ page, browser }) => {
      test.setTimeout(240_000);
      await page.setViewportSize(viewport);
      await iniciarSesionProductor(page, { usuario, contrasena: `${usuario}123` });
      const iniciales = await catalogo(page);
      const precio = String(100000 + Math.floor(Math.random() * 800000));
      const nuevoPrecio = String(Number(precio) + 1);
      let precioActual = precio;
      let urlPublicacion = "";
      let requiereLimpieza = false;

      try {
        await test.step("CA-2: cancelar el alta conserva el catálogo", async () => {
          await page.getByRole("button", { name: "Nueva publicación", exact: true }).click();
          await alta(page).getByRole("combobox", { name: "Especie", exact: true }).click();
          await page.getByRole("option", { name: "Uchuva", exact: true }).click();
          await alta(page).getByRole("button", { name: "Cancelar", exact: true }).click();
          await page.reload();
          await expect.poll(() => catalogo(page)).toEqual(iniciales);
        });

        await test.step("CA-2 y CA-8: informa datos inválidos y permite corregirlos sin guardar", async () => {
          await page.getByRole("button", { name: "Nueva publicación", exact: true }).click();
          await alta(page).getByRole("combobox", { name: "Especie", exact: true }).click();
          await page.getByRole("option", { name: "Uchuva", exact: true }).click();
          await alta(page).getByRole("textbox", { name: "Precio en pesos", exact: true }).fill(precio);
          await alta(page).getByRole("textbox", { name: "Cantidad (kg)", exact: true }).fill("2147483648");
          const respuesta = await respuestaOperacion(page, "POST", () => alta(page).getByRole("button", { name: "Confirmar", exact: true }).click());
          expect(respuesta.status()).toBe(400);
          await expect(alta(page).getByRole("alert")).toContainText("La cantidad de unidades debe ser un número entero entre 0 y 2147483647.");
          await expect(alta(page).getByRole("textbox", { name: "Precio en pesos", exact: true })).toHaveValue(precio);
          const consulta = await page.context().newPage();
          try {
            await consulta.goto(ruta);
            await expect.poll(() => catalogo(consulta)).toEqual(iniciales);
          } finally { await consulta.close(); }
          await alta(page).getByRole("textbox", { name: "Cantidad (kg)", exact: true }).fill("12");
          const creada = await respuestaOperacion(page, "POST", () => alta(page).getByRole("button", { name: "Confirmar", exact: true }).click());
          expect(creada.status(), await creada.text()).toBe(201);
          requiereLimpieza = true;
          await expect(alta(page)).not.toBeVisible();
        });

        await test.step("CA-3 y CA-7: consulta los datos del producto persistido", async () => {
          await page.reload();
          await expect(tarjetas(page)).toHaveCount(iniciales.length + 1);
          await tarjeta(page, precio).click();
          await expect(detalle(page).getByRole("combobox", { name: "Especie", exact: true })).toHaveText("Uchuva");
          await expect(detalle(page).getByRole("textbox", { name: "Precio en pesos", exact: true })).toHaveValue(precio);
          await expect(detalle(page).getByRole("textbox", { name: /^Unidades/ })).toHaveValue("12");
          await expect(detalle(page).getByRole("textbox", { name: "Precio en pesos", exact: true })).not.toBeEditable();
        });

        await test.step("CA-4 y CA-7: modifica y consulta el cambio después de recargar", async () => {
          urlPublicacion = await abrirEdicion(page);
          await edicion(page).getByRole("textbox", { name: "Precio en pesos", exact: true }).fill(nuevoPrecio);
          const guardada = await respuestaOperacion(page, "PATCH", () => edicion(page).getByRole("button", { name: "Confirmar", exact: true }).click());
          expect(guardada.status()).toBe(200);
          precioActual = nuevoPrecio;
          await expect(edicion(page)).not.toBeVisible();
          await page.reload();
          await tarjeta(page, nuevoPrecio).click();
          await expect(detalle(page).getByRole("textbox", { name: "Precio en pesos", exact: true })).toHaveValue(nuevoPrecio);
        });

        await test.step("CA-6: otro productor no puede consultar, modificar ni eliminar la publicación", async () => {
          const contexto = await browser.newContext({ baseURL: new URL(urlPublicacion).origin });
          try {
            const ajeno = await contexto.newPage();
            const otro = "productor_norte_salto";
            await iniciarSesionProductor(ajeno, { usuario: otro, contrasena: `${otro}123` });
            await expect(tarjeta(ajeno, nuevoPrecio)).toHaveCount(0);
            expect((await ajeno.request.get(urlPublicacion)).status()).toBe(403);
            const catalogos = await (await page.request.get(api)).json() as { especies: { id: number; nombre: string }[] };
            const cambios = {
              especieId: catalogos.especies.find((e) => e.nombre === "Uchuva")!.id,
              variedadId: null, presentacionId: null, categoriaId: null,
              calibreId: null, paisId: null, precio: "999", ubicaciones: [],
            };
            expect((await ajeno.request.patch(urlPublicacion, { multipart: { cambios: JSON.stringify(cambios) } })).status()).toBe(403);
            expect((await ajeno.request.delete(urlPublicacion)).status()).toBe(403);
          } finally { await contexto.close(); }
          await page.reload();
          await tarjeta(page, nuevoPrecio).click();
          await expect(detalle(page).getByRole("textbox", { name: "Precio en pesos", exact: true })).toHaveValue(nuevoPrecio);
        });

        await test.step("CA-5 y CA-7: cancelar conserva el producto y confirmar lo elimina", async () => {
          await detalle(page).getByRole("button", { name: "Eliminar", exact: true }).click();
          await confirmacion(page).getByRole("button", { name: "Cancelar", exact: true }).click();
          await page.reload();
          await tarjeta(page, nuevoPrecio).click();
          await eliminar(page);
          requiereLimpieza = false;
          await page.reload();
          await expect(tarjeta(page, nuevoPrecio)).toHaveCount(0);
          await expect.poll(() => catalogo(page)).toEqual(iniciales);
          expect((await page.request.get(urlPublicacion)).status()).toBe(404);
        });
      } finally {
        if (requiereLimpieza) {
          await page.goto(ruta);
          await expect(page.getByRole("heading", { name: "Mi Mercado", exact: true })).toBeVisible();
          for (const valor of new Set([precio, precioActual, nuevoPrecio])) {
            if (await tarjeta(page, valor).count()) {
              await tarjeta(page, valor).click();
              await eliminar(page);
            }
          }
        }
      }
    });
  }
});
