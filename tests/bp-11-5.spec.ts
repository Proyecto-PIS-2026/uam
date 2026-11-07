import { expect, type Page } from "@playwright/test";
import sharp from "sharp";
import { test as base, type OperadorPrecarga } from "./precarga-operadores";
import { iniciarSesionAdministrador, type Credenciales } from "./autenticacion";

const test = base.extend<{ operador: OperadorPrecarga }>({
  operador: async ({ page, precargaOperadores }, usar) => {
    const operador = precargaOperadores.operadorA;
    await iniciarSesion(page, operador.credenciales);
    await page.goto("/mi-perfil");
    await usar(operador);
  },
});

async function iniciarSesion(page: Page, credenciales: Credenciales) {
  await page.goto("/iniciar-sesion");
  await page.getByLabel("Correo electrónico o nombre de usuario").fill(credenciales.usuario);
  await page.getByLabel("Contraseña", { exact: true }).fill(credenciales.contrasena);
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Mi Mercado", exact: true })).toBeVisible({ timeout: 30_000 });
}

async function editar(page: Page) {
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Editar mi perfil", exact: true })).toBeVisible();
}

async function guardar(page: Page) {
  await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Perfil actualizado correctamente." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Editar", exact: true })).toBeVisible();
}

function fechas() {
  const hoy = Temporal.Now.plainDateISO("America/Montevideo");
  return { inicio: hoy.toString(), fin: hoy.add({ days: 7 }).toString() };
}

async function completarLicencia(page: Page, inicio: string, fin: string, mensaje = "") {
  await editar(page);
  await page.getByRole("switch", { name: "En licencia", exact: true }).click();
  const aviso = page.getByRole("alertdialog", { name: "Aviso de licencia", exact: true });
  await expect(aviso).toBeVisible();
  await aviso.getByRole("button", { name: "Aceptar", exact: true }).click();
  await expect(aviso).not.toBeVisible();
  await expect(page.getByRole("switch", { name: "En licencia", exact: true })).toBeChecked();
  await page.getByLabel("Inicio de licencia", { exact: true }).fill(inicio);
  await page.getByLabel("Fin de licencia", { exact: true }).fill(fin);
  await page.getByLabel("Mensaje de recomendación", { exact: true }).fill(mensaje);
}

test.describe("BP-11.5 - Modificación de mi perfil como Operador", () => {
  test.beforeEach(() => test.slow());

  test("CP-01 CA-1: la edición carga los valores actuales", async ({ page, operador, precargaOperadores: { db } }) => {
    const { inicio, fin } = fechas();
    await db.orm.public.Operador.where({ id: operador.id }).update({
      fotoPerfil: "/Logo.PNG", enLicencia: true, comentario: `Licencia: ${inicio} - ${fin}\n\nCompren en el puesto de al lado.`,
    });
    await page.reload();
    await editar(page);
    await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue(operador.nombre);
    await expect(page.getByRole("combobox", { name: "Código de país" })).toContainText("+598 (Uruguay)");
    await expect(page.getByLabel(/^Teléfono(?:\s*\*)?$/)).toHaveValue("99123456");
    await expect(page.getByRole("img", { name: "Vista previa de la foto de perfil" })).toHaveAttribute("src", /\/Logo\.PNG$/);
    await expect(page.getByRole("switch", { name: "En licencia", exact: true })).toBeChecked();
    await expect(page.getByRole("alertdialog", { name: "Aviso de licencia", exact: true })).toHaveCount(0);
    await expect(page.getByLabel("Inicio de licencia", { exact: true })).toHaveValue(inicio);
    await expect(page.getByLabel("Fin de licencia", { exact: true })).toHaveValue(fin);
    await expect(page.getByLabel("Mensaje de recomendación")).toHaveValue("Compren en el puesto de al lado.");
  });

  for (const caso of [
    { id: "CP-02", titulo: "cargar contacto", inicial: "", nuevo: "099999999", guardado: "99999999" },
    { id: "CP-03", titulo: "modificar contacto", inicial: "+59899123456", nuevo: "099999999", guardado: "99999999" },
  ]) {
    test(`${caso.id} CA-2, CA-11: ${caso.titulo} y verificar persistencia`, async ({ page, operador, precargaOperadores: { db } }) => {
      await db.orm.public.Operador.where({ id: operador.id }).update({ whatsApp: caso.inicial });
      await page.reload();
      await editar(page);
      await expect(page.getByLabel(/^Teléfono(?:\s*\*)?$/)).toHaveValue(caso.inicial.replace("+598", ""));
      await page.getByLabel(/^Teléfono(?:\s*\*)?$/).fill(caso.nuevo);
      await guardar(page);
      await page.reload();
      await expect(page.getByText("Teléfono:", { exact: true })).toBeVisible();
      await expect(page.getByText(`+598${caso.guardado}`, { exact: true })).toBeVisible();
      await editar(page);
      await expect(page.getByLabel(/^Teléfono(?:\s*\*)?$/)).toHaveValue(caso.guardado);
    });
  }

  test("CP-04 CA-2, CA-11: rechazar contacto vacío y conservar el registrado", async ({ page, operador, precargaOperadores: { db } }) => {
    await db.orm.public.Operador.where({ id: operador.id }).update({ whatsApp: "+59899999999" });
    await page.reload();
    await editar(page);
    const contacto = page.getByLabel(/^Teléfono(?:\s*\*)?$/);
    await expect(contacto).toHaveAttribute("required", "");
    await contacto.fill("");
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("El número de contacto no es válido.");
    expect((await db.orm.public.Operador.where({ id: operador.id }).first())?.whatsApp).toBe("+59899999999");
    await page.reload();
    await expect(page.getByText("Teléfono:", { exact: true })).toBeVisible();
    await expect(page.getByText("+59899999999", { exact: true })).toBeVisible();
    await editar(page);
    await expect(page.getByLabel(/^Teléfono(?:\s*\*)?$/)).toHaveValue("99999999");
  });

  for (const numero of ["0999", "777777777"]) {
    test(`CP-06 CA-4, CA-12: rechazar contacto inválido ${numero}`, async ({ page, operador, precargaOperadores: { db } }) => {
      await db.orm.public.Operador.where({ id: operador.id }).update({ whatsApp: "+59899999999" });
      await page.reload();
      await editar(page);
      await page.getByLabel(/^Teléfono(?:\s*\*)?$/).fill(numero);
      await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
      await expect(page.getByRole("main").getByRole("alert")).toContainText("El número de contacto no es válido.");
      await page.goto("/mi-perfil");
      await page.reload();
      await expect(page.getByText("Teléfono:", { exact: true })).toBeVisible();
      await expect(page.getByText("+59899999999", { exact: true })).toBeVisible();
      await editar(page);
      await expect(page.getByLabel(/^Teléfono(?:\s*\*)?$/)).toHaveValue("99999999");
    });
  }

  test("CP-05 CA-3: los locales no se pueden modificar", async ({ page, operador, precargaOperadores: { db } }) => {
    const locales = await db.orm.public.Local.where({ operadorId: operador.id }).all();
    expect(locales.length).toBeGreaterThan(0);
    await expect(page.getByRole("listitem")).toHaveCount(locales.length);
    await editar(page);
    await expect(page.getByRole("textbox", { name: /local|nave/i })).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: /local|nave/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /local|nave/i })).toHaveCount(0);
    await guardar(page);
    await page.reload();
    for (const local of locales) await expect(page.getByRole("listitem").filter({ hasText: local.numeroLocal })).toBeVisible();
    expect(await db.orm.public.Local.where({ operadorId: operador.id }).all()).toEqual(locales);
  });

  for (const reemplazar of [false, true]) {
    test(`${reemplazar ? "CP-08" : "CP-07"} CA-5, CA-11: ${reemplazar ? "reemplazar" : "cargar"} fotografía y verificar persistencia`, async ({ page, precargaOperadores }) => {
      const { db, operadorA, administrador, reservarOperador } = precargaOperadores;
      let operador = operadorA;
      if (!reemplazar) {
        const datos = reservarOperador();
        await iniciarSesionAdministrador(page, administrador);
        await page.goto("/alta-usuario?rol=operador");
        await page.locator("#nombreUsuario").fill(datos.credenciales.usuario);
        await page.locator('[id="contraseña"]').fill(datos.credenciales.contrasena);
        await page.locator('[id="confirmacionContraseña"]').fill(datos.credenciales.contrasena);
        await page.locator("#nombre").fill(datos.nombre);
        await page.locator("#numero").fill("99123456");
        await page.getByPlaceholder("Número de local").fill(datos.local);
        await page.getByRole("combobox", { name: /^Nave/ }).click();
        await page.getByRole("option").and(page.locator(`[data-value="${datos.naveId}"]`)).click();
        await page.getByRole("button", { name: "Registrar usuario", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Operador creado satisfactoriamente", exact: true })).toBeVisible();
        const creado = await db.orm.public.Operador.where({ nombreFantasia: datos.nombre }).first();
        expect(creado).not.toBeNull();
        operador = { id: creado!.id, usuarioId: creado!.usuarioId, nombre: datos.nombre, credenciales: datos.credenciales };
        await page.context().clearCookies();
      } else {
        await db.orm.public.Operador.where({ id: operador.id }).update({ fotoPerfil: "/Logo.PNG" });
      }
      try {
        await iniciarSesion(page, operador.credenciales);
        await page.goto("/mi-perfil");
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

  test("CP-09 CA-8: activar la licencia requiere aceptar el aviso de solicitud formal", async ({ page, operador, precargaOperadores: { db } }) => {
    await expect(page.getByRole("heading", { name: operador.nombre, exact: true })).toBeVisible();
    await editar(page);
    const licencia = page.getByRole("switch", { name: "En licencia", exact: true });
    await licencia.click();
    const aviso = page.getByRole("alertdialog", { name: "Aviso de licencia", exact: true });
    await expect(aviso).toBeVisible();
    await expect(aviso.getByText("La declaración de licencia en la aplicación no sustituye la solicitud formal ante el área jurídica de la UAM.", { exact: true })).toBeVisible();

    await aviso.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(aviso).not.toBeVisible();
    await expect(licencia).not.toBeChecked();
    await expect(page.getByLabel("Inicio de licencia", { exact: true })).toHaveCount(0);
    expect((await db.orm.public.Operador.where({ id: operador.id }).first())?.enLicencia).toBe(false);

    await licencia.click();
    await aviso.getByRole("button", { name: "Aceptar", exact: true }).click();
    await expect(aviso).not.toBeVisible();
    await expect(licencia).toBeChecked();
    await expect(page.getByLabel("Inicio de licencia", { exact: true })).toBeVisible();
    // Aceptar sólo prepara la licencia: se persiste al guardar el formulario.
    expect((await db.orm.public.Operador.where({ id: operador.id }).first())?.enLicencia).toBe(false);
  });

  for (const faltante of ["inicio", "fin"] as const) {
    test(`CP-10 CA-7, CA-12: rechazar licencia sin ${faltante}`, async ({ page, operador }) => {
      await expect(page.getByRole("heading", { name: operador.nombre, exact: true })).toBeVisible();
      const { inicio, fin } = fechas();
      await completarLicencia(page, faltante === "inicio" ? "" : inicio, faltante === "fin" ? "" : fin);
      await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
      await expect(page.getByRole("main").getByRole("alert")).toContainText("Ingresá las fechas de inicio y fin de la licencia.");
      await page.goto("/mi-perfil");
      await page.reload();
      await expect(page.getByText("No hay licencia registrada.", { exact: true })).toBeVisible();
    });
  }

  test("CP-11 CA-7, CA-12: rechazar finalización anterior al inicio", async ({ page, operador }) => {
    await expect(page.getByRole("heading", { name: operador.nombre, exact: true })).toBeVisible();
    const { inicio, fin } = fechas();
    await completarLicencia(page, fin, inicio);
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("La fecha de inicio no puede ser posterior a la fecha de fin.");
    await page.goto("/mi-perfil");
    await page.reload();
    await expect(page.getByText("No hay licencia registrada.", { exact: true })).toBeVisible();
  });

  for (const mensaje of ["Compren en el puesto de al lado.", ""]) {
    test(`${mensaje ? "CP-12" : "CP-13"} CA-6, CA-7, CA-9, CA-11: guardar licencia ${mensaje ? "con" : "sin"} recomendación`, async ({ page, operador }) => {
      await expect(page.getByRole("heading", { name: operador.nombre, exact: true })).toBeVisible();
      const { inicio, fin } = fechas();
      await completarLicencia(page, inicio, fin, mensaje);
      await guardar(page);
      await page.reload();
      const formatear = (fecha: string) => fecha.split("-").reverse().join("/");
      await expect(page.getByText(`Fecha: ${formatear(inicio)} - ${formatear(fin)}`, { exact: true })).toBeVisible();
      if (mensaje) await expect(page.getByText(mensaje, { exact: true })).toBeVisible();
      else await expect(page.getByRole("heading", { name: "Mensaje de recomendación", exact: true })).toHaveCount(0);
      await editar(page);
      await expect(page.getByRole("switch", { name: "En licencia", exact: true })).toBeChecked();
      await expect(page.getByLabel("Inicio de licencia", { exact: true })).toHaveValue(inicio);
      await expect(page.getByLabel("Fin de licencia", { exact: true })).toHaveValue(fin);
      await expect(page.getByLabel("Mensaje de recomendación")).toHaveValue(mensaje);
    });
  }

  test("CP-14 CA-10: la licencia oculta las publicaciones al público", async ({ page, operador, precargaOperadores: { db } }) => {
    const especie = await db.orm.public.Especie.select("id", "nombreEspecie").first();
    expect(especie).not.toBeNull();
    const publicacion = await db.orm.public.Publicacion.create({ especieId: especie!.id, tipoPublicacion: "OPERADOR", publicacionActiva: true, publicacionDisponible: true });
    await db.orm.public.PublicacionOperador.create({ publicacionId: publicacion.id, operadorId: operador.id });
    const ruta = `/operadores/${encodeURIComponent(operador.nombre)}`;
    // Comprobar visibilidad antes de declarar la licencia evita un falso positivo.
    await page.context().clearCookies();
    await page.goto(`/publicaciones?especie=${encodeURIComponent(especie!.nombreEspecie)}`);
    await page.getByRole("searchbox", { name: "Buscar publicaciones" }).fill(operador.nombre);
    await expect(page.getByRole("button", { name: /^Ver detalles de/ }).filter({ hasText: operador.nombre })).toBeVisible();
    await page.goto(ruta);
    await expect(page.getByRole("button", { name: /^Ver detalles de/ })).toHaveCount(1);
    await iniciarSesion(page, operador.credenciales);
    await page.goto("/mi-perfil");
    const { inicio, fin } = fechas();
    await completarLicencia(page, inicio, fin);
    await guardar(page);
    await page.context().clearCookies();
    await page.goto(`/publicaciones?especie=${encodeURIComponent(especie!.nombreEspecie)}`);
    await page.getByRole("searchbox", { name: "Buscar publicaciones" }).fill(operador.nombre);
    await expect.soft(page.getByRole("button", { name: /^Ver detalles de/ }).filter({ hasText: operador.nombre }), "Las publicaciones del operador de licencia deben desaparecer del listado público").toHaveCount(0);
    await page.goto(ruta);
    await expect(page.getByRole("heading", { name: operador.nombre, exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Ver detalles de/ })).toHaveCount(0);
    await expect(page.getByText(/licencia/i).first()).toBeVisible();
  });
});
