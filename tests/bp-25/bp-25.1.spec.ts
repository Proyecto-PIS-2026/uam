import { expect, test, type Page } from "@playwright/test";
import {
  conListadoSinProductoresPublicos,
  conProductorSinPublicacionesPublicas,
} from "./fixtures";

const productoresDemo = [
  "Agro San José",
  "Bananera Ecuatoriana S.A.",
  "Citrícola Salto Norte",
  "Finca Canelones Verde",
  "Frutas Tacuarembó",
  "Orgánicos Maldonado",
];

function credenciales(rol: "OPERADOR" | "PRODUCTOR") {
  const usuario = process.env[`E2E_${rol}_USU`] ??
    (rol === "OPERADOR" ? "lucas_blanco" : "productor_san_jose_agro");
  const contrasena = process.env[`E2E_${rol}_PASS`] ?? (usuario ? `${usuario}123` : undefined);

  if (!usuario || !contrasena) {
    throw new Error(
      `Definí E2E_${rol}_USU con una cuenta de prueba del rol ${rol.toLowerCase()}. Para cuentas no seed, también definí E2E_${rol}_PASS.`,
    );
  }

  return { usuario, contrasena };
}

async function iniciarSesion(page: Page, rol: "OPERADOR" | "PRODUCTOR") {
  const { usuario, contrasena } = credenciales(rol);
  await page.goto("/iniciar-sesion");
  await page.getByLabel("Correo electrónico o nombre de usuario").fill(usuario);
  await page.getByLabel("Contraseña", { exact: true }).fill(contrasena);
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await expect(page).toHaveURL(/\/inicio$|\/mi-mercado(?:\/|$)/, { timeout: 30_000 });
}

async function abrirListadoProductores(page: Page) {
  await page.goto("/productores");
  await expect(page).toHaveURL(/\/productores$/);
}

function tarjetasProductores(page: Page) {
  return page.locator('a[href^="/productores/"]');
}

test.describe("BP-25.1: listado de Productores para Operadores", () => {
  test("CP-25.1-01/03: un Operador autenticado puede abrir el listado desde la navegación", async ({ page }) => {
    await iniciarSesion(page, "OPERADOR");

    const enlaceProductores = page.getByRole("link", { name: "Productores", exact: true });
    if (!(await enlaceProductores.isVisible())) {
      await page.getByRole("button", { name: "Abrir menú" }).click();
    }
    await expect(enlaceProductores).toBeVisible();
    await enlaceProductores.click();
    await expect(page).toHaveURL(/\/productores$/);
    await expect(tarjetasProductores(page).first()).toBeVisible();
  });

  test("CP-25.1-02: un Productor no puede consultar el listado de otros Productores", async ({ page }) => {
    await iniciarSesion(page, "PRODUCTOR");
    await page.goto("/productores");

    await expect(page).toHaveURL(/\/inicio$/);
    await expect(tarjetasProductores(page)).toHaveCount(0);
  });

  test("CP-25.1-02: una visita sin sesión no expone el listado", async ({ page }) => {
    await page.goto("/productores");

    await expect(page).toHaveURL(/\/iniciar-sesion$/);
    await expect(tarjetasProductores(page)).toHaveCount(0);
  });

  test("CP-25.1-05: lista e identifica los seis Productores habilitados del conjunto de prueba", async ({ page }) => {
    await iniciarSesion(page, "OPERADOR");
    await abrirListadoProductores(page);

    const tarjetas = tarjetasProductores(page);
    await expect(tarjetas).toHaveCount(productoresDemo.length);
    for (const nombre of productoresDemo) {
      await expect(tarjetas.filter({ hasText: nombre })).toHaveCount(1);
    }
  });

  test("CP-25.1-06: seleccionar un Productor abre su perfil y sus publicaciones", async ({ page }) => {
    await iniciarSesion(page, "OPERADOR");
    await abrirListadoProductores(page);

    await tarjetasProductores(page).filter({ hasText: "Agro San José" }).click();
    await expect(page).toHaveURL(/\/productores\/Agro%20San%20Jos%C3%A9/);
    await expect(page.getByRole("heading", { name: "Agro San José", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Ver detalles de/ }).first()).toBeVisible();
  });

  test("CP-25.1-08: filtra por nombre exacto", async ({ page }) => {
    await iniciarSesion(page, "OPERADOR");
    await abrirListadoProductores(page);

    const busqueda = page.getByRole("searchbox", { name: "Buscar productores" });
    const tarjetas = tarjetasProductores(page);

    await busqueda.fill("Agro San José");
    await expect(tarjetas).toHaveCount(1);
    await expect(tarjetas.first()).toContainText("Agro San José");

  });

  test("CP-25.1-09: filtra por nombre parcial sin distinguir mayúsculas ni acentos", async ({ page }) => {
    await iniciarSesion(page, "OPERADOR");
    await abrirListadoProductores(page);

    const busqueda = page.getByRole("searchbox", { name: "Buscar productores" });
    const tarjetas = tarjetasProductores(page);

    await busqueda.fill("citri");
    await expect(tarjetas).toHaveCount(1);
    await expect(tarjetas.first()).toContainText("Citrícola Salto Norte");
  });

  test("CP-25.1-12: muestra la foto predeterminada cuando el Productor no tiene foto", async ({ page }) => {
    await iniciarSesion(page, "OPERADOR");
    await abrirListadoProductores(page);

    const tarjeta = tarjetasProductores(page).filter({ hasText: "Agro San José" });
    await expect(tarjeta).toBeVisible();
    await expect(tarjeta.locator("img")).toHaveCount(0);
    await expect(tarjeta.locator(":scope > div").first().locator("span")).toHaveText("A");
  });

  test("CP-25.1-04: muestra estado vacío si no hay Productores con publicaciones públicas", async ({ page }) => {
    await conListadoSinProductoresPublicos(async () => {
      await iniciarSesion(page, "OPERADOR");
      await abrirListadoProductores(page);

      await expect(page.getByRole("status")).toHaveText("No hay productores disponibles.");
      await expect(tarjetasProductores(page)).toHaveCount(0);
    });
  });

  test("CP-25.1-07: oculta un Productor sin publicaciones públicas", async ({ page }) => {
    await conProductorSinPublicacionesPublicas("Agro San José", async () => {
      await iniciarSesion(page, "OPERADOR");
      await abrirListadoProductores(page);

      const tarjetas = tarjetasProductores(page);
      await expect(tarjetas.filter({ hasText: "Agro San José" })).toHaveCount(0);
      await expect(tarjetas).toHaveCount(productoresDemo.length - 1);
      for (const nombre of productoresDemo.filter((nombre) => nombre !== "Agro San José")) {
        await expect(tarjetas.filter({ hasText: nombre })).toHaveCount(1);
      }
    });
  });
});
