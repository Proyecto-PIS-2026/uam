import { test, expect } from "@playwright/test";

test("BP-08.1: listado público de productos agrupado por especie", async ({ page }) => {
  await page.goto("/inicio");

  // La landing pública carga correctamente.
  await expect(
    page.getByRole("heading", { name: "Mercado de hoy", level: 1 }).first(),
  ).toBeVisible();

  await expect(
    page.getByRole("heading", { name: "Especies", level: 2 }),
  ).toBeVisible();

  // CA-1, CA-2 y CA-3:
  // existen especies publicadas y cada tarjeta identifica la especie.
  const tarjetas = page.locator(
    'a[href^="/publicaciones?especie="]',
  );

  expect(await tarjetas.count()).toBeGreaterThan(0);

  const primeraTarjeta = tarjetas.first();
  await expect(primeraTarjeta).toBeVisible();

  const nombreEspecie = (
    await primeraTarjeta.getByRole("heading", { level: 3 }).innerText()
  ).trim();

  expect(nombreEspecie).not.toBe("");

  // La tarjeta informa la cantidad de operadores.
  await expect(
    primeraTarjeta.getByText(/operador(?:es)?$/),
  ).toBeVisible();

  // CA-4: al menos una especie tiene imagen representativa.
  const tarjetaConImagen = tarjetas.filter({
    has: page.locator("img"),
  }).first();

  await expect(tarjetaConImagen).toBeVisible();
  await expect(tarjetaConImagen.locator("img")).toBeVisible();

  // CA-5: existe acceso al listado general sin seleccionar especie.
  const verPublicaciones = page.getByRole("link", {
    name: "Ver publicaciones",
  });

  await expect(verPublicaciones).toBeVisible();
  await expect(verPublicaciones).toHaveAttribute("href", "/publicaciones");

  // CA-6: seleccionar una especie lleva al listado con el filtro precargado.
  await primeraTarjeta.click();

  await expect(page).toHaveURL((url) =>
    url.pathname === "/publicaciones" &&
    url.searchParams.get("especie") === nombreEspecie
  );
});
