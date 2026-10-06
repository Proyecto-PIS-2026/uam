import { expect, test } from "@playwright/test";

test("BP-10.1 permite contactar al operador por WhatsApp", async ({ page }) => {
  test.slow();

  await page.goto("/operadores");

  const tarjetaOperador = page.locator('a[href^="/operadores/"]').first();
  await expect(tarjetaOperador).toBeVisible();

  const nombreOperador = (await tarjetaOperador.locator("p").first().innerText()).trim();
  await tarjetaOperador.click();

  await expect(page.getByRole("heading", { name: nombreOperador, level: 1 })).toBeVisible();

  const enlaceWhatsApp = page.getByRole("link", {
    name: `Contactar a ${nombreOperador} por WhatsApp`,
  });
  await expect(enlaceWhatsApp).toBeVisible();
  await expect(enlaceWhatsApp).toHaveAttribute("target", "_blank");

  const destino = new URL((await enlaceWhatsApp.getAttribute("href"))!);
  expect(destino.hostname).toBe("wa.me");
  expect(destino.pathname).toMatch(/^\/\d+$/);
  expect(destino.searchParams.get("text")).toBe(
    "Hola, vi tu perfil en Mercado UAM y quisiera hacerte una consulta.",
  );
});
