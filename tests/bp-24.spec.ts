import "temporal-polyfill/full/global";
import "temporal-polyfill/types/global";
import { expect, test } from "@playwright/test";
import { config } from "dotenv";
import postgres from "@prisma/orm-postgres/runtime";
import type { Contract } from "../src/infraestructura/persistencia/prisma/contract";
import contractJson from "../src/infraestructura/persistencia/prisma/contract.json" with { type: "json" };

const masVendidas = [
    "Papa", "Banana", "Naranja", "Manzana", "Tomate", "Cebolla",
    "Boniato", "Zanahoria", "Mandarina", "Morrón", "Sandía", "Limón",
    "Calabacín", "Zapallo", "Lechuga",
];

function compararEspecies(a: string, b: string) {
    const posicionA = masVendidas.indexOf(a);
    const posicionB = masVendidas.indexOf(b);

    if (posicionA !== -1 || posicionB !== -1) {
        return (posicionA === -1 ? masVendidas.length : posicionA)
            - (posicionB === -1 ? masVendidas.length : posicionB);
    }

    return a.localeCompare(b, "es", { sensitivity: "base" });
}

test.describe("BP-24: especies más vendidas primero", () => {
    test.describe.configure({ mode: "serial" });

    let restaurarConfiguracion: (() => Promise<void>) | undefined;
    let cerrarBase: (() => Promise<void>) | undefined;

    test.beforeAll(async () => {
        config({ path: [".env.local", ".env"], quiet: true });
        const url = process.env.DATABASE_URL;
        if (!url) throw new Error("Configure DATABASE_URL con la base utilizada por el servidor E2E.");

        const db = postgres<Contract>({ contractJson, url });
        cerrarBase = () => db.close();

        const claves = ["orden_landing_page_default", "orden_mercado_virtual_default"];
        const originales = await db.orm.public.Configuracion
            .where((configuracion) => configuracion.nombreConfiguracion.in(claves))
            .select("nombreConfiguracion", "valorConfiguracion")
            .all();

        expect(originales).toHaveLength(claves.length);

        restaurarConfiguracion = async () => {
            await db.transaction(async (tx) => {
                for (const original of originales) {
                    await tx.orm.public.Configuracion
                        .where({ nombreConfiguracion: original.nombreConfiguracion })
                        .update({ valorConfiguracion: original.valorConfiguracion });
                }
            });
        };

        await db.transaction(async (tx) => {
            for (const nombreConfiguracion of claves) {
                await tx.orm.public.Configuracion
                    .where({ nombreConfiguracion })
                    .update({ valorConfiguracion: "mas_vendidas" });
            }
        });
    });

    test.afterAll(async () => {
        try {
            await restaurarConfiguracion?.();
        } finally {
            await cerrarBase?.();
        }
    });

    test.beforeEach(() => {
        test.slow();
    });

    test("CP-24-01: Inicio muestra primero las 15 especies en el orden de la UAM", async ({ page }) => {
        await page.goto("/inicio");

        const especies = page.getByRole("region", { name: "Especies", exact: true });
        await expect(especies).toBeVisible();

        const nombres = especies.locator('a[href^="/publicaciones?especie="] h3');
        await expect(nombres.first()).toBeVisible();
        await expect.poll(async () => (await nombres.allTextContents()).map((nombre) => nombre.trim()).slice(0, 15)).toEqual(masVendidas);
    });

    test("CP-24-02: Agrupar por operador conserva las especies más vendidas primero dentro de cada grupo", async ({ page }) => {
        await page.goto("/publicaciones");
        await page.getByRole("button", { name: "Agrupar", exact: true }).click();
        await expect(page.getByRole("button", { name: "Desagrupar", exact: true })).toBeVisible();

        const grupos = page.getByRole("main").locator('[class*="nombreGrupo"]');
        await expect(grupos.first()).toBeVisible();

        let gruposConVariasEspecies = 0;

        for (let indice = 0; indice < await grupos.count(); indice++) {
            const encabezado = grupos.nth(indice);
            const nombreOperador = (await encabezado.innerText()).trim();
            const productos = encabezado.locator("../..").getByRole("heading", { level: 3 });
            const especies = (await productos.allTextContents()).map((nombre) => nombre.split(" - ")[0].trim());

            expect(especies.length, `Productos de ${nombreOperador}`).toBeGreaterThan(0);
            if (new Set(especies).size > 1) gruposConVariasEspecies++;

            expect(especies, `Orden de especies de ${nombreOperador}`).toEqual([...especies].sort(compararEspecies));
        }

        expect(gruposConVariasEspecies).toBeGreaterThan(0);
    });

    test('CP-24-03: el select conserva "Todas" primero y luego las especies más vendidas', async ({ page }) => {
        await page.goto("/publicaciones");
        await page.getByRole("combobox", { name: "Especie", exact: true }).click();

        const opciones = page.getByRole("listbox").getByRole("option");
        await expect(opciones.first()).toHaveText("Todas");
        await expect.poll(async () => (await opciones.allTextContents()).map((opcion) => opcion.trim()).slice(0, 16)).toEqual(["Todas", ...masVendidas]);
    });
});