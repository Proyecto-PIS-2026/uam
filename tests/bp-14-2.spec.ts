import { randomUUID } from "node:crypto";
import { expect, type Locator, type Page } from "@playwright/test";
import postgres from "@prisma/orm-postgres/runtime";
import type { Contract } from "../src/infraestructura/persistencia/prisma/contract";
import contractJson from "../src/infraestructura/persistencia/prisma/contract.json" with { type: "json" };
import { test as base } from "./usuarios-administrativos";
import { iniciarSesionAdministrador, iniciarSesionProductor, type Credenciales } from "./autenticacion";

type ProductorAlta = { usuario: string; nombre: string; contrasena: string };
type Precarga = { rutaPerfil: string; productorId: number; publicacionId: number; publicacionProductorId: number };

// El productor se registra desde la interfaz. La fixture sólo identifica y limpia sus datos.
const test = base.extend<{ productorAlta: ProductorAlta; precarga: Precarga }>({
  productorAlta: async ({}, ejecutarTest) => {
    const sufijo = randomUUID();
    const productor = {
      usuario: `e2e_bp142_${sufijo}`,
      nombre: `Huerta BP-14.2 ${sufijo}`,
      contrasena: "PruebaBP142!",
    };
    try {
      await ejecutarTest(productor);
    } finally {
      const url = process.env.DATABASE_URL;
      if (!url) throw new Error("Configure DATABASE_URL con la base utilizada por el servidor E2E.");
      const db = postgres<Contract>({ contractJson, url });
      try {
        await db.transaction(async (tx) => {
          const usuario = await tx.orm.public.Usuario.where({ username: productor.usuario }).first();
          if (!usuario) return;
          const perfil = await tx.orm.public.Productor.where({ usuarioId: usuario.id }).first();
          if (perfil) {
            const publicaciones = await tx.orm.public.PublicacionProductor.where({ productorId: perfil.id }).all();
            // Borrar la publicación base elimina por cascada la relación y sus ubicaciones.
            for (const publicacion of publicaciones) {
              await tx.orm.public.Publicacion.where({ id: publicacion.publicacionId }).delete();
            }
          }
          await tx.orm.public.Usuario.where({ id: usuario.id }).delete();
        });
      } finally {
        await db.close();
      }
    }
  },
  precarga: async ({ page, usuariosAdministrativos, productorAlta }, ejecutarTest) => {
    await prepararMapa(page);
    await registrarProductor(page, usuariosAdministrativos.administrador, productorAlta);
    const rutaPerfil = await continuarPrecarga(page, productorAlta);
    const productorId = Number(rutaPerfil.split("/").at(-1));
    const publicacionId = await precargarProducto(page, productorId, "CHICO", "1371");
    const [relacion] = await leerPrecargas(productorId);
    expect(relacion.publicacionId).toBe(publicacionId);
    await ejecutarTest({ rutaPerfil, productorId, publicacionId, publicacionProductorId: relacion.id });
  },
});

async function leerPrecargas(productorId: number) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Configure DATABASE_URL con la base utilizada por el servidor E2E.");
  const db = postgres<Contract>({ contractJson, url });
  try {
    return await db.orm.public.PublicacionProductor.where({ productorId })
      .include("publicacion").include("ubicaciones").all();
  } finally {
    await db.close();
  }
}

async function registrarProductor(page: Page, administrador: Credenciales, productor: ProductorAlta) {
  await iniciarSesionAdministrador(page, administrador);
  await page.goto("/alta-usuario");
  await page.getByRole("combobox", { name: "Rol del usuario", exact: true }).click();
  await page.getByRole("option", { name: "Productor", exact: true }).click();
  await page.getByLabel("Nombre de Usuario", { exact: false }).fill(productor.usuario);
  await page.locator("#contraseña").fill(productor.contrasena);
  await page.getByLabel("Confirmación de Contraseña").fill(productor.contrasena);
  await page.locator("#nombre").fill(productor.nombre);
  await page.getByRole("combobox", { name: "Código de país", exact: true }).click();
  await page.getByRole("option", { name: "+598 (Uruguay)", exact: true }).click();
  await page.getByLabel("Número de teléfono (WhatsApp)").fill("99123456");
  await page.getByRole("button", { name: "Registrar usuario", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Productor creado satisfactoriamente" })).toBeVisible();
}

async function continuarPrecarga(page: Page, productor: ProductorAlta) {
  const enlace = page.getByRole("link", { name: "Precargar productos", exact: true });
  await expect(enlace).toHaveAttribute("href", /^\/gestion-productores\/\d+$/);
  const rutaPerfil = (await enlace.getAttribute("href"))!;
  await enlace.click();
  await expect(page).toHaveURL(rutaPerfil);
  await expect(page.getByRole("heading", { level: 1, name: productor.nombre, exact: true })).toBeVisible();
  return rutaPerfil;
}

async function seleccionar(page: Page, formulario: Locator, campo: string, opcion: string) {
  await formulario.getByRole("combobox", { name: campo }).click();
  await page.getByRole("option", { name: opcion, exact: true }).click();
}

async function prepararMapa(page: Page) {
  // Sólo se controlan servicios externos; las APIs de la aplicación usan la base real.
  await page.route("https://nominatim.openstreetmap.org/**", async (route) => {
    const resultado = {
      place_id: 142,
      display_name: "Quinta BP-14.2, Canelones, Uruguay",
      lat: "-34.56",
      lon: "-56.28",
      address: { country_code: "uy", state: "Canelones", road: "Quinta BP-14.2" },
    };
    await route.fulfill({ json: new URL(route.request().url()).pathname === "/search" ? [resultado] : resultado });
  });
  await page.route("https://*.tile.openstreetmap.org/**", (route) => route.fulfill({
    contentType: "image/png",
    body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=", "base64"),
  }));
}

async function completarPrecarga(page: Page, calibre: string, precio: string) {
  await page.getByRole("button", { name: "Agregar Producto", exact: true }).click();
  const alta = page.getByRole("dialog", { name: "Nueva publicación de Productor" });
  await expect(alta).toBeVisible();
  await seleccionar(page, alta, "Especie", "Uchuva");
  await seleccionar(page, alta, "Variedad", "-");
  await seleccionar(page, alta, "Presentación", "Unidad");
  await seleccionar(page, alta, "Categoría", "-");
  await seleccionar(page, alta, "Calibre", calibre);
  await seleccionar(page, alta, "País de origen", "URUGUAY");
  await alta.getByLabel("Precio en pesos").fill(precio);
  await alta.getByLabel("Cantidad (kg)").fill("25");

  await alta.getByRole("button", { name: "Agregar punto de retiro" }).click();
  const mapa = page.getByRole("dialog", { name: "Agregar punto de retiro", exact: true });
  await expect(mapa.locator(".leaflet-container")).toBeVisible();
  await mapa.getByRole("searchbox", { name: "Buscar dirección o lugar" }).fill("Quinta BP-14.2");
  await mapa.getByRole("button", { name: "Buscar", exact: true }).click();
  await mapa.getByRole("button", { name: "Quinta BP-14.2, Canelones, Uruguay", exact: true }).click();
  await mapa.getByRole("button", { name: "Agregar punto", exact: true }).click();
  await expect(mapa).not.toBeVisible();
  return alta;
}

async function precargarProducto(page: Page, productorId: number, calibre: string, precio: string) {
  const alta = await completarPrecarga(page, calibre, precio);
  const [respuesta] = await Promise.all([
    page.waitForResponse((response) => new URL(response.url()).pathname === "/api/publicaciones/productor" && response.request().method() === "POST"),
    alta.getByRole("button", { name: "Confirmar", exact: true }).click(),
  ]);
  expect(respuesta.request().postDataJSON()).toMatchObject({ productorId, precio, cantidadUnidades: 25 });
  expect(respuesta.status(), await respuesta.text()).toBe(201);
  const resultado = await respuesta.json();
  expect(resultado).toMatchObject({ esValido: true, id: expect.any(Number) });
  await expect(alta).not.toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Publicación creada correctamente.");
  return resultado.id as number;
}

async function entrarAlMercado(page: Page, productor: Credenciales) {
  await prepararMapa(page);
  await iniciarSesionProductor(page, productor);
  await page.getByRole("link", { name: "Mi mercado", exact: true }).click();
  await expect(page).toHaveURL(/\/mi-mercado\/productor$/);
  await expect(page.getByRole("heading", { name: "Mi Mercado", exact: true })).toBeVisible();
}

function tarjetaProductor(page: Page, precio: string) {
  return page.getByRole("button", { name: "Ver detalle de Uchuva", exact: true })
    .filter({ has: page.getByText(`$${precio}`, { exact: true }) });
}

async function abrirConsulta(page: Page, precio: string) {
  await tarjetaProductor(page, precio).click();
  const consulta = page.getByRole("dialog", { name: "Consulta de publicación", exact: true });
  await expect(consulta).toBeVisible();
  return consulta;
}

async function abrirEdicion(page: Page, precio: string) {
  const consulta = await abrirConsulta(page, precio);
  await consulta.getByRole("button", { name: "Editar", exact: true }).click();
  const edicion = page.getByRole("dialog", { name: "Editar publicación", exact: true });
  await expect(edicion).toBeVisible();
  return edicion;
}

async function editarPrecarga(page: Page, precarga: Precarga) {
  const edicion = await abrirEdicion(page, "1371");
  await expect(edicion.getByLabel("Precio en pesos")).toHaveValue("1371");
  await edicion.getByLabel("Precio en pesos").fill("1482");
  await edicion.getByRole("button", { name: "Editar punto de retiro 1", exact: true }).click();
  const mapa = page.getByRole("dialog", { name: "Editar punto de retiro", exact: true });
  await mapa.getByLabel(/^Nombre del punto de retiro(?:\s*\*)?$/).fill("Quinta actualizada BP-14.2");
  await mapa.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  await expect(mapa).not.toBeVisible();
  const [respuesta] = await Promise.all([
    page.waitForResponse((response) => new URL(response.url()).pathname === `/api/publicaciones/productor/${precarga.publicacionProductorId}` && response.request().method() === "PATCH"),
    edicion.getByRole("button", { name: "Confirmar", exact: true }).click(),
  ]);
  expect(respuesta.status(), await respuesta.text()).toBe(200);
  expect(await respuesta.json()).toMatchObject({ publicacion: {
    id: precarga.publicacionId, publicacionProductorId: precarga.publicacionProductorId,
    precio: expect.stringMatching(/^1482(?:\.0+)?$/),
  } });
  await expect(edicion).not.toBeVisible();
  const consulta = page.getByRole("dialog", { name: "Consulta de publicación", exact: true });
  await expect(consulta.getByRole("textbox", { name: "Precio en pesos", exact: true })).toHaveValue("1482");
  await expect(consulta.getByRole("link", { name: "Quinta actualizada BP-14.2", exact: true })).toBeVisible();
  await consulta.getByRole("button", { name: "Cerrar consulta", exact: true }).click();
}

test.describe("BP-14.2: precarga, consulta y edición de productos", () => {
  test.beforeEach(() => test.slow());

  test("CP-14.2-01: el alta exitosa ofrece precargar productos", async ({ page, usuariosAdministrativos, productorAlta }) => {
    await test.step("Registrar un nuevo productor como administrador", async () => {
      await registrarProductor(page, usuariosAdministrativos.administrador, productorAlta);
    });
    await test.step("Comprobar el resultado del alta y la opción de precarga", async () => {
      await expect(page.getByRole("status")).toHaveText("Productor creado correctamente.");
      await expect(page.getByText("¿Desea precargar productos para este usuario?", { exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "Precargar productos" })).toHaveAttribute("href", /^\/gestion-productores\/\d+$/);
      await expect(page.getByRole("button", { name: "Ahora no", exact: true })).toBeVisible();
      await expect(page.locator("#nombreUsuario")).toHaveValue("");
    });
  });

  test("CP-14.2-02: continuar abre el perfil del productor recién creado", async ({ page, usuariosAdministrativos, productorAlta }) => {
    await registrarProductor(page, usuariosAdministrativos.administrador, productorAlta);
    await test.step("Continuar a la precarga y comprobar la identidad del productor", async () => {
      await continuarPrecarga(page, productorAlta);
      await expect(page.getByText("Whatsapp: +59899123456", { exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Publicaciones (0)", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Agregar Producto", exact: true })).toBeVisible();
    });
    await test.step("Recargar y comprobar que el perfil quedó registrado", async () => {
      await page.reload();
      await expect(page.getByRole("heading", { level: 1, name: productorAlta.nombre, exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Publicaciones (0)", exact: true })).toBeVisible();
    });
  });

  test("CP-14.2-03: precargar dos productos los guarda en el catálogo del nuevo productor", async ({ page, usuariosAdministrativos, productorAlta }) => {
    await prepararMapa(page);
    await registrarProductor(page, usuariosAdministrativos.administrador, productorAlta);
    const rutaPerfil = await continuarPrecarga(page, productorAlta);
    const productorId = Number(rutaPerfil.split("/").at(-1));
    await expect(page.getByRole("article")).toHaveCount(0);

    await test.step("Precargar dos productos con calibres y precios diferentes", async () => {
      const primera = await precargarProducto(page, productorId, "CHICO", "1371");
      await expect(page.getByRole("heading", { name: "Publicaciones (1)", exact: true })).toBeVisible();
      const segunda = await precargarProducto(page, productorId, "GRANDE", "2637");
      expect(segunda).not.toBe(primera);
      await expect(page.getByRole("heading", { name: "Publicaciones (2)", exact: true })).toBeVisible();
    });

    await test.step("Recargar y consultar los dos productos guardados", async () => {
      await page.reload();
      await expect(page).toHaveURL(rutaPerfil);
      await expect(page.getByRole("heading", { level: 1, name: productorAlta.nombre, exact: true })).toBeVisible();
      const tarjetas = page.getByRole("article", { name: "Ver detalles de Uchuva", exact: true });
      await expect(tarjetas).toHaveCount(2);
      for (const producto of [{ calibre: "C", precio: "1371", precioVisible: "$ 1.371" }, { calibre: "G", precio: "2637", precioVisible: "$ 2.637" }]) {
        const tarjeta = tarjetas.filter({ hasText: `${producto.calibre} · Categoría -` });
        await expect(tarjeta).toHaveCount(1);
        await expect(tarjeta).toContainText(producto.precioVisible);
        await tarjeta.getByRole("button", { name: "Ver detalles de Uchuva", exact: true }).click();
        const consulta = page.getByRole("dialog").filter({ has: page.getByRole("button", { name: "Cerrar consulta", exact: true }) });
        await expect(consulta).toBeVisible();
        await expect(consulta.getByRole("textbox", { name: "Precio en pesos", exact: true })).toHaveValue(producto.precio);
        await expect(consulta.getByRole("combobox", { name: "País de origen", exact: true })).toHaveText("URUGUAY");
        const enlaceMapa = consulta.getByRole("link", { name: "Quinta BP-14.2", exact: true });
        await expect(enlaceMapa).toBeVisible();
        const destinoMapa = new URL((await enlaceMapa.getAttribute("href"))!);
        expect(destinoMapa.origin).toBe("https://www.google.com");
        expect(destinoMapa.pathname).toBe("/maps");
        expect(destinoMapa.searchParams.get("q")).toBe("-34.56,-56.28");
        await consulta.getByRole("button", { name: "Cerrar consulta", exact: true }).click();
        await expect(consulta).not.toBeVisible();
      }
    });
  });

  test("CP-14.2-04: el productor encuentra y consulta los productos precargados por el administrador", async ({ page, browser, productorAlta, precarga }) => {
    await precargarProducto(page, precarga.productorId, "GRANDE", "2637");
    const contexto = await browser.newContext({ baseURL: new URL(page.url()).origin });
    try {
      const paginaProductor = await contexto.newPage();
      await test.step("Ingresar con la cuenta recién registrada y consultar sus dos productos", async () => {
        await entrarAlMercado(paginaProductor, productorAlta);
        await expect(paginaProductor.getByRole("button", { name: "Ver detalle de Uchuva", exact: true })).toHaveCount(2);
        for (const precio of ["1371", "2637"]) {
          const consulta = await abrirConsulta(paginaProductor, precio);
          await expect(consulta.getByRole("textbox", { name: "Precio en pesos", exact: true })).toHaveValue(precio);
          await expect(consulta.getByRole("combobox", { name: "País de origen", exact: true })).toHaveText("URUGUAY");
          await expect(consulta.getByRole("link", { name: "Quinta BP-14.2", exact: true })).toBeVisible();
          await consulta.getByRole("button", { name: "Cerrar consulta", exact: true }).click();
        }
        await paginaProductor.reload();
        await expect(tarjetaProductor(paginaProductor, "1371")).toBeVisible();
        await expect(tarjetaProductor(paginaProductor, "2637")).toBeVisible();
      });
    } finally {
      await contexto.close();
    }
  });

  test("CP-14.2-05: editar la precarga actualiza el mismo producto y conserva los demás", async ({ page, browser, productorAlta, precarga }) => {
    const segundaId = await precargarProducto(page, precarga.productorId, "GRANDE", "2637");
    const contexto = await browser.newContext({ baseURL: new URL(page.url()).origin });
    try {
      const paginaProductor = await contexto.newPage();
      await entrarAlMercado(paginaProductor, productorAlta);
      await test.step("Modificar el precio y el punto de retiro de la primera precarga", async () => {
        await editarPrecarga(paginaProductor, precarga);
      });
      await test.step("Recargar y comprobar persistencia, identidad y aislamiento", async () => {
        await paginaProductor.reload();
        await expect(paginaProductor.getByRole("button", { name: "Ver detalle de Uchuva", exact: true })).toHaveCount(2);
        await expect(tarjetaProductor(paginaProductor, "1371")).toHaveCount(0);
        await expect(tarjetaProductor(paginaProductor, "2637")).toBeVisible();
        const consulta = await abrirConsulta(paginaProductor, "1482");
        await expect(consulta.getByRole("link", { name: "Quinta actualizada BP-14.2", exact: true })).toBeVisible();
        const relaciones = await leerPrecargas(precarga.productorId);
        expect(relaciones).toHaveLength(2);
        expect(relaciones.find((relacion) => relacion.publicacionId === precarga.publicacionId)).toMatchObject({
          id: precarga.publicacionProductorId, productorId: precarga.productorId,
          publicacion: { precio: expect.stringMatching(/^1482(?:\.0+)?$/) },
          ubicaciones: [expect.objectContaining({ nombreUbicacion: "Quinta actualizada BP-14.2" })],
        });
        expect(relaciones.find((relacion) => relacion.publicacionId === segundaId)).toMatchObject({
          publicacion: { precio: expect.stringMatching(/^2637(?:\.0+)?$/) },
          ubicaciones: [expect.objectContaining({ nombreUbicacion: "Quinta BP-14.2" })],
        });
      });
    } finally {
      await contexto.close();
    }
  });

  test("CP-14.2-06: el administrador consulta los cambios guardados por el productor", async ({ page, browser, productorAlta, precarga }) => {
    const contexto = await browser.newContext({ baseURL: new URL(page.url()).origin });
    try {
      const paginaProductor = await contexto.newPage();
      await entrarAlMercado(paginaProductor, productorAlta);
      await editarPrecarga(paginaProductor, precarga);
      await test.step("Actualizar el perfil administrativo y consultar la publicación modificada", async () => {
        await page.reload();
        await expect(page).toHaveURL(precarga.rutaPerfil);
        await expect(page.getByRole("heading", { name: "Publicaciones (1)", exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Ver detalles de Uchuva", exact: true }).click();
        const consulta = page.getByRole("dialog", { name: "Consulta de publicación", exact: true });
        await expect(consulta.getByRole("textbox", { name: "Precio en pesos", exact: true })).toHaveValue("1482");
        await expect(consulta.getByRole("link", { name: "Quinta actualizada BP-14.2", exact: true })).toBeVisible();
      });
    } finally {
      await contexto.close();
    }
  });

  test("CP-14.2-07: Ahora no conserva la cuenta y permite precargar más adelante", async ({ page, usuariosAdministrativos, productorAlta }) => {
    await registrarProductor(page, usuariosAdministrativos.administrador, productorAlta);
    const rutaPerfil = (await page.getByRole("link", { name: "Precargar productos", exact: true }).getAttribute("href"))!;
    await page.getByRole("button", { name: "Ahora no", exact: true }).click();
    await expect(page.getByText("¿Desea precargar productos para este usuario?", { exact: true })).not.toBeVisible();
    await expect(page).toHaveURL(/\/alta-usuario$/);
    await page.goto(rutaPerfil);
    await expect(page.getByRole("heading", { level: 1, name: productorAlta.nombre, exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Publicaciones (0)", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Agregar Producto", exact: true })).toBeVisible();
  });

  test("CP-14.2-08: cancelar una precarga completa no guarda el borrador", async ({ page, usuariosAdministrativos, productorAlta }) => {
    await prepararMapa(page);
    await registrarProductor(page, usuariosAdministrativos.administrador, productorAlta);
    const rutaPerfil = await continuarPrecarga(page, productorAlta);
    const alta = await completarPrecarga(page, "CHICO", "1371");
    let envios = 0;
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/publicaciones/productor" && request.method() === "POST") envios++;
    });
    await alta.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(alta).not.toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Publicaciones (0)", exact: true })).toBeVisible();
    expect(await leerPrecargas(Number(rutaPerfil.split("/").at(-1)))).toHaveLength(0);
    expect(envios).toBe(0);
    await page.getByRole("button", { name: "Agregar Producto", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Nueva publicación de Productor" }).getByLabel("Precio en pesos")).toHaveValue("");
  });

  test("CP-14.2-09: cancelar la edición conserva la precarga original", async ({ page, browser, productorAlta, precarga }) => {
    const contexto = await browser.newContext({ baseURL: new URL(page.url()).origin });
    try {
      const paginaProductor = await contexto.newPage();
      await entrarAlMercado(paginaProductor, productorAlta);
      const edicion = await abrirEdicion(paginaProductor, "1371");
      await edicion.getByLabel("Precio en pesos").fill("9999");
      await edicion.getByRole("button", { name: "Editar punto de retiro 1", exact: true }).click();
      const mapa = paginaProductor.getByRole("dialog", { name: "Editar punto de retiro", exact: true });
      await mapa.getByLabel(/^Nombre del punto de retiro(?:\s*\*)?$/).fill("No debe guardarse");
      await mapa.getByRole("button", { name: "Guardar cambios", exact: true }).click();
      await expect(mapa).not.toBeVisible();
      let escrituras = 0;
      paginaProductor.on("request", (request) => {
        if (request.method() === "PATCH") escrituras++;
      });
      await edicion.getByRole("button", { name: "Cancelar", exact: true }).click();
      await expect(edicion).not.toBeVisible();
      await paginaProductor.reload();
      await expect(tarjetaProductor(paginaProductor, "9999")).toHaveCount(0);
      const reabierta = await abrirEdicion(paginaProductor, "1371");
      await expect(reabierta.getByLabel("Precio en pesos")).toHaveValue("1371");
      await reabierta.getByRole("button", { name: "Editar punto de retiro 1", exact: true }).click();
      const mapaReabierto = paginaProductor.getByRole("dialog", { name: "Editar punto de retiro", exact: true });
      await expect(mapaReabierto.getByLabel(/^Nombre del punto de retiro(?:\s*\*)?$/)).toHaveValue("Quinta BP-14.2");
      await mapaReabierto.getByRole("button", { name: "Cancelar", exact: true }).click();
      expect(escrituras).toBe(0);
      const relaciones = await leerPrecargas(precarga.productorId);
      expect(relaciones).toHaveLength(1);
      expect(relaciones[0].publicacionId).toBe(precarga.publicacionId);
      expect(Number(relaciones[0].publicacion.precio)).toBe(1371);
    } finally {
      await contexto.close();
    }
  });

  test("CP-14.2-10: rechaza una precarga duplicada y conserva el producto original", async ({ page, precarga }) => {
    const alta = await completarPrecarga(page, "CHICO", "9999");
    const [respuesta] = await Promise.all([
      page.waitForResponse((response) => new URL(response.url()).pathname === "/api/publicaciones/productor" && response.request().method() === "POST"),
      alta.getByRole("button", { name: "Confirmar", exact: true }).click(),
    ]);
    expect(respuesta.status()).toBe(400);
    await expect(alta.getByRole("alert")).toContainText("Este Productor ya tiene una publicación con la misma especie, variedad, presentación, categoría, calibre y país.");
    await expect(alta.getByLabel("Precio en pesos")).toHaveValue("9999");
    await alta.getByRole("button", { name: "Cancelar", exact: true }).click();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Publicaciones (1)", exact: true })).toBeVisible();
    const relaciones = await leerPrecargas(precarga.productorId);
    expect(relaciones).toHaveLength(1);
    expect(relaciones[0].publicacionId).toBe(precarga.publicacionId);
    expect(Number(relaciones[0].publicacion.precio)).toBe(1371);
  });

  test("CP-14.2-11: un visitante y otro productor no pueden modificar la precarga", async ({ page, request, browser, usuariosAdministrativos, precarga }) => {
    const [relacion] = await leerPrecargas(precarga.productorId);
    const endpoint = `/api/publicaciones/productor/${precarga.publicacionProductorId}`;
    const cambios = { precio: "9999", especieId: relacion.publicacion.especieId,
      variedadId: relacion.publicacion.variedadId, paisId: relacion.paisId,
      presentacionId: relacion.publicacion.presentacionId,
      categoriaId: relacion.publicacion.categoriaId, calibreId: relacion.publicacion.calibreId,
      ubicaciones: relacion.ubicaciones.map(({ nombreUbicacion, urlMaps }) => ({ nombreUbicacion, urlMaps })) };
    await test.step("Rechazar solicitudes sin iniciar sesión", async () => {
      expect((await request.get(endpoint)).status()).toBe(401);
      expect((await request.patch(endpoint, { multipart: { cambios: JSON.stringify(cambios) } })).status()).toBe(401);
      expect((await request.post("/api/publicaciones/productor", { data: { productorId: precarga.productorId } })).status()).toBe(401);
    });
    const contexto = await browser.newContext({ baseURL: new URL(page.url()).origin });
    try {
      const paginaAjena = await contexto.newPage();
      await entrarAlMercado(paginaAjena, usuariosAdministrativos.productor);
      await expect(paginaAjena.getByRole("button", { name: /^Ver detalle de / })).toHaveCount(0);
      await test.step("Rechazar consulta de edición, modificación y alta para otro productor", async () => {
        expect((await paginaAjena.request.get(endpoint)).status()).toBe(403);
        expect((await paginaAjena.request.patch(endpoint, { multipart: { cambios: JSON.stringify(cambios) } })).status()).toBe(403);
        expect((await paginaAjena.request.post("/api/publicaciones/productor", { data: { productorId: precarga.productorId } })).status()).toBe(403);
        await paginaAjena.goto(precarga.rutaPerfil);
        await expect(paginaAjena).toHaveURL(/\/mi-mercado\/productor$/);
        await expect(paginaAjena.getByRole("heading", { name: "Mi Mercado", exact: true })).toBeVisible();
      });
      const actuales = await leerPrecargas(precarga.productorId);
      expect(actuales).toHaveLength(1);
      expect(actuales[0].publicacionId).toBe(precarga.publicacionId);
      expect(Number(actuales[0].publicacion.precio)).toBe(1371);
    } finally {
      await contexto.close();
    }
  });
});
