import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { expect as expectBase, type Page } from "@playwright/test";
import { test as base } from "./precarga-operadores";
import { iniciarSesionAdministrador, type Credenciales } from "./autenticacion";
import type { NotificacionesUsuario } from "../src/modulos/notificaciones/tipos";

const tiempoServidor = 60_000;
const expect = expectBase.configure({ timeout: tiempoServidor });

type Rol = "OPERADOR" | "PRODUCTOR";
type Foto = { id: number; clave: string; url: string; especie: string; rol: Rol; credenciales: Credenciales };
type Backend = typeof import("../src/infraestructura/persistencia/prisma/db").db;
type Escenario = {
  crearFoto: (rol: Rol) => Promise<Foto>;
  procesar: (rol: Rol) => Promise<number>;
  productorB: Credenciales;
};

const configuracionInicial = {
  aging_fotos_habilitado: "true",
  vigencia_fotos: "30",
  aviso_vencimiento_fotos_habilitado: "true",
  anticipacion_aviso_fotos: "1",
  aging_fotos_productor_habilitado: "true",
  vigencia_fotos_productor: "30",
  aviso_vencimiento_fotos_productor_habilitado: "true",
  anticipacion_aviso_fotos_productor: "1",
};

const test = base.extend<{ aging: Escenario }, { backend: Backend }>({
  backend: [async ({}, usar) => {
    const { db } = await import("../src/infraestructura/persistencia/prisma/db");
    try { await usar(db); } finally { await db.close(); }
  }, { scope: "worker" }],
  aging: async ({ precargaOperadores: datos, backend: db }, usar) => {
    const cliente = new Client({ connectionString: process.env.DATABASE_URL });
    await cliente.connect();
    const fotos: Foto[] = [];
    const especies: number[] = [];
    const publicaciones: number[] = [];
    let segundoUsuarioId: number | undefined;
    try {
      await cliente.query("SELECT pg_advisory_lock(1753, 13)");
      const { rows: originales } = await cliente.query<{ nombreConfiguracion: string; valorConfiguracion: string }>(
        'SELECT "nombreConfiguracion", "valorConfiguracion" FROM configuracion WHERE "nombreConfiguracion" = ANY($1::text[])',
        [Object.keys(configuracionInicial)],
      );
      expect(originales).toHaveLength(8);
      try {
        for (const [nombre, valor] of Object.entries(configuracionInicial)) {
          await db.orm.public.Configuracion.where({ nombreConfiguracion: nombre }).update({ valorConfiguracion: valor });
        }
        const usuario = await db.orm.public.Usuario.where({ username: datos.productor.usuario }).first();
        expect(usuario).not.toBeNull();
        const productor = await db.orm.public.Productor.where({ usuarioId: usuario!.id }).first();
        expect(productor).not.toBeNull();
        const segundo = await db.orm.public.Usuario.create({
          username: `e2e_bp131_${randomUUID()}`, passwordHash: usuario!.passwordHash, rol: "PRODUCTOR", twoFactorEnabled: false,
        });
        segundoUsuarioId = segundo.id;
        await db.orm.public.Productor.create({ usuarioId: segundo.id, nombreFantasia: segundo.username, whatsApp: "+59899123456" });

        await usar({
          productorB: { usuario: segundo.username, contrasena: datos.productor.contrasena },
          crearFoto: async (rol) => {
            const especie = await db.orm.public.Especie.create({ nombreEspecie: `BP13 ${randomUUID()}` });
            especies.push(especie.id);
            const publicacion = await db.orm.public.Publicacion.create({
              especieId: especie.id, tipoPublicacion: rol, publicacionActiva: true, publicacionDisponible: true, cantidadUnidades: 12,
            });
            publicaciones.push(publicacion.id);
            if (rol === "OPERADOR") {
              await db.orm.public.PublicacionOperador.create({ publicacionId: publicacion.id, operadorId: datos.operadorA.id });
            } else {
              await db.orm.public.PublicacionProductor.create({ publicacionId: publicacion.id, productorId: productor!.id });
            }
            const archivo = `${randomUUID()}.webp`;
            const foto: Foto = {
              id: publicacion.id, clave: `publicaciones/${publicacion.id}/${archivo}`,
              url: `/api/publicaciones/imagenes/${publicacion.id}/${archivo}`, especie: especie.nombreEspecie, rol,
              credenciales: rol === "OPERADOR" ? datos.operadorA.credenciales : datos.productor,
            };
            fotos.push(foto);
            const sharp = (await import("sharp")).default;
            const contenido = await sharp({ create: { width: 8, height: 8, channels: 3, background: "green" } }).webp().toBuffer();
            // Reloj histórico como BP-29: no vence ninguna foto actual de la base.
            await db.orm.public.Imagen.create({ clave: foto.clave, contenido, cargadaEn: Temporal.Instant.from("1900-01-15T15:00:00Z") });
            await db.orm.public.Publicacion.where({ id: foto.id }).update({ foto: foto.url });
            return foto;
          },
          procesar: async (rol) => {
            const { obtenerConfiguracionAgingFotos } = await import("../src/modulos/publicaciones/configuracion-aging-fotos");
            const { procesarVencimientosFotos } = await import("../src/modulos/publicaciones/procesar-vencimientos-fotos");
            const configuracion = await obtenerConfiguracionAgingFotos(rol);
            return db.transaction(async (tx) => {
              await tx.execute(db.raw.sql`LOCK TABLE imagen, publicacion IN SHARE ROW EXCLUSIVE MODE`.affectedCount().build());
              const historicas = await tx.query(db.raw.sql`SELECT clave FROM imagen WHERE "cargadaEn" <= '1900-02-01T15:00:00Z'::timestamptz`.returnsRow({ clave: "pg/text@1" }).build());
              if (historicas.some(({ clave }) => !fotos.some((foto) => foto.clave === clave))) {
                throw new Error("Hay fotos históricas ajenas a BP-13.1; se revierte el aging.");
              }
              const sinFecha = await tx.orm.public.Imagen.where({ cargadaEn: null }).select("clave").all();
              const cantidad = await procesarVencimientosFotos({ tx, limite: "1900-02-01T15:00:00Z", fecha: "1900-02-01" }, configuracion, rol);
              for (const { clave } of sinFecha) await tx.orm.public.Imagen.where({ clave }).update({ cargadaEn: null });
              return cantidad;
            });
          },
        });
      } finally {
        for (const id of publicaciones) await db.orm.public.Publicacion.where({ id }).deleteAndCount();
        for (const foto of fotos) await db.orm.public.Imagen.where({ clave: foto.clave }).deleteAndCount();
        for (const id of especies) await db.orm.public.Especie.where({ id }).deleteAndCount();
        if (segundoUsuarioId !== undefined) await db.orm.public.Usuario.where({ id: segundoUsuarioId }).deleteAndCount();
        for (const original of originales) {
          await db.orm.public.Configuracion.where({ nombreConfiguracion: original.nombreConfiguracion }).update({ valorConfiguracion: original.valorConfiguracion });
        }
      }
    } finally { await cliente.end(); }
  },
});

test.describe.configure({ mode: "default" });
test.beforeEach(({ page }) => {
  test.setTimeout(300_000);
  page.setDefaultTimeout(tiempoServidor);
  page.setDefaultNavigationTimeout(tiempoServidor);
});
test.use({ viewport: { width: 1280, height: 900 } });

async function ingresar(page: Page, credenciales: Credenciales) {
  await page.context().clearCookies();
  await page.goto("/iniciar-sesion");
  await page.getByLabel("Correo electrónico o nombre de usuario").fill(credenciales.usuario);
  await page.getByLabel("Contraseña", { exact: true }).fill(credenciales.contrasena);
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/mi-mercado" || url.pathname.startsWith("/mi-mercado/"));
  await expect(page.getByRole("heading", { name: "Mi Mercado", exact: true, level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Abrir menú de usuario", exact: true })).toBeVisible();
}

async function configurar(page: Page, valores: { dias?: string; habilitado?: boolean }, rol: Rol = "OPERADOR") {
  await page.getByRole("button", { name: "General", exact: true }).click();
  const titulo = rol === "OPERADOR" ? "Vigencia de fotos de operadores" : "Vigencia de fotos de productores";
  const tarjeta = page.getByText(titulo, { exact: true }).locator("..");
  if (valores.habilitado !== undefined) await tarjeta.getByRole("switch", { name: "Vencimiento de fotos", exact: true }).setChecked(valores.habilitado);
  if (valores.dias !== undefined) await tarjeta.getByRole("textbox", { name: "Días de vigencia", exact: true }).fill(valores.dias);
  const [respuesta] = await Promise.all([
    page.waitForResponse((respuesta) => new URL(respuesta.url()).pathname === "/administracion"
      && respuesta.request().method() === "POST" && respuesta.request().headers()["next-action"] !== undefined),
    tarjeta.getByRole("button", { name: `Guardar configuración: ${titulo}`, exact: true }).click(),
  ]);
  expect(respuesta.ok(), "El guardado de la vigencia debe responder correctamente").toBe(true);
  await expect(tarjeta.getByRole("switch", { name: "Vencimiento de fotos", exact: true })).toBeEnabled();
  await expect(page.getByRole("status").filter({ hasText: "La configuración de vigencia se guardó correctamente." })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "General", exact: true }).click();
  if (valores.dias !== undefined) await expect(tarjeta.getByRole("textbox", { name: "Días de vigencia", exact: true })).toHaveValue(valores.dias);
  if (valores.habilitado === false) await expect(tarjeta.getByRole("switch", { name: "Vencimiento de fotos", exact: true })).not.toBeChecked();
}

async function verFoto(page: Page, foto: Foto, eliminada: boolean) {
  await page.goto(foto.rol === "OPERADOR" ? "/mi-mercado" : "/mi-mercado/productor");
  const tarjeta = page.getByRole("button", { name: `Ver detalle de ${foto.especie}`, exact: true }).first();
  await expect(tarjeta).toBeVisible();
  if (eliminada) {
    await expect(tarjeta.getByText("Sin fotografía", { exact: true })).toBeVisible();
    await expect(tarjeta.getByRole("img", { name: foto.especie, exact: true })).toHaveCount(0);
  } else {
    const imagen = tarjeta.getByRole("img", { name: foto.especie, exact: true });
    await expect.poll(async () => new URL((await imagen.getAttribute("src")) ?? "", page.url()).pathname).toBe(foto.url);
    await expect(imagen).toBeVisible();
    await expect.poll(() => imagen.evaluate((elemento: HTMLImageElement) => elemento.complete && elemento.naturalWidth > 0)).toBe(true);
  }
}

async function verAvisos(page: Page, foto: Foto, presente: boolean) {
  await page.getByRole("button", { name: "Abrir menú de usuario", exact: true }).click();
  const [respuesta] = await Promise.all([
    page.waitForResponse((respuesta) => new URL(respuesta.url()).pathname === "/api/notificaciones" && respuesta.request().method() === "GET"),
    page.getByRole("menuitem", { name: "Notificaciones", exact: true }).click(),
  ]);
  expect(respuesta.status()).toBe(200);
  await expect(page).toHaveURL(/\/notificaciones$/);
  await expect(page.getByRole("region", { name: "Tus notificaciones", exact: true })).toHaveAttribute("aria-busy", "false");
  const datos = await respuesta.json() as NotificacionesUsuario;
  const texto = `La foto de tu publicación de ${foto.especie} venció y fue eliminada. Podés cargar una nueva foto.`;
  const fila = page.getByRole("list", { name: "Notificaciones recibidas" }).getByRole("listitem").filter({ hasText: texto });
  if (presente) {
    await expect(fila).toBeVisible();
    expect(datos.notificaciones).toEqual([expect.objectContaining({ texto, leida: false, url: `${foto.rol === "OPERADOR" ? "/mi-mercado" : "/mi-mercado/productor"}?publicacion=${foto.id}` })]);
  } else {
    await expect(fila).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "No tenés notificaciones", exact: true })).toBeVisible();
    expect(datos).toEqual({ notificaciones: [], noLeidas: 0 });
  }
}

for (const [caso, rol] of [["01", "OPERADOR"], ["02", "PRODUCTOR"]] as const) {
  test(`CP-13.1-${caso}: la foto vencida del ${rol.toLowerCase()} se elimina y se notifica`, async ({ page, aging, precargaOperadores }) => {
    const foto = await aging.crearFoto(rol);
    await iniciarSesionAdministrador(page, precargaOperadores.administrador, tiempoServidor);
    await configurar(page, { dias: "10" });
    await ingresar(page, foto.credenciales);
    await verFoto(page, foto, false);
    expect(await aging.procesar(rol)).toBe(1);
    await verFoto(page, foto, true);
    await verAvisos(page, foto, true);
  });
}

test("CP-13.1-04: reducir la vigencia desde Administración aplica el nuevo plazo", async ({ page, aging, precargaOperadores }) => {
  const foto = await aging.crearFoto("OPERADOR");
  expect(await aging.procesar("OPERADOR")).toBe(0);
  await ingresar(page, foto.credenciales);
  await verFoto(page, foto, false);
  await verAvisos(page, foto, false);
  await page.context().clearCookies();
  await iniciarSesionAdministrador(page, precargaOperadores.administrador, tiempoServidor);
  await configurar(page, { dias: "10" });
  expect(await aging.procesar("OPERADOR")).toBe(1);
  await ingresar(page, foto.credenciales);
  await verFoto(page, foto, true);
  await verAvisos(page, foto, true);
});

test("CP-13.1-05: deshabilitar aging conserva las fotos vencidas y no genera avisos", async ({ page, aging, precargaOperadores }) => {
  await iniciarSesionAdministrador(page, precargaOperadores.administrador, tiempoServidor);
  await configurar(page, { dias: "10" });
  for (const rol of ["OPERADOR", "PRODUCTOR"] as const) await configurar(page, { habilitado: false }, rol);
  const fotos = [await aging.crearFoto("OPERADOR"), await aging.crearFoto("PRODUCTOR")];
  for (const rol of ["OPERADOR", "PRODUCTOR"] as const) expect(await aging.procesar(rol)).toBe(0);
  for (const foto of fotos) {
    await ingresar(page, foto.credenciales);
    await verFoto(page, foto, false);
    await verAvisos(page, foto, false);
  }
});

for (const [caso, rol] of [["09", "OPERADOR"], ["10", "PRODUCTOR"]] as const) {
  test(`CP-13.1-${caso}: solo el dueño ${rol.toLowerCase()} ve el aviso de su foto`, async ({ page, aging, precargaOperadores: datos }) => {
    const foto = await aging.crearFoto(rol);
    await iniciarSesionAdministrador(page, datos.administrador, tiempoServidor);
    await configurar(page, { dias: "10" });
    expect(await aging.procesar(rol)).toBe(1);
    await ingresar(page, foto.credenciales);
    await verAvisos(page, foto, true);
    const ajenos = rol === "OPERADOR" ? [datos.operadorB.credenciales, datos.productor] : [aging.productorB, datos.operadorA.credenciales];
    for (const credenciales of ajenos) {
      await ingresar(page, credenciales);
      await verAvisos(page, foto, false);
    }
  });
}
