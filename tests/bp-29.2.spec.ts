import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { test as base } from "./usuarios-administrativos";
import type { NotificacionesUsuario } from "../src/modulos/notificaciones/tipos";

type DB = typeof import("../src/infraestructura/persistencia/prisma/db").db;
type Aviso = { id: number; texto: string; fecha: string; leida: boolean };
type Avisos = { usuarioId: number; antiguo: Aviso; reciente: Aviso; leido: Aviso };

const test = base.extend<{ avisos: Avisos }, { backend: DB }>({
  backend: [async ({}, usar) => {
    const { db } = await import("../src/infraestructura/persistencia/prisma/db");
    try { await usar(db); } finally { await db.close(); }
  }, { scope: "worker" }],
  avisos: async ({ usuariosAdministrativos, backend: db }, usar) => {
    const usuario = await db.orm.public.Usuario.where({ username: usuariosAdministrativos.productor.usuario }).select("id").first();
    if (!usuario) throw new Error("Falta el productor propio del test.");
    const ids: number[] = [];
    async function crear(etiqueta: string, fecha: string, leida: boolean): Promise<Aviso> {
      const texto = `BP-29.2 ${etiqueta} ${randomUUID()}`;
      const aviso = await db.orm.public.Notificacion.create({ titulo: "Notificación", descripcion: texto, usuarioId: usuario!.id, vista: leida, fecha: Temporal.Instant.from(fecha) });
      ids.push(aviso.id);
      return { id: aviso.id, texto, fecha, leida };
    }
    try {
      const reciente = await crear("reciente", "2026-04-03T15:30:00Z", false);
      const antiguo = await crear("antiguo", "2026-04-01T12:00:00Z", false);
      const leido = await crear("ya leído", "2026-04-02T18:00:00Z", true);
      await usar({ usuarioId: usuario.id, antiguo, reciente, leido });
    } finally {
      for (const id of ids) await db.orm.public.Notificacion.where({ id }).deleteAndCount();
    }
  },
});

test.describe.configure({ mode: "default" });
test.beforeEach(() => test.setTimeout(120_000));
test.use({ viewport: { width: 1280, height: 900 } });

const cuenta = (page: Page) => page.getByRole("button", { name: "Abrir menú de usuario", exact: true });
const filas = (page: Page) => page.getByRole("list", { name: "Notificaciones recibidas" }).getByRole("listitem");
const fila = (page: Page, aviso: Aviso) => filas(page).filter({ hasText: aviso.texto });

async function ingresar(page: Page, credenciales: { usuario: string; contrasena: string }) {
  await page.goto("/iniciar-sesion", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Correo electrónico o nombre de usuario").fill(credenciales.usuario);
  await page.getByLabel("Contraseña", { exact: true }).fill(credenciales.contrasena);
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await expect(page).toHaveURL(/\/mi-mercado\/productor(?:\/[^?#]*)?(?:[?#].*)?$/, { timeout: 30_000 });
  await expect(cuenta(page)).toBeVisible({ timeout: 30_000 });
}

async function cargar(page: Page) {
  const [respuesta] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === "GET" && new URL(r.url()).pathname === "/api/notificaciones", { timeout: 30_000 }),
    page.goto("/notificaciones"),
  ]);
  expect(respuesta.status()).toBe(200);
  await expect(page.getByRole("region", { name: "Tus notificaciones", exact: true })).toHaveAttribute("aria-busy", "false", { timeout: 30_000 });
}

async function contador(page: Page, cantidad: number) {
  const distintivo = cuenta(page).locator("span[aria-hidden='true']");
  if (cantidad === 0) {
    await expect(distintivo).toHaveCount(0);
    await expect(cuenta(page)).not.toHaveAttribute("aria-describedby", /.+/);
  } else {
    await expect(distintivo).toHaveText(String(cantidad), { timeout: 30_000 });
    await expect(cuenta(page)).toHaveAccessibleDescription(`${cantidad} ${cantidad === 1 ? "notificación sin leer" : "notificaciones sin leer"}`);
  }
}

async function consultar(page: Page): Promise<NotificacionesUsuario> {
  const respuesta = await page.request.get("/api/notificaciones");
  expect(respuesta.status()).toBe(200);
  return respuesta.json();
}

async function modificar(page: Page, metodo: string, ruta: string, accion: () => Promise<void>) {
  const [respuesta] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === metodo && new URL(r.url()).pathname === ruta, { timeout: 30_000 }),
    accion(),
  ]);
  expect(respuesta.status()).toBe(200);
  await expect(page.getByRole("region", { name: "Tus notificaciones", exact: true })).toHaveAttribute("aria-busy", "false", { timeout: 30_000 });
}

test("CP-29.2-01: sin sesión no hay acceso ni contador de notificaciones", async ({ page }) => {
  await page.goto("/inicio");
  await expect(cuenta(page)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Notificaciones", exact: true })).toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: "Notificaciones", exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  const abrir = page.getByRole("button", { name: "Abrir menú", exact: true });
  await expect(abrir.locator("span[aria-hidden='true']")).toHaveCount(0);
  await abrir.click();
  await expect(page.getByRole("navigation", { name: "Navegación móvil", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Notificaciones", exact: true })).toHaveCount(0);
});

test("CP-29.2-03: el icono muestra dos sin leer y excluye la notificación leída", async ({ page, usuariosAdministrativos, avisos }) => {
  expect(avisos.leido.leida).toBe(true);
  await ingresar(page, usuariosAdministrativos.productor);
  await contador(page, 2);
});

test("CP-29.2-04: con todas leídas el icono se muestra sin número", async ({ page, usuariosAdministrativos, avisos, backend }) => {
  await backend.orm.public.Notificacion.where({ usuarioId: avisos.usuarioId }).updateAndCount({ vista: true });
  await ingresar(page, usuariosAdministrativos.productor);
  await cargar(page);
  await expect(cuenta(page)).toBeVisible();
  expect((await consultar(page)).noLeidas).toBe(0);
  await contador(page, 0);
});

test("CP-29.2-05: leer y borrar actualizan el contador sin recargar", async ({ page, usuariosAdministrativos, avisos }) => {
  await ingresar(page, usuariosAdministrativos.productor);
  await cargar(page);
  await contador(page, 2);
  const url = page.url();
  let navegaciones = 0;
  page.on("framenavigated", (frame) => { if (frame === page.mainFrame()) navegaciones++; });
  await modificar(page, "PATCH", `/api/notificaciones/${avisos.reciente.id}`, () => fila(page, avisos.reciente).getByRole("button", { name: "Marcar como leída", exact: true }).click());
  await contador(page, 1);
  await modificar(page, "DELETE", `/api/notificaciones/${avisos.antiguo.id}`, () => fila(page, avisos.antiguo).getByRole("button", { name: "Borrar notificación", exact: true }).click());
  await contador(page, 0);
  expect(page.url()).toBe(url);
  expect(navegaciones).toBe(0);
});

test("CP-29.2-07: la barra tiene campana y contador y abre las notificaciones", async ({ page, usuariosAdministrativos, avisos, backend }) => {
  await backend.orm.public.Notificacion.where({ id: avisos.leido.id }).update({ vista: false });
  await ingresar(page, usuariosAdministrativos.productor);
  await contador(page, 3);
  await cuenta(page).click();
  const acceso = page.getByRole("menuitem", { name: "Notificaciones", exact: true });
  await expect(acceso).toHaveAttribute("href", "/notificaciones");
  await expect(acceso).toHaveAccessibleDescription("3 notificaciones sin leer");
  await expect(acceso.locator("svg")).toHaveCount(1);
  await expect(acceso.locator("span[aria-hidden='true']")).toHaveText("3");
  await acceso.click();
  await expect(page).toHaveURL(/\/notificaciones$/, { timeout: 30_000 });
  await expect(filas(page)).toHaveCount(3, { timeout: 30_000 });
  await expect(cuenta(page)).toHaveAttribute("aria-expanded", "false");
});

test("CP-29.2-08: la lista muestra mensaje y fecha de más reciente a más antigua", async ({ page, usuariosAdministrativos, avisos }) => {
  await ingresar(page, usuariosAdministrativos.productor);
  await cargar(page);
  const orden = [avisos.reciente, avisos.leido, avisos.antiguo];
  await expect(filas(page)).toHaveCount(3);
  const formato = new Intl.DateTimeFormat("es-UY", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Montevideo" });
  for (const [indice, aviso] of orden.entries()) {
    const elemento = filas(page).nth(indice);
    await expect(elemento.getByRole("button", { name: aviso.texto, exact: true })).toBeVisible();
    const fecha = elemento.locator("time");
    await expect(fecha).toHaveText(formato.format(new Date(aviso.fecha)));
    expect(Date.parse(await fecha.getAttribute("datetime") ?? "")).toBe(Date.parse(aviso.fecha));
  }
});

test("CP-29.2-09: el tilde marca como leída y reduce el contador", async ({ page, usuariosAdministrativos, avisos }) => {
  await ingresar(page, usuariosAdministrativos.productor);
  await cargar(page);
  await modificar(page, "PATCH", `/api/notificaciones/${avisos.reciente.id}`, () => fila(page, avisos.reciente).getByRole("button", { name: "Marcar como leída", exact: true }).click());
  await expect(fila(page, avisos.reciente)).toHaveAttribute("data-leida", "true");
  await expect(fila(page, avisos.reciente).getByRole("button", { name: "Notificación leída", exact: true })).toBeDisabled();
  await contador(page, 1);
  expect((await consultar(page)).notificaciones.find(({ id }) => id === avisos.reciente.id)?.leida).toBe(true);
});

test("CP-29.2-11: la papelera quita el aviso de la lista y actualiza el contador", async ({ page, usuariosAdministrativos, avisos }) => {
  await ingresar(page, usuariosAdministrativos.productor);
  await cargar(page);
  await modificar(page, "DELETE", `/api/notificaciones/${avisos.reciente.id}`, () => fila(page, avisos.reciente).getByRole("button", { name: "Borrar notificación", exact: true }).click());
  await expect(fila(page, avisos.reciente)).toHaveCount(0);
  await expect(filas(page)).toHaveCount(2);
  await contador(page, 1);
  expect((await consultar(page)).notificaciones.map(({ id }) => id)).not.toContain(avisos.reciente.id);
});

test("CP-29.2-12: leer todo deja todas leídas y elimina el contador", async ({ page, usuariosAdministrativos, avisos }) => {
  expect(avisos.leido.leida).toBe(true);
  await ingresar(page, usuariosAdministrativos.productor);
  await cargar(page);
  await modificar(page, "PATCH", "/api/notificaciones", () => page.getByRole("button", { name: "Leer todo", exact: true }).click());
  await expect(page.getByRole("button", { name: "Notificación leída", exact: true })).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Leer todo", exact: true })).toBeDisabled();
  await contador(page, 0);
  const guardadas = await consultar(page);
  expect(guardadas.notificaciones).toHaveLength(3);
  expect(guardadas.notificaciones.every(({ leida }) => leida)).toBe(true);
});

test("CP-29.2-13: borrar todo deja el mensaje de lista vacía", async ({ page, usuariosAdministrativos, avisos }) => {
  expect(avisos.usuarioId).toBeGreaterThan(0);
  await ingresar(page, usuariosAdministrativos.productor);
  await cargar(page);
  await page.getByRole("button", { name: "Borrar todo", exact: true }).click();
  const dialogo = page.getByRole("alertdialog", { name: "Borrar todas las notificaciones" });
  await expect(dialogo).toBeVisible();
  await modificar(page, "DELETE", "/api/notificaciones", () => dialogo.getByRole("button", { name: "Sí, borrar todas", exact: true }).click());
  await expect(page.getByRole("heading", { name: "No tenés notificaciones", exact: true })).toBeVisible();
  await expect(page.getByRole("list", { name: "Notificaciones recibidas" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Borrar todo", exact: true })).toBeDisabled();
  await contador(page, 0);
  expect(await consultar(page)).toEqual({ notificaciones: [], noLeidas: 0 });
});
