import { expect, test, type Page } from "@playwright/test";
import { iniciarSesionProductor } from "./autenticacion";
import { crearOfertasProductoresDemo } from "../src/infraestructura/persistencia/prisma/ofertas-productores-demo";
import catalogo from "../src/modulos/informacion-uam/precios-referencia/consulta-referencia.json" with { type: "json" };

const usuario = "productor_norte_salto";
const propias = crearOfertasProductoresDemo(catalogo).filter((oferta) => oferta.producerUsername === usuario);
const ruta = "/mi-mercado/productor";
const presentaciones: Record<string, string> = {
  KG: "Kilogramo", DOC: "Docena", CAB: "Cabeza", Unidad: "Unidad",
};
const tarjetas = (page: Page) => page.getByRole("button", { name: /^Ver detalle de / });
const nombre = (oferta: typeof propias[number]) => oferta.variety === "-"
  ? oferta.speciesName : `${oferta.speciesName} · ${oferta.variety}`;

test.describe("BP-15.2: consulta de productos propios del productor", () => {
  test.beforeEach(async ({ page }) => {
    test.slow();
    await iniciarSesionProductor(page, { usuario, contrasena: `${usuario}123` });
    await page.getByRole("link", { name: "Mi mercado", exact: true }).click();
    await expect(page).toHaveURL(ruta);
    await expect(page.getByRole("heading", { name: "Mi Mercado", exact: true })).toBeVisible();
    await expect(tarjetas(page)).toHaveCount(propias.length);
  });

  test("CP-15.2-01 y CA-7: lista todas las publicaciones propias y ninguna ajena", async ({ page }) => {
    // Compara el catálogo completo, incluyendo multiplicidad, contra la seed.
    const esperadas = propias.map((oferta) => `Ver detalle de ${nombre(oferta)}`).sort();
    await expect.poll(async () => Promise.all((await tarjetas(page).all())
      .map((tarjeta) => tarjeta.getAttribute("aria-label"))).then((nombres) => nombres.sort()))
      .toEqual(esperadas);
    await expect(page.getByRole("main").locator("header").getByText(`${propias.length} publicaciones`, { exact: true })).toBeVisible();
    // Tomate pertenece a otro productor de la seed.
    await page.getByRole("searchbox", { name: "Buscar publicaciones" }).fill("Tomate");
    await expect(tarjetas(page)).toHaveCount(0);
    await expect(page.getByText("No hay publicaciones que coincidan con la búsqueda.")).toBeVisible();
  });

  test("CP-15.2-03: muestra el botón habilitado para agregar productos", async ({ page }) => {
    const agregar = page.getByRole("button", { name: "Nueva publicación", exact: true });
    await expect(agregar).toBeVisible();
    await expect(agregar).toBeEnabled();
  });

  test("CP-15.2-04 y 06: filtra por especie y recupera el listado al limpiar", async ({ page }) => {
    await page.getByRole("combobox", { name: "Especie", exact: true }).click();
    await page.getByRole("option", { name: "Mandarina", exact: true }).click();
    const coincidencias = propias.filter((oferta) => oferta.speciesName === "Mandarina");
    await expect(tarjetas(page)).toHaveCount(coincidencias.length);
    for (const tarjeta of await tarjetas(page).all()) {
      await expect(tarjeta).toHaveAttribute("aria-label", /^Ver detalle de Mandarina/);
    }
    await page.getByRole("button", { name: "Limpiar filtros" }).click();
    await expect(page.getByRole("combobox", { name: "Especie", exact: true })).toHaveText("Todas");
    await expect(tarjetas(page)).toHaveCount(propias.length);
  });

  test("CP-15.2-05 y 06: búsqueda sin coincidencias y limpieza", async ({ page }) => {
    const buscar = page.getByRole("searchbox", { name: "Buscar publicaciones" });
    await buscar.fill("producto-inexistente-bp15-2");
    await expect(tarjetas(page)).toHaveCount(0);
    await expect(page.getByText("No hay publicaciones que coincidan con la búsqueda.")).toBeVisible();
    await page.getByRole("button", { name: "Limpiar filtros" }).click();
    await expect(buscar).toHaveValue("");
    await expect(tarjetas(page)).toHaveCount(propias.length);
  });

  for (const pantalla of [
    { nombre: "escritorio", viewport: { width: 1280, height: 900 } },
    { nombre: "móvil", viewport: { width: 390, height: 844 } },
  ]) {
    test(`CP-15.2-07, 08 y 09: detalle, ubicaciones y acciones (${pantalla.nombre})`, async ({ page }) => {
      await page.setViewportSize(pantalla.viewport);
      // Casos con ubicaciones, sin ubicaciones y sin precio.
      for (const indice of [1, 0, 3]) {
        const oferta = propias[indice];
        const presentacion = presentaciones[oferta.measureUnit];
        const tarjeta = tarjetas(page).filter({ has: page.getByText(nombre(oferta), { exact: true }) });
        const textoTarjeta = await tarjeta.innerText();
        await tarjeta.click();
        const detalle = page.getByRole("dialog", { name: "Detalle de publicación", exact: true });
        await expect(detalle).toBeVisible();
        await expect(detalle.getByText(oferta.speciesName, { exact: true })).toBeVisible();
        if (oferta.variety !== "-") await expect(detalle.getByText(oferta.variety, { exact: true })).toBeVisible();
        await expect(detalle.getByText(oferta.price === null ? "Consultar precio" : `$${oferta.price}`, { exact: true })).toBeVisible();
        for (const [campo, valor] of [
          ["Presentación", presentacion], ["Categoría", oferta.category],
          [`Unidades (${presentacion})`, String(oferta.quantity)], ["País", oferta.country],
        ]) {
          await expect(detalle.locator("dl > div").filter({ has: page.getByText(campo, { exact: true }) }).locator("dd")).toHaveText(valor);
        }
        const calibre = detalle.locator("dl > div").filter({ has: page.getByText("Calibre", { exact: true }) }).locator("dd");
        await expect(calibre).toHaveText(/\S/);
        expect(textoTarjeta).toContain(await calibre.innerText());
        const puntos = detalle.getByRole("region", { name: "Puntos de retiro" });
        await expect(puntos.getByRole("link")).toHaveCount(oferta.cantidadUbicaciones);
        for (const enlace of await puntos.getByRole("link").all()) {
          await expect(enlace).toHaveAttribute("href", /^https:\/\/www\.google\.com\/maps\?q=/);
          await expect(enlace).toHaveAttribute("target", "_blank");
          await expect(enlace).toHaveAttribute("rel", /noopener/);
        }
        if (!oferta.cantidadUbicaciones) await expect(puntos.getByText("No hay puntos de retiro informados.")).toBeVisible();
        for (const accion of ["Editar", "Eliminar"]) {
          await expect(detalle.getByRole("button", { name: accion, exact: true })).toBeVisible();
          await expect(detalle.getByRole("button", { name: accion, exact: true })).toBeEnabled();
        }
        await detalle.getByRole("button", { name: "Cerrar consulta" }).click();
        await expect(detalle).not.toBeVisible();
        await expect(page).toHaveURL(ruta);
        await expect(tarjetas(page)).toHaveCount(propias.length);
      }
    });
  }
});

test("BP-15.2 adicional: exige iniciar sesión para consultar productos propios", async ({ page }) => {
  await page.goto(ruta);
  await expect(page).toHaveURL(/\/iniciar-sesion$/);
  await expect(page.getByRole("button", { name: "Iniciar sesión", exact: true })).toBeVisible();
});
