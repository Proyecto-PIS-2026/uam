import { expect, test } from "@playwright/test";
import { iniciarSesionOperador } from "./autenticacion";

test("BP-10.3 Compartir producto en estado de WhatsApp", async ({ page }) => {
test.slow();

  //evita depender de internet
  await page.context().route(/wa\.me|whatsapp\.com/, (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<html></html>" }),
  );

  await iniciarSesionOperador(page);
  await page.goto("/mi-mercado");

  await page.locator('[class*="tarjeta"]').first().click();
  await page.getByRole("button", { name: "Compartir en WhatsApp" }).click();

  const modal = page.getByRole("dialog").filter({ hasText: "Compartir producto en WhatsApp" });
  await expect(modal).toBeVisible();

  const mensaje = modal.getByRole("textbox");
  await expect(mensaje).not.toHaveValue("");

  const textoEditado = "Mensaje editado por el operador";
  await mensaje.fill(textoEditado);
  await expect(mensaje).toHaveValue(textoEditado);

  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    modal.getByRole("button", { name: "Compartir", exact: true }).click(),
  ]);

  await popup.waitForURL(/wa\.me|whatsapp\.com/, { waitUntil: "commit" });
  expect(new URL(popup.url()).searchParams.get("text")).toContain(textoEditado);
  await popup.close();
})