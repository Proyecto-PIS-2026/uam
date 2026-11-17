import { expect, type Page } from "@playwright/test";

export async function esperarYCerrarNotificacion(
  page: Page,
  mensaje: string,
  opciones: { rol?: "alert" | "status"; timeout?: number } = {},
) {
  const aviso = page.getByRole("region", { name: "Notificaciones", exact: true })
    .getByRole(opciones.rol ?? "alert")
    .filter({ hasText: mensaje });
  await expect(aviso).toBeVisible({ timeout: opciones.timeout });
  await expect(aviso).toHaveText(mensaje, { timeout: opciones.timeout });
  await aviso.getByRole("button", { name: "Cerrar notificación", exact: true }).click();
  await expect(aviso).toHaveCount(0, { timeout: opciones.timeout });
}
