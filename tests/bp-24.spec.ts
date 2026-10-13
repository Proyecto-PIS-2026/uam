import { expect, test } from "@playwright/test";

// Referencia independiente de la implementación: matriz BP-24, CP-24-01 a 03.
// Requiere datos de prueba con las 15 especies más vendidas publicadas.
const masVendidas = [
  "Papa", "Banana", "Naranja", "Manzana", "Tomate", "Cebolla",
  "Boniato", "Zanahoria", "Mandarina", "Morrón", "Sandía", "Limón",
  "Calabacín", "Zapallo", "Lechuga",
];

test.describe("BP-24: especies más vendidas primero", () => {
  test.beforeEach(async () => {
    test.slow();
  });

  test("CP-24-01: Inicio muestra primero las 15 especies en el orden de la UAM", async ({ page }) => {
    await page.goto("/inicio");

    const especies = page.getByRole("region", { name: "Especies", exact: true });
    await expect(especies).toBeVisible();
    const nombres = especies.locator('a[href^="/publicaciones?especie="] h3');
    await expect(nombres.first()).toBeVisible();
    await expect.poll(async () => (await nombres.allTextContents()).slice(0, 15))
      .toEqual(masVendidas);
  });

  test("CP-24-02: Agrupar por operador conserva las especies más vendidas primero dentro de cada grupo", async ({ page }) => {
    await page.goto("/publicaciones");
    await page.getByRole("button", { name: "Agrupar", exact: true }).click();
    await expect(page.getByRole("button", { name: "Desagrupar", exact: true })).toBeVisible();

    // Aclaración funcional: se agrupa por operador; la prioridad se valida en sus productos.
    const grupos = page.getByRole("main").getByRole("heading", { level: 2 });
    await expect(grupos.first()).toBeVisible();
    let gruposConVariasEspecies = 0;
    for (let indice = 0; indice < await grupos.count(); indice += 1) {
      const encabezado = grupos.nth(indice);
      const nombreOperador = (await encabezado.innerText()).trim();
      const productos = encabezado.locator("xpath=../following-sibling::ul")
        .getByRole("heading", { level: 3 });
      const especies = (await productos.allTextContents())
        .map(nombre => nombre.split(" - ")[0].trim());
      expect(especies.length, `Productos de ${nombreOperador}`).toBeGreaterThan(0);
      if (new Set(especies).size > 1) gruposConVariasEspecies += 1;
      const esperadas = [...especies].sort((a, b) => {
        const posicionA = masVendidas.indexOf(a);
        const posicionB = masVendidas.indexOf(b);
        if (posicionA !== -1 || posicionB !== -1) {
          return (posicionA === -1 ? masVendidas.length : posicionA)
            - (posicionB === -1 ? masVendidas.length : posicionB);
        }
        return a.localeCompare(b, "es", { sensitivity: "base" });
      });
      expect(especies, `Orden de especies de ${nombreOperador}`).toEqual(esperadas);
    }
    // Evita aprobar sin datos que permitan comprobar realmente el orden.
    expect(gruposConVariasEspecies).toBeGreaterThan(0);
  });

  test('CP-24-03: el select conserva "Todas" primero y luego las especies más vendidas', async ({ page }) => {
    await page.goto("/publicaciones");
    await page.getByRole("combobox", { name: "Especie", exact: true }).click();

    const opciones = page.getByRole("listbox").getByRole("option");
    await expect(opciones.first()).toHaveText("Todas");
    await expect.poll(async () => (await opciones.allTextContents()).slice(0, 16))
      .toEqual(["Todas", ...masVendidas]);
  });
});
