import { completarFecha, esperarFecha } from "./soporte/fechas";
import { expect as baseExpect, type Page } from "@playwright/test";
import sharp from "sharp";
import { test as base, type OperadorPrecarga } from "./precarga-operadores";
import type { Credenciales } from "./autenticacion";

// Guardar el perfil hace transacciones y procesa fotos: bajo carga supera los 5 s por defecto.
const expect = baseExpect.configure({ timeout: 15_000 });

/** Operador A de la precarga con la sesión iniciada en su perfil. */
const test = base.extend<{ operador: OperadorPrecarga }>({
  operador: async ({ page, precargaOperadores }, usar) => {
    const operador = precargaOperadores.operadorA;
    await iniciarSesion(page, operador.credenciales);
    await page.goto("/mi-perfil");
    await expect(page.getByRole("heading", { level: 1, name: operador.nombre, exact: true })).toBeVisible();
    await usar(operador);
  },
});

const TELEFONO_INICIAL = "+59899123456";
const MENSAJE_EXITO = "Perfil actualizado correctamente.";

async function iniciarSesion(page: Page, credenciales: Credenciales) {
  await page.goto("/iniciar-sesion");
  await page.getByLabel("Correo electrónico o nombre de usuario").fill(credenciales.usuario);
  await page.getByLabel("Contraseña", { exact: true }).fill(credenciales.contrasena);
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Mi Mercado", exact: true })).toBeVisible({ timeout: 30_000 });
}

const campoTelefono = (page: Page) => page.getByLabel(/^Teléfono(?:\s*\*)?$/);
const campoNombre = (page: Page) => page.getByLabel(/^Nombre(?:\s*\*)?$/);
const exito = (page: Page) => page.getByRole("status").filter({ hasText: MENSAJE_EXITO });
const errorNotificado = (page: Page) => page.getByRole("region", { name: "Notificaciones", exact: true }).getByRole("alert");

async function editar(page: Page) {
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Editar mi perfil", exact: true })).toBeVisible();
}

async function enviar(page: Page) {
  await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
}

async function guardar(page: Page) {
  await enviar(page);
  await expect(exito(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Editar", exact: true })).toBeVisible();
}

/** CA-12: el error se informa, no se confirma nada y la edición sigue abierta. */
async function esperarRechazo(page: Page, mensaje: string | RegExp, campo?: ReturnType<Page["getByLabel"]>) {
  if (campo) {
    await expect(page.getByRole("alert").filter({ hasText: mensaje })).toBeVisible();
    await expect(campo).toHaveAttribute("aria-invalid", "true");
  } else {
    await expect(errorNotificado(page)).toContainText(mensaje);
  }
  await expect(exito(page)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Editar mi perfil", exact: true })).toBeVisible();
}

function fechas() {
  const hoy = Temporal.Now.plainDateISO("America/Montevideo");
  return { inicio: hoy.toString(), fin: hoy.add({ days: 7 }).toString(), ayer: hoy.subtract({ days: 1 }).toString() };
}

const formatear = (fecha: string) => fecha.split("-").reverse().join("/");

async function completarLicencia(page: Page, inicio: string, fin: string, mensaje = "") {
  await editar(page);
  await page.getByRole("switch", { name: "En licencia", exact: true }).click();
  const aviso = page.getByRole("alertdialog", { name: "Aviso de licencia", exact: true });
  await expect(aviso).toBeVisible();
  await aviso.getByRole("button", { name: "Aceptar", exact: true }).click();
  await expect(aviso).not.toBeVisible();
  await expect(page.getByRole("switch", { name: "En licencia", exact: true })).toBeChecked();
  await completarFecha(page.getByRole("group", { name: /^Inicio de licencia(?:\s*\*)?$/ }), inicio);
  await completarFecha(page.getByRole("group", { name: /^Fin de licencia(?:\s*\*)?$/ }), fin);
  await page.getByLabel("Mensaje de recomendación", { exact: true }).fill(mensaje);
}

/** Vuelve al perfil desde cero y confirma que no se registró licencia. */
async function esperarSinLicencia(page: Page) {
  await page.goto("/mi-perfil");
  await expect(page.getByText("No hay licencia registrada.", { exact: true })).toBeVisible();
}

test.describe("BP-11.5: Modificación de mi perfil como Operador", () => {
  test.beforeEach(() => test.slow());

  test("CP-01 [CA-1] la edición carga los valores actuales", async ({ page, operador, precargaOperadores: { db } }) => {
    const { inicio, fin } = fechas();
    await db.orm.public.Operador.where({ id: operador.id }).update({
      fotoPerfil: "/Logo.PNG", enLicencia: true, comentario: `Licencia: ${inicio} - ${fin}\n\nCompren en el puesto de al lado.`,
    });
    await page.reload();
    await editar(page);
    await expect(campoNombre(page)).toHaveValue(operador.nombre);
    await expect(page.getByRole("combobox", { name: "Código de país" })).toContainText("+598 (Uruguay)");
    await expect(campoTelefono(page)).toHaveValue("99123456");
    await expect(page.getByRole("img", { name: "Vista previa de la foto de perfil" })).toHaveAttribute("src", /\/Logo\.PNG$/);
    await expect(page.getByRole("switch", { name: "En licencia", exact: true })).toBeChecked();
    await expect(page.getByRole("alertdialog", { name: "Aviso de licencia", exact: true })).toHaveCount(0);
    await esperarFecha(page.getByRole("group", { name: /^Inicio de licencia(?:\s*\*)?$/ }), inicio);
    await esperarFecha(page.getByRole("group", { name: /^Fin de licencia(?:\s*\*)?$/ }), fin);
    await expect(page.getByLabel("Mensaje de recomendación")).toHaveValue("Compren en el puesto de al lado.");
  });

  for (const [indice, caso] of [
    { titulo: "cargar un contacto sin número previo", inicial: "" },
    { titulo: "modificar el contacto registrado", inicial: TELEFONO_INICIAL },
  ].entries()) {
    test(`CP-0${2 + indice} [CA-2, CA-11] ${caso.titulo} y verificar persistencia`, async ({ page, operador, precargaOperadores: { db } }) => {
      await db.orm.public.Operador.where({ id: operador.id }).update({ whatsApp: caso.inicial });
      await page.reload();
      await editar(page);
      await expect(campoTelefono(page)).toHaveValue(caso.inicial.replace("+598", ""));
      // El cero inicial se descarta al normalizar el número.
      await campoTelefono(page).fill("099999999");
      await guardar(page);
      expect((await db.orm.public.Operador.where({ id: operador.id }).first())?.whatsApp).toBe("+59899999999");
      await page.reload();
      await expect(page.getByText("+59899999999", { exact: true })).toBeVisible();
      await editar(page);
      await expect(campoTelefono(page)).toHaveValue("99999999");
    });
  }

  test("CP-04 [CA-2, CA-12] el contacto es obligatorio: borrarlo se rechaza y conserva el registrado", async ({ page, operador, precargaOperadores: { db } }) => {
    // Desvío acordado con el cliente: el backlog dice "eliminar", la app lo exige.
    await editar(page);
    await expect(campoTelefono(page)).toHaveAttribute("required", "");
    await campoTelefono(page).clear();
    await enviar(page);
    await esperarRechazo(page, "Faltan completar campos obligatorios.", campoTelefono(page));
    expect((await db.orm.public.Operador.where({ id: operador.id }).first())?.whatsApp).toBe(TELEFONO_INICIAL);
    await page.goto("/mi-perfil");
    await expect(page.getByText(TELEFONO_INICIAL, { exact: true })).toBeVisible();
  });

  test("CP-05 [CA-4, CA-12] se rechazan números de contacto con formato inválido", async ({ page, operador, precargaOperadores: { db } }) => {
    for (const numero of ["0999", "777777777"]) {
      await test.step(numero, async () => {
        await page.goto("/mi-perfil");
        await editar(page);
        await campoTelefono(page).fill(numero);
        await enviar(page);
        await esperarRechazo(page, "El número de contacto no es válido.");
      });
    }
    expect((await db.orm.public.Operador.where({ id: operador.id }).first())?.whatsApp).toBe(TELEFONO_INICIAL);
  });

  test("CP-06 [CA-3] los locales no se pueden modificar", async ({ page, operador, precargaOperadores: { db } }) => {
    const locales = await db.orm.public.Local.where({ operadorId: operador.id }).all();
    expect(locales.length).toBeGreaterThan(0);
    const seccionLocales = page.getByRole("region", { name: "Locales", exact: true });
    await expect(seccionLocales.getByRole("listitem")).toHaveCount(locales.length);
    await editar(page);
    await expect(page.getByRole("textbox", { name: /local|nave/i })).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: /local|nave/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /local|nave/i })).toHaveCount(0);
    await guardar(page);
    await page.reload();
    for (const local of locales) await expect(seccionLocales.getByRole("listitem").filter({ hasText: local.numeroLocal })).toBeVisible();
    expect(await db.orm.public.Local.where({ operadorId: operador.id }).all()).toEqual(locales);
  });

  for (const [indice, reemplazar] of [false, true].entries()) {
    test(`CP-0${7 + indice} [CA-5, CA-11] ${reemplazar ? "reemplazar" : "cargar"} la fotografía y verificar persistencia`, async ({ page, operador, precargaOperadores: { db } }) => {
      try {
        if (reemplazar) {
          await db.orm.public.Operador.where({ id: operador.id }).update({ fotoPerfil: "/Logo.PNG" });
          await page.reload();
        }
        const foto = page.getByRole("img", { name: `Foto de ${operador.nombre}`, exact: true });
        if (reemplazar) await expect(foto).toBeVisible();
        else await expect(foto).toHaveCount(0);
        await editar(page);
        const buffer = await sharp({ create: { width: 80, height: 80, channels: 3, background: "#008332" } }).png().toBuffer();
        await page.getByLabel("Seleccionar foto de perfil").setInputFiles({ name: "perfil.png", mimeType: "image/png", buffer });
        await expect(page.getByRole("img", { name: "Vista previa de la foto de perfil" })).toBeVisible();
        await guardar(page);
        await expect(foto).toHaveAttribute("src", new RegExp(`/api/imagenes/operadores/${operador.id}/.+\\.webp$`));
        const url = await foto.getAttribute("src");
        await page.reload();
        await expect.poll(async () => new URL((await foto.getAttribute("src"))!, page.url()).href).toBe(new URL(url!, page.url()).href);
        await expect.poll(() => foto.evaluate((imagen: HTMLImageElement) => imagen.complete && imagen.naturalWidth > 0)).toBe(true);
        await editar(page);
        const vistaPrevia = page.getByRole("img", { name: "Vista previa de la foto de perfil" });
        await expect.poll(async () => new URL((await vistaPrevia.getAttribute("src"))!, page.url()).pathname).toBe(new URL(url!, page.url()).pathname);
      } finally {
        const guardado = await db.orm.public.Operador.where({ id: operador.id }).first();
        if (guardado?.fotoPerfil?.startsWith("/api/imagenes/")) {
          await db.orm.public.Imagen.where({ clave: guardado.fotoPerfil.slice("/api/imagenes/".length) }).deleteAll();
        }
      }
    });
  }

  test("CP-09 [CA-8] activar la licencia requiere aceptar el aviso de solicitud formal", async ({ page, operador, precargaOperadores: { db } }) => {
    await editar(page);
    const textoAviso = "La gestión de licencias debe tramitarse exclusivamente a través de los mecanismos habituales de la UAM. La información exhibida en este sitio tiene carácter meramente informativo.";
    // El aviso se ve en la propia edición, junto al control de licencia.
    await expect(page.getByRole("main").getByText(textoAviso, { exact: true })).toBeVisible();
    const licencia = page.getByRole("switch", { name: "En licencia", exact: true });
    await licencia.click();
    const aviso = page.getByRole("alertdialog", { name: "Aviso de licencia", exact: true });
    await expect(aviso).toBeVisible();
    await expect(aviso).toHaveAccessibleDescription(textoAviso);

    await aviso.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(aviso).not.toBeVisible();
    await expect(licencia).not.toBeChecked();
    await expect(page.getByRole("group", { name: /^Inicio de licencia(?:\s*\*)?$/ })).toHaveCount(0);
    expect((await db.orm.public.Operador.where({ id: operador.id }).first())?.enLicencia).toBe(false);

    await licencia.click();
    await aviso.getByRole("button", { name: "Aceptar", exact: true }).click();
    await expect(aviso).not.toBeVisible();
    await expect(licencia).toBeChecked();
    await expect(page.getByRole("group", { name: /^Inicio de licencia(?:\s*\*)?$/ })).toBeVisible();
    // Aceptar sólo prepara la licencia: se persiste al guardar el formulario.
    expect((await db.orm.public.Operador.where({ id: operador.id }).first())?.enLicencia).toBe(false);
  });

  for (const [indice, faltante] of (["inicio", "fin"] as const).entries()) {
    test(`CP-${10 + indice} [CA-7, CA-12] rechazar la licencia sin fecha de ${faltante}`, async ({ page, operador, precargaOperadores: { db } }) => {
      const { inicio, fin } = fechas();
      await completarLicencia(page, faltante === "inicio" ? "" : inicio, faltante === "fin" ? "" : fin);
      await enviar(page);
      await esperarRechazo(page, "Faltan completar campos obligatorios.",
        page.getByRole("group", { name: faltante === "inicio" ? /^Inicio de licencia/ : /^Fin de licencia/ }));
      expect((await db.orm.public.Operador.where({ id: operador.id }).first())?.enLicencia).toBe(false);
      await esperarSinLicencia(page);
    });
  }

  test("CP-12 [CA-7, CA-12] rechazar fechas de licencia inconsistentes", async ({ page, operador, precargaOperadores: { db } }) => {
    const { inicio, fin, ayer } = fechas();
    await test.step("La finalización es anterior al inicio", async () => {
      await completarLicencia(page, fin, inicio);
      await enviar(page);
      await esperarRechazo(page, "La fecha de inicio no puede ser posterior a la fecha de fin.");
    });
    await test.step("La finalización ya pasó", async () => {
      await page.goto("/mi-perfil");
      await completarLicencia(page, ayer, ayer);
      await enviar(page);
      await esperarRechazo(page, "La fecha de fin de la licencia no puede ser anterior a hoy.");
    });
    expect((await db.orm.public.Operador.where({ id: operador.id }).first())?.enLicencia).toBe(false);
    await esperarSinLicencia(page);
  });

  for (const [indice, caso] of [
    { titulo: "con recomendación", mensaje: "Compren en el puesto de al lado.", mismoDia: false },
    { titulo: "sin recomendación", mensaje: "", mismoDia: false },
    { titulo: "de un solo día (inicio igual a fin)", mensaje: "", mismoDia: true },
  ].entries()) {
    test(`CP-${13 + indice} [CA-6, CA-7, CA-9, CA-11] guardar una licencia ${caso.titulo}`, async ({ page, operador, precargaOperadores: { db } }) => {
      const { inicio, fin: finSemana } = fechas();
      const fin = caso.mismoDia ? inicio : finSemana;
      await completarLicencia(page, inicio, fin, caso.mensaje);
      await guardar(page);
      expect((await db.orm.public.Operador.where({ id: operador.id }).first())?.enLicencia).toBe(true);
      await page.reload();
      await expect(page.getByText(`Fecha: ${formatear(inicio)} - ${formatear(fin)}`, { exact: true })).toBeVisible();
      if (caso.mensaje) await expect(page.getByText(caso.mensaje, { exact: true })).toBeVisible();
      else await expect(page.getByRole("heading", { name: "Mensaje de recomendación", exact: true })).toHaveCount(0);
      await editar(page);
      await expect(page.getByRole("switch", { name: "En licencia", exact: true })).toBeChecked();
      await esperarFecha(page.getByRole("group", { name: /^Inicio de licencia(?:\s*\*)?$/ }), inicio);
      await esperarFecha(page.getByRole("group", { name: /^Fin de licencia(?:\s*\*)?$/ }), fin);
      await expect(page.getByLabel("Mensaje de recomendación")).toHaveValue(caso.mensaje);
    });
  }

  test("CP-16 [CA-10] la licencia oculta las publicaciones al público", async ({ page, operador, precargaOperadores: { db } }) => {
    const especie = await db.orm.public.Especie.select("id", "nombreEspecie").first();
    expect(especie).not.toBeNull();
    const publicacion = await db.orm.public.Publicacion.create({ especieId: especie!.id, tipoPublicacion: "OPERADOR", publicacionActiva: true, publicacionDisponible: true });
    await db.orm.public.PublicacionOperador.create({ publicacionId: publicacion.id, operadorId: operador.id });
    const listado = `/publicaciones?especie=${encodeURIComponent(especie!.nombreEspecie)}`;
    const perfilPublico = `/operadores/${encodeURIComponent(operador.nombre)}`;
    const tarjetas = page.getByRole("button", { name: /^Ver detalles de/ });

    await test.step("Antes de la licencia la publicación es visible", async () => {
      await page.context().clearCookies();
      await page.goto(listado);
      await page.getByRole("searchbox", { name: "Buscar publicaciones" }).fill(operador.nombre);
      await expect(tarjetas.filter({ hasText: operador.nombre })).toBeVisible();
      await page.goto(perfilPublico);
      await expect(tarjetas).toHaveCount(1);
    });

    await test.step("El Operador declara la licencia", async () => {
      await iniciarSesion(page, operador.credenciales);
      await page.goto("/mi-perfil");
      const { inicio, fin } = fechas();
      await completarLicencia(page, inicio, fin);
      await guardar(page);
    });

    await test.step("Durante la licencia el público no la ve", async () => {
      await page.context().clearCookies();
      await page.goto(listado);
      await page.getByRole("searchbox", { name: "Buscar publicaciones" }).fill(operador.nombre);
      // Se espera el estado vacío antes de afirmar la ausencia, para no pasar antes de filtrar.
      await expect(page.getByText("No hay publicaciones que coincidan con la búsqueda.", { exact: true })).toBeVisible();
      await expect(tarjetas.filter({ hasText: operador.nombre })).toHaveCount(0);
      await page.goto(perfilPublico);
      await expect(page.getByRole("heading", { name: operador.nombre, exact: true })).toBeVisible();
      await expect(page.getByText("Sin publicaciones, está de licencia", { exact: true })).toBeVisible();
      await expect(tarjetas).toHaveCount(0);
    });
  });

  test("CP-17 [CA-11, CA-12] cancelar descarta los cambios", async ({ page, operador, precargaOperadores: { db } }) => {
    await editar(page);
    await campoNombre(page).fill(`${operador.nombre} sin guardar`);
    await campoTelefono(page).fill("91111111");
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: operador.nombre, exact: true })).toBeVisible();
    await expect(page.getByText(TELEFONO_INICIAL, { exact: true })).toBeVisible();
    await expect(exito(page)).toHaveCount(0);
    const guardado = await db.orm.public.Operador.where({ id: operador.id }).first();
    expect(guardado?.nombreFantasia).toBe(operador.nombre);
    expect(guardado?.whatsApp).toBe(TELEFONO_INICIAL);
  });

  test("CP-18 [CA-12] un error al guardar se informa sin confirmar los cambios", async ({ page, operador, precargaOperadores: { db } }) => {
    await editar(page);
    await campoTelefono(page).fill("98888888");
    // Se corta la petición de guardado (server action) para simular una falla de red o del servidor.
    await page.route("**/mi-perfil", (route) =>
      route.request().method() === "POST" && route.request().headers()["next-action"] ? route.abort() : route.continue());
    await enviar(page);
    await esperarRechazo(page, "No se pudieron guardar los cambios. Intentá nuevamente.");
    await page.unroute("**/mi-perfil");
    expect((await db.orm.public.Operador.where({ id: operador.id }).first())?.whatsApp).toBe(TELEFONO_INICIAL);
  });
});
