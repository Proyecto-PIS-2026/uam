import { randomUUID } from "node:crypto";
import { setTimeout as esperar } from "node:timers/promises";
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
  procesar: (limite?: string) => Promise<number>;
  productorB: Credenciales;
};

const configuracionInicial = {
  aging_fotos_habilitado: "true",
  vigencia_fotos: "30",
  aviso_vencimiento_fotos_habilitado: "true",
  anticipacion_aviso_fotos: "7",
};

const test = base.extend<{ aging: Escenario }, { backend: Backend }>({
  backend: [async ({}, usar) => {
    const { db } = await import("../src/infraestructura/persistencia/prisma/db");
    try { await usar(db); } finally { await db.close(); }
  }, { scope: "worker" }],
  aging: async ({ precargaOperadores: datos, backend: db }, usar) => {
    const cliente = new Client({ connectionString: process.env.DATABASE_URL });
    await cliente.connect();
    const especies: number[] = [];
    const claves = new Set<string>();
    const publicaciones: number[] = [];
    let segundoUsuarioId: number | undefined;
    try {
      await cliente.query("SELECT pg_advisory_lock(1753, 13)");
      const { rows: originales } = await cliente.query<{ nombreConfiguracion: string; valorConfiguracion: string }>(
        'SELECT "nombreConfiguracion", "valorConfiguracion" FROM configuracion WHERE "nombreConfiguracion" = ANY($1::text[])',
        [Object.keys(configuracionInicial)],
      );
      expect(originales).toHaveLength(4);
      try {
        for (const [nombre, valor] of Object.entries(configuracionInicial)) {
          await db.orm.public.Configuracion.where({ nombreConfiguracion: nombre }).update({ valorConfiguracion: valor });
        }
        const usuario = await db.orm.public.Usuario.where({ username: datos.productor.usuario }).first();
        expect(usuario).not.toBeNull();
        const productor = await db.orm.public.Productor.where({ usuarioId: usuario!.id }).first();
        expect(productor).not.toBeNull();
        const segundo = await db.orm.public.Usuario.create({
          username: `e2e_bp132_${randomUUID()}`, passwordHash: usuario!.passwordHash, rol: "PRODUCTOR", twoFactorEnabled: false,
        });
        segundoUsuarioId = segundo.id;
        await db.orm.public.Productor.create({ usuarioId: segundo.id, nombreFantasia: segundo.username, whatsApp: "+59899123456" });

        await usar({
          productorB: { usuario: segundo.username, contrasena: datos.productor.contrasena },
          crearFoto: async (rol) => {
            const especie = await db.orm.public.Especie.create({ nombreEspecie: `BP132 ${randomUUID()}` });
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
            claves.add(foto.clave);
            const sharp = (await import("sharp")).default;
            const contenido = await sharp({ create: { width: 8, height: 8, channels: 3, background: "green" } }).webp().toBuffer();
            await db.orm.public.Imagen.create({ clave: foto.clave, contenido, cargadaEn: Temporal.Instant.from("1900-01-15T15:00:00Z") });
            await db.orm.public.Publicacion.where({ id: foto.id }).update({ foto: foto.url });
            return foto;
          },
          procesar: async (limite = "1900-02-10T15:00:00Z") => {
            const { obtenerConfiguracionAgingFotos } = await import("../src/modulos/publicaciones/configuracion-aging-fotos");
            const { procesarVencimientosFotos } = await import("../src/modulos/publicaciones/procesar-vencimientos-fotos");
            const configuracion = await obtenerConfiguracionAgingFotos();
            return db.transaction(async (tx) => {
              await tx.execute(db.raw.sql`LOCK TABLE imagen, publicacion IN SHARE ROW EXCLUSIVE MODE`.affectedCount().build());
              for (const id of publicaciones) {
                const publicacion = await tx.orm.public.Publicacion.where({ id }).select("foto").first();
                if (publicacion?.foto) claves.add(publicacion.foto.replace("/api/publicaciones/imagenes/", "publicaciones/"));
              }
              const historicas = await tx.query(db.raw.sql`SELECT clave FROM imagen WHERE "cargadaEn" <= ${limite}::timestamptz`.returnsRow({ clave: "pg/text@1" }).build());
              if (historicas.some(({ clave }) => !claves.has(clave))) {
                throw new Error("Hay fotos históricas ajenas a BP-13.2; se revierte el aging.");
              }
              const sinFecha = await tx.orm.public.Imagen.where({ cargadaEn: null }).select("clave").all();
              const cantidad = await procesarVencimientosFotos({ tx, limite, fecha: limite.slice(0, 10) }, configuracion);
              for (const { clave } of sinFecha) await tx.orm.public.Imagen.where({ clave }).update({ cargadaEn: null });
              return cantidad;
            });
          },
        });
      } finally {
        for (const id of publicaciones) {
          const publicacion = await db.orm.public.Publicacion.where({ id }).select("foto").first();
          if (publicacion?.foto) claves.add(publicacion.foto.replace("/api/publicaciones/imagenes/", "publicaciones/"));
          await db.orm.public.Publicacion.where({ id }).deleteAndCount();
        }
        for (const clave of claves) await db.orm.public.Imagen.where({ clave }).deleteAndCount();
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
  for (let intento = 0; ; intento++) {
    try {
      await page.goto("/iniciar-sesion");
      break;
    } catch (error) {
      if (intento === 3 || !(error instanceof Error) || !error.message.includes("ERR_CONNECTION_REFUSED")) throw error;
      await esperar(2_000);
    }
  }
  await page.getByLabel("Correo electrónico o nombre de usuario").fill(credenciales.usuario);
  await page.getByLabel("Contraseña", { exact: true }).fill(credenciales.contrasena);
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/mi-mercado" || url.pathname.startsWith("/mi-mercado/"));
  await expect(page.getByRole("heading", { name: "Mi Mercado", exact: true, level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Abrir menú de usuario", exact: true })).toBeVisible();
}

async function configurar(page: Page, valores: { anticipacion?: string; habilitado?: boolean }) {
  await page.getByRole("button", { name: "General", exact: true }).click();
  const tarjeta = page.getByText("Vigencia de las fotos", { exact: true }).locator("..");
  if (valores.habilitado !== undefined) await tarjeta.getByRole("switch", { name: "Vencimiento de fotos", exact: true }).setChecked(valores.habilitado);
  if (valores.anticipacion !== undefined) await tarjeta.getByRole("textbox", { name: "Días de anticipación del aviso", exact: true }).fill(valores.anticipacion);
  const [respuesta] = await Promise.all([
    page.waitForResponse((respuesta) => new URL(respuesta.url()).pathname === "/administracion"
      && respuesta.request().method() === "POST" && respuesta.request().headers()["next-action"] !== undefined),
    tarjeta.getByRole("button", { name: "Guardar configuración: Vigencia de las fotos", exact: true }).click(),
  ]);
  expect(respuesta.ok(), "El guardado de la vigencia debe responder correctamente").toBe(true);
  await expect(tarjeta.getByRole("switch", { name: "Vencimiento de fotos", exact: true })).toBeEnabled();
  await expect(page.getByRole("status").filter({ hasText: "La configuración de vigencia se guardó correctamente." })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "General", exact: true }).click();
  if (valores.anticipacion !== undefined) await expect(tarjeta.getByRole("textbox", { name: "Días de anticipación del aviso", exact: true })).toHaveValue(valores.anticipacion);
  if (valores.habilitado === false) await expect(tarjeta.getByRole("switch", { name: "Vencimiento de fotos", exact: true })).not.toBeChecked();
}

async function verFoto(page: Page, foto: Foto) {
  await page.goto(foto.rol === "OPERADOR" ? "/mi-mercado" : "/mi-mercado/productor");
  const tarjeta = page.getByRole("button", { name: `Ver detalle de ${foto.especie}`, exact: true }).first();
  await expect(tarjeta).toBeVisible();
  const imagen = tarjeta.getByRole("img", { name: foto.especie, exact: true });
  await expect.poll(async () => new URL((await imagen.getAttribute("src")) ?? "", page.url()).pathname).toBe(foto.url);
  await expect(imagen).toBeVisible();
  await expect.poll(() => imagen.evaluate((elemento: HTMLImageElement) => elemento.complete && elemento.naturalWidth > 0)).toBe(true);
}

async function verAvisos(page: Page, foto: Foto, fechas: string[]) {
  await page.getByRole("button", { name: "Abrir menú de usuario", exact: true }).click();
  const [respuesta] = await Promise.all([
    page.waitForResponse((respuesta) => new URL(respuesta.url()).pathname === "/api/notificaciones" && respuesta.request().method() === "GET"),
    page.getByRole("menuitem", { name: "Notificaciones", exact: true }).click(),
  ]);
  expect(respuesta.status()).toBe(200);
  await expect(page).toHaveURL(/\/notificaciones$/);
  await expect(page.getByRole("region", { name: "Tus notificaciones", exact: true })).toHaveAttribute("aria-busy", "false");
  const datos = await respuesta.json() as NotificacionesUsuario;
  const textos = fechas.map((fecha) => `La foto de tu publicación de ${foto.especie} vence el ${fecha}. Podés reemplazarla para renovar su vigencia.`);
  if (fechas.length) {
    expect(datos.notificaciones).toHaveLength(fechas.length);
    expect(datos.notificaciones.map(({ texto }) => texto).sort()).toEqual([...textos].sort());
    for (const texto of textos) {
      const fila = page.getByRole("list", { name: "Notificaciones recibidas" }).getByRole("listitem").filter({ hasText: texto });
      await expect(fila).toBeVisible();
      expect(datos.notificaciones).toContainEqual(expect.objectContaining({ texto, url: `${foto.rol === "OPERADOR" ? "/mi-mercado" : "/mi-mercado/productor"}?publicacion=${foto.id}` }));
    }
  } else {
    await expect(page.getByRole("heading", { name: "No tenés notificaciones", exact: true })).toBeVisible();
    expect(datos).toEqual({ notificaciones: [], noLeidas: 0 });
  }
  return datos;
}

async function comprobarFotoConservada(db: Backend, foto: Foto) {
  expect(await db.orm.public.Publicacion.where({ id: foto.id }).select("foto", "fotoEliminadaPorVencimientoEn").first())
    .toEqual({ foto: foto.url, fotoEliminadaPorVencimientoEn: null });
  expect(await db.orm.public.Imagen.where({ clave: foto.clave }).first()).not.toBeNull();
}

for (const [caso, rol] of [["01", "OPERADOR"], ["02", "PRODUCTOR"]] as const) {
  test(`CP-13.2-${caso}: avisa al ${rol.toLowerCase()} que la foto está próxima a vencer sin eliminarla`, async ({ page, aging, backend }) => {
    const foto = await aging.crearFoto(rol);
    expect(await aging.procesar()).toBe(1);
    await ingresar(page, foto.credenciales);
    await verAvisos(page, foto, ["14/02/1900"]);
    await verFoto(page, foto);
    await comprobarFotoConservada(backend, foto);
  });
}

test("CP-13.2-04: ampliar la anticipación desde Administración usa el nuevo plazo", async ({ page, aging, backend, precargaOperadores }) => {
  const foto = await aging.crearFoto("OPERADOR");
  const limite = "1900-02-05T15:00:00Z";
  expect(await aging.procesar(limite)).toBe(0);
  await ingresar(page, foto.credenciales);
  await verAvisos(page, foto, []);
  await page.context().clearCookies();
  await iniciarSesionAdministrador(page, precargaOperadores.administrador, tiempoServidor);
  await configurar(page, { anticipacion: "10" });
  expect(await aging.procesar(limite)).toBe(1);
  await ingresar(page, foto.credenciales);
  await verAvisos(page, foto, ["14/02/1900"]);
  await verFoto(page, foto);
  await comprobarFotoConservada(backend, foto);
});

test("CP-13.2-05: con aging deshabilitado no hay avisos y se conservan ambas fotos", async ({ page, aging, backend, precargaOperadores }) => {
  await iniciarSesionAdministrador(page, precargaOperadores.administrador, tiempoServidor);
  await configurar(page, { habilitado: false });
  const fotos = [await aging.crearFoto("OPERADOR"), await aging.crearFoto("PRODUCTOR")];
  expect(await aging.procesar()).toBe(0);
  for (const foto of fotos) {
    await ingresar(page, foto.credenciales);
    await verAvisos(page, foto, []);
    await verFoto(page, foto);
    await comprobarFotoConservada(backend, foto);
    expect((await backend.orm.public.Imagen.where({ clave: foto.clave }).first())!.avisoVencimientoEn).toBeNull();
  }
});

for (const [caso, rol] of [["06", "OPERADOR"], ["07", "PRODUCTOR"]] as const) {
  test(`CP-13.2-${caso}: reemplazar la foto del ${rol.toLowerCase()} inicia una nueva vigencia`, async ({ page, aging, backend }, informacion) => {
    const foto = await aging.crearFoto(rol);
    expect(await aging.procesar()).toBe(1);
    await ingresar(page, foto.credenciales);
    const avisosAnteriores = await verAvisos(page, foto, ["14/02/1900"]);
    await verFoto(page, foto);
    await page.getByRole("button", { name: `Ver detalle de ${foto.especie}`, exact: true }).first().click();
    const consulta = page.getByRole("dialog", { name: "Consulta de publicación", exact: true });
    await consulta.getByRole("button", { name: "Editar", exact: true }).click();
    const edicion = page.getByRole("dialog", { name: "Editar publicación", exact: true });
    const sharp = (await import("sharp")).default;
    const buffer = await sharp({ create: { width: 80, height: 80, channels: 3, background: "blue" } }).png().toBuffer();
    const antesDeGuardar = Date.now();
    await edicion.getByLabel(rol === "OPERADOR" ? "Seleccionar foto del producto" : "Fotografía", { exact: true })
      .setInputFiles({ name: "foto-renovada.png", mimeType: "image/png", buffer });
    const guardar = edicion.getByRole("button", { name: rol === "OPERADOR" ? "Guardar" : "Confirmar", exact: true });
    await expect(guardar).toBeEnabled();
    const [respuesta] = await Promise.all([
      page.waitForResponse((respuesta) => respuesta.request().method() === "PATCH" && new URL(respuesta.url()).pathname.startsWith("/api/publicaciones/")),
      guardar.click(),
    ]);
    expect(respuesta.status()).toBe(200);
    await expect(consulta).toBeVisible();
    const publicacion = await backend.orm.public.Publicacion.where({ id: foto.id }).first();
    expect(publicacion?.foto).toBeTruthy();
    expect(publicacion!.foto).not.toBe(foto.url);
    const nueva: Foto = { ...foto, url: publicacion!.foto!, clave: publicacion!.foto!.replace("/api/publicaciones/imagenes/", "publicaciones/") };
    const imagen = await backend.orm.public.Imagen.where({ clave: nueva.clave }).first();
    expect(imagen?.cargadaEn).not.toBeNull();
    const cargadaEn = Date.parse(imagen!.cargadaEn!.toString());
    expect(cargadaEn).toBeGreaterThanOrEqual(antesDeGuardar);
    expect(cargadaEn).toBeLessThanOrEqual(Date.now());
    expect(imagen!.avisoVencimientoEn).toBeNull();
    await consulta.getByRole("button", { name: "Cerrar consulta", exact: true }).click();
    await verFoto(page, nueva);

    informacion.annotations.push({ type: "reloj", description: "Reemplazo real por UI; fecha de carga verificada y luego trasladada al 10/02/1900 para avanzar el aging de forma aislada." });
    await backend.orm.public.Imagen.where({ clave: nueva.clave }).update({ cargadaEn: Temporal.Instant.from("1900-02-10T15:00:00Z") });
    for (const limite of ["1900-02-10T15:00:00Z", "1900-03-03T15:00:00Z"]) {
      expect(await aging.procesar(limite)).toBe(0);
      await comprobarFotoConservada(backend, nueva);
      expect((await backend.orm.public.Imagen.where({ clave: nueva.clave }).first())!.avisoVencimientoEn).toBeNull();
    }
    const sinNuevoAviso = await verAvisos(page, nueva, ["14/02/1900"]);
    expect(sinNuevoAviso).toEqual(avisosAnteriores);
    expect(await aging.procesar("1900-03-06T15:00:00Z")).toBe(1);
    await verFoto(page, nueva);
    await comprobarFotoConservada(backend, nueva);
    await verAvisos(page, nueva, ["14/02/1900", "12/03/1900"]);
  });
}

for (const [caso, rol] of [["09", "OPERADOR"], ["10", "PRODUCTOR"]] as const) {
  test(`CP-13.2-${caso}: solo el dueño ${rol.toLowerCase()} ve el aviso de próximo vencimiento`, async ({ page, aging, precargaOperadores: datos }) => {
    const foto = await aging.crearFoto(rol);
    expect(await aging.procesar()).toBe(1);
    await ingresar(page, foto.credenciales);
    await verAvisos(page, foto, ["14/02/1900"]);
    const ajenos = rol === "OPERADOR" ? [datos.operadorB.credenciales, datos.productor] : [aging.productorB, datos.operadorA.credenciales];
    for (const credenciales of ajenos) {
      await ingresar(page, credenciales);
      await verAvisos(page, foto, []);
    }
  });
}
