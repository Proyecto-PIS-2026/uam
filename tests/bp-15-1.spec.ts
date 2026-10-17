import { devices, expect, type Page, type Locator, type APIRequestContext } from "@playwright/test";
import { test } from "./productores-publicaciones";
import { iniciarSesionAdministrador, iniciarSesionProductor } from "./autenticacion";

const rutaAlta = "/alta-publicacion-productor";
const rutaApi = "/api/publicaciones/productor";
const nombreLugar = "Mercado Modelo";
const departamento = "Montevideo";
const latitud = -34.873;
const longitud = -56.168;
const fotografia = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jV4kAAAAASUVORK5CYII=", "base64");

type Opcion = { id: number; nombre: string };
type Catalogos = {
  especies: Opcion[];
  variedades: (Opcion & { especieId: number })[];
  presentaciones: (Opcion & { variedadId: number })[];
  categorias: (Opcion & { especieId: number | null })[];
  calibres: Opcion[];
  paises: (Opcion & { codigo: string })[];
};

async function obtenerSeleccion(request: APIRequestContext, probarDuplicados = false) {
  const respuesta = await request.get(rutaApi);
  expect(respuesta.status()).toBe(200);
  const catalogos: Catalogos = await respuesta.json();
  const presentacion = catalogos.presentaciones.find((opcion) => catalogos.variedades.some((variedad) =>
    variedad.id === opcion.variedadId && catalogos.especies.some((especie) => especie.id === variedad.especieId) &&
    (!probarDuplicados || (
      catalogos.presentaciones.some((otra) => otra.variedadId === variedad.id && otra.id !== opcion.id) &&
      catalogos.variedades.some((otra) => otra.especieId === variedad.especieId && otra.id !== variedad.id && catalogos.presentaciones.some((item) => item.variedadId === otra.id)) &&
      catalogos.categorias.filter((categoria) => categoria.especieId === null || categoria.especieId === variedad.especieId).length > 1
    )),
  ));
  expect(presentacion, "Se requiere una presentación activa en el catálogo").toBeDefined();
  const variedad = catalogos.variedades.find((opcion) => opcion.id === presentacion!.variedadId)!;
  const especie = catalogos.especies.find((opcion) => opcion.id === variedad.especieId)!;
  const categoria = catalogos.categorias.find((opcion) => opcion.especieId === especie.id || opcion.especieId === null);
  const pais = catalogos.paises.find((opcion) => opcion.codigo === "UY");
  expect(categoria).toBeDefined();
  expect(pais).toBeDefined();
  expect(catalogos.calibres.length).toBeGreaterThan(0);
  return { especie, variedad, presentacion: presentacion!, categoria: categoria!, calibre: catalogos.calibres[0], pais: pais!, catalogos };
}

type Seleccion = Awaited<ReturnType<typeof obtenerSeleccion>>;

function datosValidos(productorId: number, seleccion: Seleccion) {
  return {
    productorId,
    especieId: seleccion.especie.id,
    variedadId: seleccion.variedad.id,
    presentacionId: seleccion.presentacion.id,
    categoriaId: seleccion.categoria.id,
    calibreId: seleccion.calibre.id,
    paisId: seleccion.pais.id,
    latitud, longitud, departamento, nombreLugar,
    disponibilidad: true,
    precio: "237",
    cantidadUnidades: 120,
  };
}

async function seleccionar(page: Page, formulario: Locator, campo: string, opcion: string) {
  await formulario.getByRole("combobox", { name: campo, exact: true }).click();
  await page.getByRole("option", { name: opcion, exact: true }).click();
}

async function abrirAlta(page: Page) {
  await page.goto(rutaAlta);
  await expect(page.getByRole("combobox", { name: "Productor", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Agregar producto", exact: true }).click();
  const formulario = page.getByRole("dialog", { name: "Nueva publicación de Productor", exact: true });
  await expect(formulario).toBeVisible();
  return formulario;
}

async function completarProducto(page: Page, formulario: Locator, seleccion: Seleccion) {
  await seleccionar(page, formulario, "Especie", seleccion.especie.nombre);
  await seleccionar(page, formulario, "Variedad", seleccion.variedad.nombre);
  await seleccionar(page, formulario, "Presentación", seleccion.presentacion.nombre);
  await seleccionar(page, formulario, "Categoría", seleccion.categoria.nombre);
  await seleccionar(page, formulario, "Calibre", seleccion.calibre.nombre);
  await seleccionar(page, formulario, "País de origen", seleccion.pais.nombre);
}

async function prepararMapa(page: Page) {
  // Solo se simula el proveedor externo; la aplicación, el login y la base son reales.
  await page.route(/https:\/\/[abc]\.tile\.openstreetmap\.org\//, (ruta) =>
    ruta.fulfill({ contentType: "image/png", body: fotografia }),
  );
  await page.route("https://nominatim.openstreetmap.org/**", async (ruta) => {
    const url = new URL(ruta.request().url());
    if (url.pathname === "/search") {
      await ruta.fulfill({ json: [{ place_id: 1, lat: String(latitud), lon: String(longitud), display_name: `${nombreLugar}, ${departamento}, Uruguay` }] });
    } else if (url.pathname === "/reverse") {
      await ruta.fulfill({ json: { display_name: `${nombreLugar}, ${departamento}, Uruguay`, address: { country_code: "uy", state: departamento, road: nombreLugar } } });
    } else {
      await ruta.abort();
    }
  });
}

async function seleccionarUbicacion(page: Page, formulario: Locator) {
  await formulario.getByRole("button", { name: "Seleccionar ubicación de retiro" }).click();
  const mapa = page.getByRole("dialog", { name: "Seleccionar ubicación", exact: true });
  await expect(mapa.locator(".leaflet-container")).toBeVisible();
  await mapa.getByRole("searchbox", { name: "Buscar ubicación por nombre" }).fill(`${nombreLugar}, ${departamento}`);
  const busqueda = page.waitForRequest((solicitud) => new URL(solicitud.url()).pathname === "/search");
  await mapa.getByRole("button", { name: "Buscar", exact: true }).click();
  const consulta = new URL((await busqueda).url());
  expect(consulta.searchParams.get("q")).toBe(`${nombreLugar}, ${departamento}`);
  expect(consulta.searchParams.get("countrycodes")).toBe("uy");
  await mapa.getByRole("button", { name: `${nombreLugar}, ${departamento}, Uruguay`, exact: true }).click();
  await expect(mapa.getByRole("button", { name: "Usar esta ubicación" })).toBeEnabled();
  await expect(mapa.locator(".leaflet-interactive")).toHaveCount(1);
  await mapa.getByRole("button", { name: "Usar esta ubicación" }).click({ timeout: 10_000 });
  await expect(mapa).not.toBeVisible();
  await expect(formulario.getByText(`${nombreLugar}, ${departamento}`, { exact: true })).toBeVisible();
}

async function confirmarAlta(page: Page, formulario: Locator) {
  const guardado = page.waitForResponse((respuesta) => respuesta.url().endsWith(rutaApi) && respuesta.request().method() === "POST");
  await formulario.getByRole("button", { name: "Confirmar", exact: true }).click();
  const respuesta = await guardado;
  expect(respuesta.status()).toBe(201);
  const resultado = await respuesta.json();
  expect(resultado.esValido).toBe(true);
  await expect(page.getByRole("status")).toHaveText("Publicación creada correctamente.");
  await expect(formulario).not.toBeVisible();
  return resultado.id as number;
}

async function adjuntarFotografia(page: Page, formulario: Locator, boton: string) {
  const selector = page.waitForEvent("filechooser");
  await formulario.getByRole("button", { name: boton, exact: true }).click();
  await (await selector).setFiles({ name: "producto.png", mimeType: "image/png", buffer: fotografia });
  const vistaPrevia = formulario.getByRole("img", { name: "Vista previa de la fotografía" });
  await expect(vistaPrevia).toBeVisible();
  expect(await vistaPrevia.evaluate((imagen) => (imagen as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
}

async function iniciarSesionOperadorPrueba(page: Page, credenciales: { usuario: string; contrasena: string }) {
  await page.goto("/iniciar-sesion");
  await page.getByLabel("Correo electrónico o nombre de usuario").fill(credenciales.usuario);
  await page.getByLabel("Contraseña", { exact: true }).fill(credenciales.contrasena);
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname.startsWith("/mi-mercado"));
  await expect(page.getByRole("heading", { name: "Mi Mercado", exact: true, level: 1 })).toBeVisible();
}

test.describe("BP-15.1: alta de publicaciones de Productor", () => {
  test.beforeEach(async ({ page }) => {
    test.slow();
    await prepararMapa(page);
  });

  test.afterEach(async ({ page }, informacion) => {
    const caso = informacion.title.match(/CP-\d+/)?.[0] ?? "resultado";
    await informacion.attach(caso, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  });

  test("CP-01 CA-1 CA-9: crear una publicación completa", async ({ page, publicacionesProductor }) => {
    const { db, propio } = publicacionesProductor;
    await iniciarSesionProductor(page, propio.credenciales);
    const seleccion = await obtenerSeleccion(page.request);
    const formulario = await abrirAlta(page);
    await completarProducto(page, formulario, seleccion);
    await seleccionarUbicacion(page, formulario);
    await formulario.getByRole("textbox", { name: "Precio en pesos" }).fill("237");
    await formulario.getByRole("textbox", { name: "Cantidad (kg)" }).fill("120");
    await adjuntarFotografia(page, formulario, "Editar foto");
    const id = await confirmarAlta(page, formulario);

    const relaciones = await db.orm.public.PublicacionProductor.where({ productorId: propio.id }).all();
    expect(relaciones).toHaveLength(1);
    expect(relaciones[0]).toMatchObject({ publicacionId: id, paisId: seleccion.pais.id });
    const publicacion = await db.orm.public.Publicacion.where({ id }).first();
    expect(publicacion).toMatchObject({ tipoPublicacion: "PRODUCTOR", presentacionId: seleccion.presentacion.id, categoriaId: seleccion.categoria.id, calibreId: seleccion.calibre.id, cantidadUnidades: 120, publicacionDisponible: true });
    expect(Number(publicacion!.precio)).toBe(237);
    expect(publicacion!.foto).toMatch(new RegExp(`^/api/publicaciones/imagenes/${id}/.+\\.png$`));
    const ubicaciones = await db.orm.public.Ubicacion.where({ publicacionId: relaciones[0].id }).all();
    expect(ubicaciones).toHaveLength(1);
    expect(ubicaciones[0].nombreUbicacion).toBe(nombreLugar);
    expect(new URL(ubicaciones[0].urlMaps).searchParams.get("q")).toBe(`${latitud},${longitud}`);
    await test.info().attach("Publicación registrada", { body: JSON.stringify({ publicacion, relaciones, ubicaciones }, null, 2), contentType: "application/json" });
  });

  test("CP-02 CA-3: publicar sin precio o fotografía", async ({ page, publicacionesProductor }) => {
    const { db, propio } = publicacionesProductor;
    await iniciarSesionProductor(page, propio.credenciales);
    const seleccion = await obtenerSeleccion(page.request);
    const variantes = [
      { nombre: "Sin precio", precio: "", foto: true },
      { nombre: "Sin fotografía", precio: "237", foto: false },
      { nombre: "Sin precio ni fotografía", precio: "", foto: false },
    ];
    expect(seleccion.catalogos.calibres.length).toBeGreaterThanOrEqual(variantes.length);
    for (const [indice, variante] of variantes.entries()) {
      await test.step(variante.nombre, async () => {
        const formulario = await abrirAlta(page);
        await completarProducto(page, formulario, { ...seleccion, calibre: seleccion.catalogos.calibres[indice] });
        await seleccionarUbicacion(page, formulario);
        if (variante.precio) await formulario.getByRole("textbox", { name: "Precio en pesos" }).fill(variante.precio);
        if (variante.foto) await adjuntarFotografia(page, formulario, "Editar foto");
        const id = await confirmarAlta(page, formulario);
        const publicacion = await db.orm.public.Publicacion.where({ id }).first();
        if (variante.precio) expect(Number(publicacion!.precio)).toBe(237);
        else expect(publicacion!.precio).toBeNull();
        if (variante.foto) expect(publicacion!.foto).toBeTruthy();
        else expect(publicacion!.foto).toBeNull();
      });
    }
    expect(await db.orm.public.PublicacionProductor.where({ productorId: propio.id }).all()).toHaveLength(3);
  });

  test("CP-03 CA-2 CA-7: validar el precio entero", async ({ page, publicacionesProductor }) => {
    const { db, propio } = publicacionesProductor;
    await iniciarSesionProductor(page, propio.credenciales);
    const seleccion = await obtenerSeleccion(page.request);
    const formulario = await abrirAlta(page);
    await completarProducto(page, formulario, seleccion);
    await seleccionarUbicacion(page, formulario);
    for (const precio of ["texto", "12.5", "12,5"]) {
      await test.step(`Rechazar el precio ${precio}`, async () => {
        const entrada = formulario.getByRole("textbox", { name: "Precio en pesos" });
        await entrada.fill(precio);
        await expect(entrada).not.toHaveValue(precio);
        const respuesta = await page.request.post(rutaApi, { data: { ...datosValidos(propio.id, seleccion), precio } });
        expect(respuesta.status()).toBe(400);
        expect((await respuesta.json()).errores).toContain("El precio debe ser un número entero.");
      });
    }
    expect(await db.orm.public.PublicacionProductor.where({ productorId: propio.id }).all()).toHaveLength(0);
    await formulario.getByRole("textbox", { name: "Precio en pesos" }).fill("237");
    const id = await confirmarAlta(page, formulario);
    expect(Number((await db.orm.public.Publicacion.where({ id }).first())!.precio)).toBe(237);
  });

  test("CP-04 CA-5 CA-7: corregir datos obligatorios e inconsistentes", async ({ page, publicacionesProductor }) => {
    const { db, propio } = publicacionesProductor;
    await iniciarSesionProductor(page, propio.credenciales);
    const seleccion = await obtenerSeleccion(page.request);
    const formulario = await abrirAlta(page);
    await seleccionarUbicacion(page, formulario);
    const envios: string[] = [];
    page.on("request", (solicitud) => {
      if (solicitud.url().endsWith(rutaApi) && solicitud.method() === "POST") envios.push(solicitud.postData() ?? "");
    });
    await formulario.getByRole("button", { name: "Confirmar", exact: true }).click();
    expect(await formulario.locator("form").evaluate((elemento) => (elemento as HTMLFormElement).checkValidity())).toBe(false);
    expect(await formulario.locator("form :invalid").first().evaluate((elemento) => (elemento as HTMLInputElement).validationMessage)).not.toBe("");
    expect(envios).toHaveLength(0);

    for (const campo of ["especieId", "variedadId", "presentacionId", "categoriaId", "calibreId", "paisId"]) {
      const respuesta = await page.request.post(rutaApi, { data: { ...datosValidos(propio.id, seleccion), [campo]: 0 } });
      expect(respuesta.status()).toBe(400);
      expect((await respuesta.json()).errores).toContain(`El campo ${campo} es obligatorio.`);
    }
    const presentacionAjena = seleccion.catalogos.presentaciones.find((opcion) => opcion.variedadId !== seleccion.variedad.id);
    expect(presentacionAjena).toBeDefined();
    const respuesta = await page.request.post(rutaApi, { data: { ...datosValidos(propio.id, seleccion), presentacionId: presentacionAjena!.id } });
    expect(respuesta.status()).toBe(400);
    expect((await respuesta.json()).errores).toContain("La selección contiene datos que ya no están disponibles. Actualizá el formulario.");
    expect(await db.orm.public.PublicacionProductor.where({ productorId: propio.id }).all()).toHaveLength(0);
    await completarProducto(page, formulario, seleccion);
    await confirmarAlta(page, formulario);
    expect(await db.orm.public.PublicacionProductor.where({ productorId: propio.id }).all()).toHaveLength(1);
  });

  test("CP-06 CA-6 CA-8: detectar duplicados sin falsos positivos", async ({ page, publicacionesProductor }) => {
    const { db, propio, ajeno } = publicacionesProductor;
    await iniciarSesionProductor(page, propio.credenciales);
    const seleccion = await obtenerSeleccion(page.request, true);
    const datos = datosValidos(propio.id, seleccion);
    const alta = await page.request.post(rutaApi, { data: datos });
    expect(alta.status()).toBe(201);
    const original = await alta.json();
    const antes = await db.orm.public.Publicacion.where({ id: original.id }).first();
    const formulario = await abrirAlta(page);
    await completarProducto(page, formulario, seleccion);
    await seleccionarUbicacion(page, formulario);
    await formulario.getByRole("textbox", { name: "Precio en pesos" }).fill("999");
    const guardado = page.waitForResponse((respuesta) => respuesta.url().endsWith(rutaApi) && respuesta.request().method() === "POST");
    await formulario.getByRole("button", { name: "Confirmar", exact: true }).click();
    expect((await guardado).status()).toBe(400);
    await expect(formulario.getByRole("alert")).toContainText("ya tiene una publicación");
    expect(await db.orm.public.PublicacionProductor.where({ productorId: propio.id }).all()).toHaveLength(1);
    expect(await db.orm.public.Publicacion.where({ id: original.id }).first()).toEqual(antes);

    const otrosCalibres = seleccion.catalogos.calibres.filter((opcion) => opcion.id !== seleccion.calibre.id);
    const otrasCategorias = seleccion.catalogos.categorias.filter((opcion) => opcion.id !== seleccion.categoria.id && (opcion.especieId === null || opcion.especieId === seleccion.especie.id));
    expect(otrosCalibres.length).toBeGreaterThan(0);
    expect(otrasCategorias.length).toBeGreaterThan(0);
    for (const cambio of [{ calibreId: otrosCalibres[0].id }, { categoriaId: otrasCategorias[0].id }]) {
      const respuesta = await page.request.post(rutaApi, { data: { ...datos, ...cambio } });
      expect(respuesta.status()).toBe(201);
    }
    for (const tipo of ["presentación", "variedad", "especie"]) {
      const presentacion = seleccion.catalogos.presentaciones.find((opcion) => {
        const variedad = seleccion.catalogos.variedades.find((item) => item.id === opcion.variedadId);
        return variedad && (tipo === "presentación" ? variedad.id === seleccion.variedad.id && opcion.id !== seleccion.presentacion.id :
          tipo === "variedad" ? variedad.especieId === seleccion.especie.id && variedad.id !== seleccion.variedad.id : variedad.especieId !== seleccion.especie.id);
      });
      expect(presentacion, `El catálogo debe ofrecer otra ${tipo}`).toBeDefined();
      const variedad = seleccion.catalogos.variedades.find((item) => item.id === presentacion!.variedadId)!;
      const categoria = seleccion.catalogos.categorias.find((item) => item.especieId === null || item.especieId === variedad.especieId)!;
      const respuesta = await page.request.post(rutaApi, { data: { ...datos, especieId: variedad.especieId, variedadId: variedad.id, presentacionId: presentacion!.id, categoriaId: categoria.id } });
      expect(respuesta.status(), `Cambiar ${tipo} no debe considerarse duplicado`).toBe(201);
    }
    await page.context().clearCookies();
    await iniciarSesionProductor(page, ajeno.credenciales);
    expect((await page.request.post(rutaApi, { data: { ...datos, productorId: ajeno.id } })).status()).toBe(201);
  });

  test("CP-07 CA-11: cargar fotografía desde archivo en web", async ({ page, publicacionesProductor }) => {
    const { db, propio } = publicacionesProductor;
    await iniciarSesionProductor(page, propio.credenciales);
    const seleccion = await obtenerSeleccion(page.request);
    const formulario = await abrirAlta(page);
    const entrada = formulario.getByLabel("Fotografía", { exact: true });
    expect(await entrada.getAttribute("capture")).toBeNull();
    await adjuntarFotografia(page, formulario, "Editar foto");
    const vistaPrevia = formulario.getByRole("img", { name: "Vista previa de la fotografía" });
    const original = await vistaPrevia.getAttribute("src");
    for (const archivo of [
      { name: "documento.txt", mimeType: "text/plain", buffer: Buffer.from("No es una imagen") },
      { name: "imagen-grande.png", mimeType: "image/png", buffer: Buffer.alloc(11 * 1024 * 1024) },
    ]) {
      await entrada.setInputFiles(archivo);
      await expect(formulario.getByRole("alert")).toHaveText("La fotografía debe ser PNG, JPEG o WebP y pesar hasta 10 MB.");
      await expect(vistaPrevia).toHaveAttribute("src", original!);
    }
    await completarProducto(page, formulario, seleccion);
    await seleccionarUbicacion(page, formulario);
    const id = await confirmarAlta(page, formulario);
    const publicacion = await db.orm.public.Publicacion.where({ id }).first();
    const respuesta = await page.request.get(publicacion!.foto!);
    expect(respuesta.status()).toBe(200);
    expect(respuesta.headers()["content-type"]).toContain("image/png");
    expect(await respuesta.body()).toEqual(fotografia);
  });

  test("CP-08 CA-10: cargar fotografía en móvil", async ({ page, browser, publicacionesProductor }, informacion) => {
    informacion.annotations.push({ type: "manual", description: "La apertura y captura de cámara física y el selector nativo del dispositivo requieren una prueba manual. La emulación solo verifica el selector de archivos y capture=environment." });
    await iniciarSesionProductor(page, publicacionesProductor.propio.credenciales);
    const contexto = await browser.newContext({ ...devices["Pixel 7"], baseURL: informacion.project.use.baseURL, storageState: await page.context().storageState() });
    const movil = await contexto.newPage();
    try {
      await prepararMapa(movil);
      const seleccion = await obtenerSeleccion(movil.request);
      const formulario = await abrirAlta(movil);
      await expect(formulario.getByLabel("Fotografía", { exact: true })).toHaveAttribute("capture", "environment");
      await adjuntarFotografia(movil, formulario, "Cámara");
      await completarProducto(movil, formulario, seleccion);
      await seleccionarUbicacion(movil, formulario);
      const id = await confirmarAlta(movil, formulario);
      expect((await publicacionesProductor.db.orm.public.Publicacion.where({ id }).first())!.foto).toBeTruthy();
    } finally {
      try {
        if (!movil.isClosed()) {
          await informacion.attach("Vista móvil", { body: await movil.screenshot({ fullPage: true, timeout: 5_000 }), contentType: "image/png" });
        }
      } finally {
        await contexto.close();
      }
    }
  });

  test("CP-09 CA-12: cancelar el alta sin registrar una publicación", async ({ page, publicacionesProductor }) => {
    const { db, propio } = publicacionesProductor;
    await iniciarSesionProductor(page, propio.credenciales);
    const seleccion = await obtenerSeleccion(page.request);
    const formulario = await abrirAlta(page);
    await completarProducto(page, formulario, seleccion);
    await seleccionarUbicacion(page, formulario);
    await formulario.getByRole("textbox", { name: "Precio en pesos" }).fill("237");
    await adjuntarFotografia(page, formulario, "Editar foto");
    const envios: string[] = [];
    page.on("request", (solicitud) => {
      if (solicitud.url().endsWith(rutaApi) && solicitud.method() === "POST") envios.push(solicitud.url());
    });
    await formulario.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(formulario).not.toBeVisible();
    expect(envios).toHaveLength(0);
    expect(await db.orm.public.PublicacionProductor.where({ productorId: propio.id }).all()).toHaveLength(0);
    await page.getByRole("button", { name: "Agregar producto", exact: true }).click();
    await expect(formulario.getByRole("textbox", { name: "Precio en pesos" })).toHaveValue("");
    await expect(formulario.getByRole("img", { name: "Vista previa de la fotografía" })).toHaveCount(0);
  });

  test("CP-10: impedir altas sin autorización o para otro Productor", async ({ page, publicacionesProductor }) => {
    const { db, propio, ajeno, administrador, operador } = publicacionesProductor;
    await iniciarSesionProductor(page, propio.credenciales);
    const seleccion = await obtenerSeleccion(page.request);
    await page.context().clearCookies();
    await test.step("Rechazar el acceso y la creación sin sesión", async () => {
      await page.goto(rutaAlta);
      await expect(page).toHaveURL((url) => url.pathname === "/iniciar-sesion");
      expect((await page.request.get(rutaApi)).status()).toBe(401);
      expect((await page.request.post(rutaApi, { data: datosValidos(propio.id, seleccion) })).status()).toBe(401);
    });
    for (const rol of ["Administrador", "Operador"]) {
      await test.step(`Rechazar el acceso y la creación como ${rol}`, async () => {
        if (rol === "Administrador") await iniciarSesionAdministrador(page, administrador);
        else await iniciarSesionOperadorPrueba(page, operador);
        await page.goto(rutaAlta);
        await expect(page).toHaveURL((url) => rol === "Administrador" ? url.pathname === "/inicio" : url.pathname.startsWith("/mi-mercado"));
        expect((await page.request.get(rutaApi)).status()).toBe(403);
        expect((await page.request.post(rutaApi, { data: datosValidos(propio.id, seleccion) })).status()).toBe(403);
        await page.context().clearCookies();
      });
    }
    await test.step("Rechazar el identificador de otro Productor", async () => {
      await iniciarSesionProductor(page, propio.credenciales);
      const respuesta = await page.request.post(rutaApi, { data: datosValidos(ajeno.id, seleccion) });
      expect(respuesta.status()).toBe(403);
      expect(await db.orm.public.PublicacionProductor.where({ productorId: ajeno.id }).all()).toHaveLength(0);
      expect(await db.orm.public.PublicacionProductor.where({ productorId: propio.id }).all()).toHaveLength(0);
    });
    await test.step("Resolver el Productor desde la sesión sin recibir su ID", async () => {
      const datos: Partial<ReturnType<typeof datosValidos>> = datosValidos(propio.id, seleccion);
      delete datos.productorId;
      const respuesta = await page.request.post(rutaApi, { data: datos });
      expect(respuesta.status()).toBe(201);
      const resultado = await respuesta.json();
      expect(await db.orm.public.PublicacionProductor.where({ publicacionId: resultado.id, productorId: propio.id }).first()).not.toBeNull();
    });
  });
});
