import { expect, test, type Page } from "@playwright/test";
import { iniciarSesionProductor } from "./autenticacion";
import { crearOfertasProductoresDemo } from "../src/infraestructura/persistencia/prisma/ofertas-productores-demo";
import { cargarConsultaUam } from "../src/infraestructura/persistencia/prisma/catalogo-consulta";

const usuario = "productor_norte_salto";
const propias = crearOfertasProductoresDemo(cargarConsultaUam()).filter((oferta) => oferta.producerUsername === usuario);
const ruta = "/mi-mercado/productor";
const presentaciones: Record<string, string> = {
  KG: "Kilogramo", DOC: "Docena", CAB: "Cabeza", Unidad: "Unidad",
};
const tarjetas = (page: Page) => page.getByRole("button", { name: /^Ver detalle de / });
const nombre = (oferta: typeof propias[number]) => oferta.variety === "-"
  ? oferta.speciesName : `${oferta.speciesName} · ${oferta.variety}`;

test.describe("BP-15.2: consulta de productos propios del productor", () => {
  test.use({ viewport: { width: 1280, height: 900 } });
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
  });

  test("CP-15.2-03: muestra el botón habilitado para agregar productos", async ({ page }) => {
    const agregar = page.getByRole("button", { name: "Nueva publicación", exact: true });
    await expect(agregar).toBeVisible();
    await expect(agregar).toBeEnabled();
  });

  test("CP-15.2-04: filtra por la especie Mandarina", async ({ page }) => {
    await page.getByRole("combobox", { name: "Especie", exact: true }).click();
    await page.getByRole("option", { name: "Mandarina", exact: true }).click();
    const coincidencias = propias.filter((oferta) => oferta.speciesName === "Mandarina");
    await expect(tarjetas(page)).toHaveCount(coincidencias.length);
    for (const tarjeta of await tarjetas(page).all()) {
      await expect(tarjeta).toHaveAttribute("aria-label", /^Ver detalle de Mandarina/);
    }
  });

  test("CP-15.2-05: filtra por precio entre $20 y $30", async ({ page }) => {
    await page.getByRole("textbox", { name: "Precio Mínimo", exact: true }).fill("20");
    await page.getByRole("textbox", { name: "Precio Máximo", exact: true }).fill("30");
    const esperadas = propias.filter((oferta) => oferta.price !== null && oferta.price >= 20 && oferta.price <= 30);
    expect(esperadas).toHaveLength(5);
    await expect(tarjetas(page)).toHaveCount(esperadas.length);
    await expect.poll(async () => Promise.all((await tarjetas(page).all())
      .map((tarjeta) => tarjeta.getAttribute("aria-label"))).then((nombres) => nombres.sort()))
      .toEqual(esperadas.map((oferta) => `Ver detalle de ${nombre(oferta)}`).sort());
    for (const tarjeta of await tarjetas(page).all()) {
      const texto = await tarjeta.innerText();
      const precio = Number(texto.match(/\$(\d+)/)?.[1]);
      expect(precio).toBeGreaterThanOrEqual(20);
      expect(precio).toBeLessThanOrEqual(30);
    }
  });

  test("CP-15.2-06: mínimo de $700 sin coincidencias", async ({ page }) => {
    await page.getByRole("textbox", { name: "Precio Mínimo", exact: true }).fill("700");
    await expect(tarjetas(page)).toHaveCount(0);
    await expect(page.getByText("No hay publicaciones que coincidan con la búsqueda.")).toBeVisible();
  });

  test("CP-15.2-07: quitar filtros recupera todas las publicaciones", async ({ page }) => {
    await page.getByRole("combobox", { name: "Especie", exact: true }).click();
    await page.getByRole("option", { name: "Mandarina", exact: true }).click();
    await expect(tarjetas(page)).toHaveCount(propias.filter((oferta) => oferta.speciesName === "Mandarina").length);
    await page.getByRole("button", { name: "Limpiar filtros" }).click();
    await expect(page.getByRole("combobox", { name: "Especie", exact: true })).toHaveText("Todas");
    await expect(page.getByRole("searchbox", { name: "Buscar publicaciones" })).toHaveValue("");
    await expect(page.getByRole("textbox", { name: "Precio Mínimo", exact: true })).toHaveValue("");
    await expect(page.getByRole("textbox", { name: "Precio Máximo", exact: true })).toHaveValue("");
    await expect(tarjetas(page)).toHaveCount(propias.length);
  });

  test("CP-15.2-08: consulta el detalle de Limón con sus datos y acciones", async ({ page }) => {
    const oferta = propias.find((oferta) => oferta.speciesName === "Limón")!;
    expect(oferta).toBeDefined();
    const presentacion = presentaciones[oferta.measureUnit];
    const tarjeta = tarjetas(page).filter({ has: page.getByText(nombre(oferta), { exact: true }) });
    const textoTarjeta = await tarjeta.innerText();
    await tarjeta.click();
    const detalle = page.getByRole("dialog", { name: "Consulta de publicación", exact: true });
    await expect(detalle).toBeVisible();
    const precio = detalle.getByRole("textbox", { name: "Precio en pesos", exact: true });
    await expect(precio).toHaveValue(oferta.price === null ? "" : String(oferta.price));
    await expect(precio).not.toBeEditable();
    if (oferta.price === null) await expect(precio).toHaveAttribute("placeholder", "Consultar precio");
    const unidades = detalle.getByRole("textbox", { name: `Unidades (${presentacion})`, exact: true });
    await expect(unidades).toHaveValue(String(oferta.quantity));
    await expect(unidades).not.toBeEditable();
    for (const [campo, valor] of [
      ["Especie", oferta.speciesName], ["Variedad", oferta.variety],
      ["Presentación", presentacion], ["Categoría", oferta.category],
      ["País de origen", oferta.country],
    ]) {
      const selector = detalle.getByRole("combobox", { name: campo, exact: true });
      await expect(selector).toHaveText(valor);
      await expect(selector).toBeDisabled();
    }
    const calibre = detalle.getByRole("combobox", { name: "Calibre", exact: true });
    await expect(calibre).toHaveText(/\S/);
    await expect(calibre).toBeDisabled();
    expect(textoTarjeta).toContain(await calibre.innerText());
    await expect(detalle.getByText(oferta.available ? "Disponible" : "No disponible", { exact: true })).toBeVisible();
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
  });
});
