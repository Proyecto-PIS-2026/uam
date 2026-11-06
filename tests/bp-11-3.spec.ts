import { expect, type Page } from "@playwright/test";
import { test } from "./usuarios-administrativos";
import { iniciarSesionProductor } from "./autenticacion";

const RUTA_PERFIL = "/mi-perfil/productor";
const RUTA_EDITAR = `${RUTA_PERFIL}/editar`;
const CONTACTO_INICIAL = "90000000";

// La tarjeta del perfil se identifica por el nombre del productor (h1).
const datosPerfil = (page: Page) => page.getByRole("region", { name: /^Productor de prueba \d+$/ });
const lineaContacto = (page: Page) => datosPerfil(page).locator("p").filter({ hasText: /^Whatsapp:/ });
const campoContacto = (page: Page) => page.getByRole("textbox", { name: /WhatsApp/ });

async function abrirModificacion(page: Page) {
  await page.goto(RUTA_PERFIL);
  await page.getByRole("link", { name: "Editar", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${RUTA_EDITAR}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Editar mi perfil", exact: true })).toBeVisible();
}

async function guardar(page: Page) {
  await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  await expect(page.getByText("Tu perfil se actualizó correctamente.")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${RUTA_PERFIL}$`));
}

async function guardarContacto(page: Page, numero: string) {
  await abrirModificacion(page);
  await campoContacto(page).fill(numero);
  await guardar(page);
  await page.reload();
}

test.describe("BP-11.3 - Modificación de mi perfil como Productor", () => {
  test.beforeEach(async ({ page, usuariosAdministrativos }) => {
    test.slow();
    await iniciarSesionProductor(page, usuariosAdministrativos.productor);
  });

  test("CP-01: la modificación muestra los datos actuales del perfil", async ({ page }) => {
    await page.goto(RUTA_PERFIL);
    const nombre = (await datosPerfil(page).getByRole("heading", { level: 1 }).textContent())?.trim() ?? "";
    expect(nombre).not.toBe("");
    await expect(lineaContacto(page)).toContainText(`+598 ${CONTACTO_INICIAL}`);

    await abrirModificacion(page);
    await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue(nombre);
    await expect(page.getByRole("combobox", { name: "Código de país" })).toContainText("+598 (Uruguay)");
    await expect(campoContacto(page)).toHaveValue(CONTACTO_INICIAL);
  });

  test("CP-02: modificar el número de contacto lo reemplaza y persiste", async ({ page }) => {
    await guardarContacto(page, "99123456");

    await expect(lineaContacto(page)).toContainText("+598 99123456");
    await expect(lineaContacto(page)).not.toContainText(CONTACTO_INICIAL);

    await abrirModificacion(page);
    await expect(campoContacto(page)).toHaveValue("99123456");
  });

  test("CP-04: el contacto obligatorio no se puede borrar y conserva el número guardado", async ({ page }) => {
    await abrirModificacion(page);
    await expect(campoContacto(page)).toHaveAttribute("required", "");
    await campoContacto(page).clear();
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();

    await expect(page.getByRole("alert").filter({ hasText: "El teléfono no es válido." })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${RUTA_EDITAR}$`));

    await page.goto(RUTA_PERFIL);
    await page.reload();
    await expect(lineaContacto(page)).toContainText(`+598 ${CONTACTO_INICIAL}`);
    await abrirModificacion(page);
    await expect(campoContacto(page)).toHaveValue(CONTACTO_INICIAL);
  });

  test("CP-05: un número con formato inválido se rechaza y no se guarda", async ({ page }) => {
    await abrirModificacion(page);
    // Para +598 el número debe ser 9 seguido de 7 dígitos.
    await campoContacto(page).fill("12345");
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();

    await expect(page.getByRole("alert").filter({ hasText: "El teléfono no es válido." })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${RUTA_EDITAR}$`));

    await page.goto(RUTA_PERFIL);
    await page.reload();
    await expect(lineaContacto(page)).toContainText(`+598 ${CONTACTO_INICIAL}`);
  });

  test("CP-06: permite corregir el contacto vacío y guardar un número válido", async ({ page }) => {
    await abrirModificacion(page);
    await campoContacto(page).clear();
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "El teléfono no es válido." })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${RUTA_EDITAR}$`));

    await campoContacto(page).fill("98765432");
    await guardar(page);
    await page.reload();

    await expect(lineaContacto(page)).toContainText("+598 98765432");
    await abrirModificacion(page);
    await expect(campoContacto(page)).toHaveValue("98765432");
  });
});
