import { expect, test as base, type Page } from "@playwright/test";
import { iniciarSesionProductor } from "./autenticacion";

const ruta = "/mi-mercado/productor";
const usuario = "productor_canelones_verde";
const detalle = (page: Page) => page.getByRole("dialog", { name: "Consulta de publicación", exact: true });
const confirmacion = (page: Page) => page.getByRole("alertdialog", { name: "Eliminar publicación", exact: true });
const tarjetas = (page: Page) => page.getByRole("button", { name: /^Ver detalle de / });
const tarjetaPrueba = (page: Page, precio: string) => page.getByRole("button", { name: "Ver detalle de Uchuva", exact: true })
  .filter({ has: page.getByText(`$${precio}`, { exact: true }) });

async function solicitarBaja(page: Page, precio: string) {
  await tarjetaPrueba(page, precio).click();
  await expect(detalle(page)).toBeVisible();
  await detalle(page).getByRole("button", { name: "Eliminar", exact: true }).click();
  await expect(confirmacion(page)).toBeVisible();
}

async function confirmarBaja(page: Page) {
  const [respuesta] = await Promise.all([
    page.waitForResponse((respuesta) => respuesta.request().method() === "DELETE"
      && /\/api\/publicaciones\/productor\/\d+$/.test(new URL(respuesta.url()).pathname)),
    confirmacion(page).getByRole("button", { name: "Sí, eliminar", exact: true }).click(),
  ]);
  expect(respuesta.status(), "La baja debe completarse correctamente").toBe(200);
  await expect(confirmacion(page)).not.toBeVisible();
  await expect(detalle(page)).not.toBeVisible();
  return respuesta.url();
}

type Opcion = { id: number; nombre: string; especieId?: number | null; variedadId?: number };
type Catalogos = Record<"especies" | "variedades" | "presentaciones" | "categorias" | "calibres" | "paises", Opcion[]>;

// La API prepara una publicación temporal; las acciones de baja se prueban por la interfaz.
// Se usa otro productor para no alterar los nueve productos requeridos por BP-15.2/15.3.
const test = base.extend<{ publicacionPrueba: { precio: string; cantidadInicial: number } }>({
  publicacionPrueba: async ({ page }, ejecutarPrueba) => {
    await iniciarSesionProductor(page, { usuario, contrasena: `${usuario}123` });
    await page.goto(ruta);
    await expect(tarjetas(page).first()).toBeVisible();
    const cantidadInicial = await tarjetas(page).count();
    const respuestaCatalogos = await page.request.get("/api/publicaciones/productor");
    expect(respuestaCatalogos.ok()).toBe(true);
    const catalogos = await respuestaCatalogos.json() as Catalogos;
    const especie = catalogos.especies.find((opcion) => opcion.nombre === "Uchuva")!;
    expect(especie, "La seed debe incluir Uchuva").toBeDefined();
    const variedad = catalogos.variedades.find((opcion) => opcion.especieId === especie.id && opcion.nombre === "-")!;
    expect(variedad).toBeDefined();
    const presentacion = catalogos.presentaciones.find((opcion) => opcion.variedadId === variedad.id)!;
    const categoria = catalogos.categorias.find((opcion) => opcion.nombre === "-"
      && (opcion.especieId === especie.id || opcion.especieId === null))!;
    expect(presentacion).toBeDefined();
    expect(categoria).toBeDefined();
    const precio = String(100000 + Math.floor(Math.random() * 900000));
    const creada = await page.request.post("/api/publicaciones/productor", { data: {
      especieId: especie.id, variedadId: variedad.id, presentacionId: presentacion.id,
      categoriaId: categoria.id,
      calibreId: catalogos.calibres.find((opcion) => opcion.nombre === "GRANDE")!.id,
      paisId: catalogos.paises.find((opcion) => opcion.nombre === "URUGUAY")!.id,
      precio, cantidadUnidades: 10, disponibilidad: true,
      latitud: -34.8, longitud: -56.2, departamento: "Montevideo", nombreLugar: "Retiro E2E BP-15.4",
    } });
    expect(creada.status(), await creada.text()).toBe(201);
    try {
      await page.reload();
      await expect(tarjetaPrueba(page, precio)).toBeVisible();
      await ejecutarPrueba({ precio, cantidadInicial });
    } finally {
      // También limpia la publicación si falla un caso de cancelación o confirmación.
      await page.goto(ruta);
      await expect(page.getByRole("heading", { name: "Mi Mercado", exact: true })).toBeVisible();
      await expect(tarjetas(page).first()).toBeVisible();
      if (await tarjetaPrueba(page, precio).count()) {
        await solicitarBaja(page, precio);
        await confirmarBaja(page);
        await expect(tarjetaPrueba(page, precio)).toHaveCount(0);
      }
    }
  },
});

test.describe("BP-15.4: baja de publicaciones del productor", () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  test.describe.configure({ mode: "default" });
  test.setTimeout(90_000);

  test("CP-15.4-03 y CP-15.4-06: solicita confirmación y conserva el producto mientras no se confirme", async ({ page, publicacionPrueba }) => {
    const { precio } = publicacionPrueba;
    const bajas: string[] = [];
    page.on("request", (solicitud) => {
      if (solicitud.method() === "DELETE" && new URL(solicitud.url()).pathname.startsWith("/api/publicaciones/productor/")) bajas.push(solicitud.url());
    });
    await solicitarBaja(page, precio);
    await expect(confirmacion(page)).toContainText("¿Querés eliminar la publicación de Uchuva?");
    await expect(confirmacion(page).getByRole("button", { name: "Cancelar", exact: true })).toBeEnabled();
    await expect(confirmacion(page).getByRole("button", { name: "Sí, eliminar", exact: true })).toBeEnabled();
    // Recargar con la confirmación pendiente permite consultar el catálogo persistido.
    await page.reload();
    await expect(tarjetaPrueba(page, precio)).toBeVisible();
    await expect(tarjetas(page)).toHaveCount(publicacionPrueba.cantidadInicial + 1);
    expect(bajas).toEqual([]);
  });

  test("CP-15.4-04: cancelar la baja conserva la publicación", async ({ page, publicacionPrueba }) => {
    const { precio } = publicacionPrueba;
    await solicitarBaja(page, precio);
    await confirmacion(page).getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(confirmacion(page)).not.toBeVisible();
    await expect(detalle(page)).toBeVisible();
    await detalle(page).getByRole("button", { name: "Cerrar consulta", exact: true }).click();
    await expect(tarjetaPrueba(page, precio)).toBeVisible();
    await page.reload();
    await expect(tarjetaPrueba(page, precio)).toBeVisible();
    await expect(tarjetas(page)).toHaveCount(publicacionPrueba.cantidadInicial + 1);
  });

  test("CP-15.4-01 y CP-15.4-05: confirmar elimina la publicación y muestra el mensaje de éxito", async ({ page, publicacionPrueba }) => {
    const { precio, cantidadInicial } = publicacionPrueba;
    await solicitarBaja(page, precio);
    const urlEliminada = await confirmarBaja(page);
    await expect(page.getByRole("status").filter({ hasText: "Publicación eliminada correctamente." })).toBeVisible();
    await expect(tarjetaPrueba(page, precio)).toHaveCount(0);
    await expect(tarjetas(page)).toHaveCount(cantidadInicial);
    await page.reload();
    await expect(tarjetas(page)).toHaveCount(cantidadInicial);
    await expect(tarjetaPrueba(page, precio)).toHaveCount(0);
    // Tampoco se puede volver a consultar la publicación eliminada por su identificador.
    const consulta = await page.request.get(urlEliminada);
    expect(consulta.status()).toBe(404);
  });
});
