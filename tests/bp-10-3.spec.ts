import { expect, test } from "@playwright/test";
import { iniciarSesionOperador } from "./autenticacion";

test("BP-10.3 Compartir producto en WhatsApp Web con mensaje predeterminado", async ({ page }) => {
  test.slow();

  await page.context().route(/wa\.me|whatsapp\.com/, (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<html></html>" }),
  );

  await iniciarSesionOperador(page);
  await page.goto("/mi-mercado");

  const tarjeta = page.getByRole("button", { name: /^Ver detalle de/ }).first();
  const nombreProducto = (await tarjeta.getAttribute("aria-label"))!
    .replace(/^Ver detalle de /, "").replace(" · ", " - ");
  await tarjeta.click();

  const consulta = page.getByRole("dialog", { name: "Consulta de publicación", exact: true });
  await expect(consulta).toBeVisible();
  const precio = await consulta.getByRole("textbox", { name: "Precio en pesos", exact: true }).inputValue();

  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    consulta.getByRole("button", { name: "Compartir en WhatsApp", exact: true }).click(),
  ]);

  await popup.waitForURL(/wa\.me|whatsapp\.com/, { waitUntil: "commit" });
  const enlace = new URL(popup.url());
  expect(enlace.hostname).toBe("web.whatsapp.com");
  const mensaje = enlace.searchParams.get("text");
  expect(mensaje).toContain(nombreProducto);
  expect(mensaje).toContain(`Precio: ${precio ? `$${Number(precio)}` : "Consultar"}`);
  expect(mensaje).toContain("Disponible en ");
  expect(mensaje).toContain(`${new URL(page.url()).origin}/operadores/`);
  await expect(consulta).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await popup.close();
});
