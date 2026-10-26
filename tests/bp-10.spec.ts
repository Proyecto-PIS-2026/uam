import { expect, test } from "@playwright/test";
import { iniciarSesionOperador } from "./autenticacion";

const WHATSAPP = /wa\.me|whatsapp\.com/;
const HOST_WHATSAPP = /(^|\.)(wa\.me|whatsapp\.com)$/;

test.describe("BP-10 Contacto por WhatsApp", () => {
  test("CA1: el comprador puede contactar al operador", async ({ page }) => {
    await page.goto("/operadores");
    await page.locator('a[href^="/operadores/"]').first().click();
    await page.waitForURL(/\/operadores\/.+/);

    const enlace = page.getByRole("link", { name: /^Contactar a .* por WhatsApp$/ });
    await expect(enlace).toBeVisible();
    await expect(enlace).toHaveAttribute("href", /^https:\/\/wa\.me\//);
  });

  test("CA2: el operador puede contactar al productor", async ({ page }) => {
    await iniciarSesionOperador(page);
    await page.goto("/productores");

    await page.locator('a[href^="/productores/"]').first().click();
    await page.getByRole("button", { name: /^Ver detalles de/ }).first().click();

    const contactar = page.getByRole("link", { name: /^Contactar a .* por WhatsApp$/ });
    await expect(contactar).toBeVisible();
    await expect(contactar).toHaveAttribute("href", /^https:\/\/wa\.me\//);
  });

  test("CA3: el operador puede compartir sus publicaciones", async ({ page }) => {
    test.slow();
    await page.context().route(WHATSAPP, (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: "<html></html>" }),
    );

    await iniciarSesionOperador(page);
    await page.goto("/mi-mercado");
    await page.getByRole("button", { name: /^Ver detalle de/ }).first().click();

    const consulta = page.getByRole("dialog", { name: "Consulta de publicación", exact: true });
    await expect(consulta).toBeVisible();
    const [popup] = await Promise.all([
      page.waitForEvent("popup"),
      consulta.getByRole("button", { name: "Compartir en WhatsApp", exact: true }).click(),
    ]);

    await popup.waitForURL(WHATSAPP, { waitUntil: "commit" });
    expect(new URL(popup.url()).hostname).toMatch(HOST_WHATSAPP);
    expect(new URL(popup.url()).searchParams.get("text")).toBeTruthy();
    await popup.close();
  });
});
