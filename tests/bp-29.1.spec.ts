import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { test as base } from "./precarga-operadores";
import type { Credenciales } from "./autenticacion";
import type { NotificacionesUsuario } from "../src/modulos/notificaciones/tipos";

const test = base.extend<{ avisoAjeno: { id: number; texto: string } }>({
  avisoAjeno: async ({ precargaOperadores: { db, operadorB } }, usar) => {
    const texto = `BP-29.1 privado ${randomUUID()}`;
    const aviso = await db.orm.public.Notificacion.create({
      titulo: "Notificación", descripcion: texto, usuarioId: operadorB.usuarioId, vista: false,
    });
    try { await usar({ id: aviso.id, texto }); }
    finally { await db.orm.public.Notificacion.where({ id: aviso.id }).deleteAndCount(); }
  },
});

test.describe.configure({ mode: "default" });
test.beforeEach(() => test.setTimeout(180_000));
test.use({ viewport: { width: 1280, height: 900 } });

async function ingresar(page: Page, credenciales: Credenciales) {
  for (let intento = 0; intento < 2; intento++) {
    try {
      await page.goto("/iniciar-sesion", { waitUntil: "domcontentloaded", timeout: 30_000 });
      break;
    } catch (error) {
      if (intento > 0 || !(error instanceof Error) || !error.message.includes("ERR_NETWORK_IO_SUSPENDED")) throw error;
    }
  }
  await page.getByLabel("Correo electrónico o nombre de usuario").fill(credenciales.usuario);
  await page.getByLabel("Contraseña", { exact: true }).fill(credenciales.contrasena);
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await expect(page).toHaveURL(/\/mi-mercado(?:\/[^?#]*)?(?:[?#].*)?$/, { timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Abrir menú de usuario", exact: true })).toBeVisible({ timeout: 30_000 });
}

for (const operacion of [
  { caso: "13", metodo: "PATCH", titulo: "marcar como leída" },
  { caso: "14", metodo: "DELETE", titulo: "eliminar" },
] as const) {
  test(`CP-29.1-${operacion.caso}: no se puede ${operacion.titulo} una notificación ajena`, async ({ page, browser, precargaOperadores: datos, avisoAjeno }) => {
    const antes = await datos.db.orm.public.Notificacion.where({ id: avisoAjeno.id }).first();
    expect(antes).not.toBeNull();
    await ingresar(page, datos.operadorA.credenciales);
    const listadoA = await page.request.get("/api/notificaciones");
    expect(listadoA.status()).toBe(200);
    expect((await listadoA.json() as NotificacionesUsuario).notificaciones).toEqual([]);

    const respuesta = await page.request.fetch(`/api/notificaciones/${avisoAjeno.id}`, { method: operacion.metodo });
    expect(respuesta.status()).toBe(404);
    expect(await respuesta.json()).toEqual({ errores: ["La notificación no existe."] });
    expect(await datos.db.orm.public.Notificacion.where({ id: avisoAjeno.id }).first()).toEqual(antes);

    const contextoB = await browser.newContext({ baseURL: new URL(page.url()).origin });
    try {
      const paginaB = await contextoB.newPage();
      await ingresar(paginaB, datos.operadorB.credenciales);
      const listadoB = await paginaB.request.get("/api/notificaciones");
      expect(listadoB.status()).toBe(200);
      const recibido = await listadoB.json() as NotificacionesUsuario;
      expect(recibido.noLeidas).toBe(1);
      expect(recibido.notificaciones).toHaveLength(1);
      expect(recibido.notificaciones[0]).toMatchObject({ id: avisoAjeno.id, texto: avisoAjeno.texto, leida: false });
    } finally { await contextoB.close(); }
  });
}

test("CP-29.1-15: todas las operaciones sin sesión devuelven 401 y conservan los datos", async ({ request, precargaOperadores: { db }, avisoAjeno }) => {
  const antes = await db.orm.public.Notificacion.where({ id: avisoAjeno.id }).first();
  expect(antes).not.toBeNull();
  for (const [metodo, ruta] of [
    ["GET", "/api/notificaciones"],
    ["GET", "/api/notificaciones/resumen"],
    ["PATCH", `/api/notificaciones/${avisoAjeno.id}`],
    ["PATCH", "/api/notificaciones"],
    ["DELETE", `/api/notificaciones/${avisoAjeno.id}`],
    ["DELETE", "/api/notificaciones"],
  ]) {
    await test.step(`${metodo} ${ruta}`, async () => {
      const respuesta = await request.fetch(ruta, { method: metodo });
      expect(respuesta.status()).toBe(401);
      expect(await respuesta.json()).toEqual({ errores: ["Iniciá sesión para consultar tus notificaciones."] });
      expect(await db.orm.public.Notificacion.where({ id: avisoAjeno.id }).first()).toEqual(antes);
    });
  }
});

test("CP-29.1-16: leer todo no marca como leídas las notificaciones de otro usuario", async ({ page, precargaOperadores: datos, avisoAjeno }) => {
  await ingresar(page, datos.operadorA.credenciales);
  const respuesta = await page.request.patch("/api/notificaciones");
  expect(respuesta.status()).toBe(200);
  expect(await datos.db.orm.public.Notificacion.where({ id: avisoAjeno.id }).select("vista").first()).toEqual({ vista: false });
});


test("CP-29.1-17: borrar todo elimina únicamente las notificaciones propias", async ({ page, precargaOperadores: datos, avisoAjeno }) => {
  const textoPropio = `BP-29.1 propio ${randomUUID()}`;

  const propia = await datos.db.orm.public.Notificacion.create({titulo: "Notificación",descripcion: textoPropio,usuarioId: datos.operadorA.usuarioId,vista: false,});

  try {
    await ingresar(page, datos.operadorA.credenciales);

    const respuesta = await page.request.delete("/api/notificaciones");
    expect(respuesta.status()).toBe(200);

    expect(await datos.db.orm.public.Notificacion.where({ id: propia.id }).first()).toBeNull();

    expect(await datos.db.orm.public.Notificacion.where({ id: avisoAjeno.id }).first()).not.toBeNull();

  } finally {
    await datos.db.orm.public.Notificacion.where({ id: propia.id }).deleteAndCount();
  }
});
