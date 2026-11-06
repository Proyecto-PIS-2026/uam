import "temporal-polyfill/full/global";
import "temporal-polyfill/types/global";
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import argon2 from "argon2";
import { config } from "dotenv";
import postgres from "@prisma/orm-postgres/runtime";
import { expect, test as base, type Page } from "@playwright/test";
import type { Contract } from "../src/infraestructura/persistencia/prisma/contract";
import contractJson from "../src/infraestructura/persistencia/prisma/contract.json" with { type: "json" };

type Operador = { id: number; nombre: string; usuario: string; contrasena: string; locales: string[] };

const test = base.extend<{ db: ReturnType<typeof postgres<Contract>>; operador: Operador }>({
  db: async ({}, usar) => {
    config({ path: [".env.local", ".env"], quiet: true });
    if (!process.env.DATABASE_URL) throw new Error("Configure DATABASE_URL con la base utilizada por el servidor E2E.");
    const db = postgres<Contract>({ contractJson, url: process.env.DATABASE_URL });
    await usar(db);
    await db.close();
  },
  operador: async ({ db }, usar) => {
    const sufijo = randomUUID().replaceAll("-", "");
    const contrasena = randomBytes(24).toString("hex");
    const passwordHash = await argon2.hash(contrasena, { type: argon2.argon2id });
    const usuario = await db.orm.public.Usuario.create({ username: `e2e_bp114_${sufijo}`, passwordHash, rol: "OPERADOR", twoFactorEnabled: false });
    const operador = await db.orm.public.Operador.create({
      usuarioId: usuario.id,
      nombreFantasia: `Operador BP11.4 ${sufijo.slice(0, 10)}`,
      whatsApp: "+59899123456",
      fotoPerfil: "/Logo.PNG",
      enLicencia: true,
      comentario: "Licencia: 2026-12-01 - 2026-12-15\n\nCompren en el puesto de al lado.",
    });
    const naves = (await db.orm.public.Nave.select("id", "nombreNave").all()).slice(0, 2);
    const locales: string[] = [];
    for (const nave of naves) {
      const numeroLocal = `9${randomInt(100000000, 1000000000)}`;
      await db.orm.public.Local.create({ operadorId: operador.id, naveId: nave.id, numeroLocal, finContrato: null });
      locales.push(`Nave ${nave.nombreNave} · Local ${numeroLocal}`);
    }
    try {
      await usar({ id: operador.id, nombre: operador.nombreFantasia, usuario: usuario.username, contrasena, locales });
    } finally {
      // Local no se borra en cascada; Operador sí se borra con Usuario.
      await db.orm.public.Local.where({ operadorId: operador.id }).deleteAll();
      await db.orm.public.Usuario.where({ id: usuario.id }).delete();
    }
  },
});

async function iniciarSesion(page: Page, operador: Operador) {
  await page.goto("/iniciar-sesion");
  await page.getByLabel("Correo electrónico o nombre de usuario").fill(operador.usuario);
  await page.getByLabel("Contraseña", { exact: true }).fill(operador.contrasena);
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Mi Mercado", exact: true, level: 1 })).toBeVisible({ timeout: 30_000 });
}

test.describe("BP-11.4 - Consulta de mi perfil como Operador", () => {
  test.beforeEach(() => test.slow());

  test("CA-1 a CA-9: el operador consulta su perfil con todos sus datos", async ({ page, db, operador }) => {
    // CA-1: sin sesión no se muestra ningún perfil, se pide iniciar sesión.
    await page.goto("/mi-perfil");
    await expect(page).toHaveURL("/iniciar-sesion");

    await iniciarSesion(page, operador);
    await page.goto("/mi-perfil");
    const perfil = page.getByRole("region", { name: operador.nombre, exact: true });

    // CA-2: nombre del operador y nombre de usuario, por separado.
    await expect(perfil.getByRole("heading", { level: 1 })).toHaveText(operador.nombre);
    await expect(perfil.getByText(`Usuario: ${operador.usuario}`, { exact: true })).toBeVisible();

    // CA-3: número de contacto.
    await expect(perfil.getByText("WhatsApp: +59899123456", { exact: true })).toBeVisible();

    // CA-4: todos los locales con su nave.
    await expect(perfil.getByRole("listitem")).toHaveCount(2);
    for (const local of operador.locales) await expect(perfil.getByText(local)).toBeVisible();

    // CA-5: foto de perfil.
    await expect(perfil.getByRole("img", { name: `Foto de ${operador.nombre}`, exact: true })).toBeVisible();

    // CA-6: período de licencia y mensaje de recomendación.
    await expect(perfil.getByText("01/12/2026 - 15/12/2026", { exact: true })).toBeVisible();
    await expect(perfil.getByText("Compren en el puesto de al lado.", { exact: true })).toBeVisible();

    // CA-7: la contraseña no aparece.
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    expect(await page.content()).not.toContain(operador.contrasena);

    // CA-8: opción para editar el perfil.
    await expect(perfil.getByRole("button", { name: "Editar", exact: true })).toBeVisible();

    // CA-9: cambio de contraseña pidiendo la actual.
    await perfil.getByRole("link", { name: "Cambiar contraseña", exact: true }).click();
    await expect(page).toHaveURL("/mi-perfil/cambiar-contrasena");
    await expect(page.getByLabel("Contraseña actual", { exact: true })).toBeVisible();

    // CA-1: el perfil de otro operador no es accesible.
    const otro = await db.orm.public.Operador.select("nombreFantasia").where({ enLicencia: false }).first();
    if (otro) {
      await page.goto(`/operadores/${encodeURIComponent(otro.nombreFantasia)}`);
      await expect(page).toHaveURL(/\/mi-mercado(\/|$)/);
    }
  });

  test("CA-3, CA-5 y CA-6: se indica cuando no hay contacto, foto ni licencia", async ({ page, db, operador }) => {
    await db.orm.public.Operador.where({ id: operador.id }).update({ whatsApp: "", fotoPerfil: null, enLicencia: false, comentario: null });
    await iniciarSesion(page, operador);
    await page.goto("/mi-perfil");
    const perfil = page.getByRole("region", { name: operador.nombre, exact: true });

    await expect(perfil.getByText("WhatsApp: No hay un número de contacto registrado.", { exact: true })).toBeVisible();
    await expect(perfil.getByRole("img", { name: `Foto de ${operador.nombre}`, exact: true })).toHaveCount(0);
    await expect(perfil.getByText("No hay licencia registrada.", { exact: true })).toBeVisible();
  });
});
