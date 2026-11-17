import { expect } from "@playwright/test";
import { test } from "./precarga-operadores";

const rutaListado = "/operadores";

test("BP-20 no muestra públicamente a un operador deshabilitado", async ({ page, precargaOperadores }) => {
  test.slow();

  const { db, operadorA } = precargaOperadores;
  const especie = await db.orm.public.Especie.where({ especieActiva: true }).select("id").first();
  if (!especie) throw new Error("La base E2E necesita las especies de la seed.");

  // El listado público exige una publicación disponible cuando el operador no está de licencia.
  await db.transaction(async (tx) => {
    const publicacion = await tx.orm.public.Publicacion.create({
      especieId: especie.id,
      tipoPublicacion: "OPERADOR",
      publicacionActiva: true,
      publicacionDisponible: true,
      fechaVigencia: null,
    });
    await tx.orm.public.PublicacionOperador.create({ publicacionId: publicacion.id, operadorId: operadorA.id });
  });

  const buscador = page.getByRole("searchbox", { name: "Buscar operadores" });
  const todasLasTarjetas = page.locator('a[href^="/operadores/"]');
  const tarjetaOperador = todasLasTarjetas.filter({ hasText: operadorA.nombre });

  await page.goto(rutaListado);
  await buscador.fill(operadorA.nombre);
  await expect(tarjetaOperador).toHaveCount(1);

  await db.orm.public.Usuario.where({ id: operadorA.usuarioId }).update({ habilitado: false });

  await page.goto(rutaListado);
  await expect(todasLasTarjetas.first()).toBeVisible();
  await buscador.fill(operadorA.nombre);
  await expect(tarjetaOperador).toHaveCount(0);

  await page.goto(`/operadores/${encodeURIComponent(operadorA.nombre)}`);
  await expect(page.getByRole("heading", { name: operadorA.nombre, level: 1 })).toHaveCount(0);
});

test("BP-20.1 muestra el listado público de operadores", async ({ page }) => {
  test.slow();

  await page.goto(rutaListado);

  await expect(page.getByRole("heading", { name: "Operadores" })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Buscar operadores" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Nave" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ordenar por" })).toBeVisible();

  const tarjetasOperador = page.locator('a[href^="/operadores/"]');
  await expect(tarjetasOperador.first()).toBeVisible();
});

test("BP-20.1 permite buscar un operador por nombre", async ({ page }) => {
  test.slow();

  await page.goto(rutaListado);

  const tarjetasOperador = page.locator('a[href^="/operadores/"]');
  await expect(tarjetasOperador.first()).toBeVisible();
  const nombreOperador = (await tarjetasOperador.first().locator("p").first().innerText()).trim();

  await page.getByRole("searchbox", { name: "Buscar operadores" }).fill(nombreOperador);

  await expect(tarjetasOperador.first()).toBeVisible();
  await expect(tarjetasOperador.first()).toContainText(nombreOperador);
});

test("BP-20 y BP-20.2 muestra el perfil público y el detalle de sus productos", async ({ page }) => {
  test.slow();

  await page.goto(rutaListado);

  const tarjetasOperador = page.locator('a[href^="/operadores/"]');
  await expect(tarjetasOperador.first()).toBeVisible();

  // Elegimos un operador con productos si existe; si no, validamos su perfil y el estado vacío del catálogo.
  let operadorSeleccionado = tarjetasOperador.first();
  for (let indice = 0; indice < await tarjetasOperador.count(); indice += 1) {
    const tarjeta = tarjetasOperador.nth(indice);
    const texto = (await tarjeta.innerText()).replace(/\s+/g, " ");
    if (/\b[1-9]\d*\s*productos?\b/i.test(texto)) {
      operadorSeleccionado = tarjeta;
      break;
    }
  }

  const nombreOperador = (await operadorSeleccionado.locator("p").first().innerText()).trim();
  const rutaPerfil = await operadorSeleccionado.getAttribute("href");
  expect(rutaPerfil).toBeTruthy();

  await page.goto(rutaPerfil!);

  await expect(page.getByRole("heading", { name: nombreOperador, level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: `Contactar a ${nombreOperador} por WhatsApp` })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Publicaciones" })).toBeVisible();

  const tarjetasProducto = page.getByRole("button", { name: /^Ver detalles de / });
  if (await tarjetasProducto.count()) {
    await tarjetasProducto.first().click();

    const detalle = page.getByRole("dialog", { name: "Detalle de publicación" });
    await expect(detalle).toBeVisible();
    await expect(detalle.getByText("Empaquetado", { exact: true })).toBeVisible();
    await expect(detalle.getByText("Kilos", { exact: true })).toHaveCount(0);
    await expect(detalle.getByText("Calibre")).toBeVisible();
    await expect(detalle.getByText("Categoría")).toBeVisible();
    await expect(detalle.getByText("País")).toBeVisible();
    await expect(detalle.getByRole("link", { name: `Contactar a ${nombreOperador} por WhatsApp`, exact: true })).toBeVisible();  } else {
    await expect(page.getByText("No hay publicaciones disponibles.")).toBeVisible();
  }
});
