import { devices, expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { test, type DatosOperadorPrecarga, type OperadorPrecarga } from "./precarga-operadores";
import { iniciarSesionAdministrador, iniciarSesionProductor, type Credenciales } from "./autenticacion";

const rutaApi = "/api/publicaciones";
type Opcion = { id: number; nombre: string };
type Catalogos = {
  especies: Opcion[];
  variedades: (Opcion & { especieId: number })[];
  presentaciones: (Opcion & { variedadId: number })[];
  categorias: (Opcion & { especieId: number | null })[];
  calibres: Opcion[];
  paises: Opcion[];
};

async function obtenerSeleccion(request: APIRequestContext) {
  const respuesta = await request.get(rutaApi);
  expect(respuesta.status()).toBe(200);
  const catalogos: Catalogos = await respuesta.json();
  const especie = catalogos.especies.find((opcion) => opcion.nombre === "Uchuva");
  expect(especie, "La seed debe incluir Uchuva para distinguir los productos de prueba").toBeDefined();
  const variedad = catalogos.variedades.find((opcion) => opcion.especieId === especie!.id)!;
  const presentacion = catalogos.presentaciones.find((opcion) => opcion.variedadId === variedad.id)!;
  const categoria = catalogos.categorias.find((opcion) => opcion.especieId === null || opcion.especieId === especie!.id)!;
  const pais = catalogos.paises.find((opcion) => opcion.nombre === "URUGUAY")!;
  expect(catalogos.calibres.length).toBeGreaterThanOrEqual(3);
  expect(presentacion).toBeDefined();
  expect(categoria).toBeDefined();
  expect(pais).toBeDefined();
  return { especie: especie!, variedad, presentacion, categoria, pais, calibres: catalogos.calibres, catalogos };
}
type Seleccion = Awaited<ReturnType<typeof obtenerSeleccion>>;

function datosValidos(operadorId: number, seleccion: Seleccion, indice = 0, precio = "1371") {
  return {
    operadorId, especieId: seleccion.especie.id, variedadId: seleccion.variedad.id,
    presentacionId: seleccion.presentacion.id, categoriaId: seleccion.categoria.id,
    calibreId: seleccion.calibres[indice].id, paisId: seleccion.pais.id,
    disponibilidad: true, precio, cantidadUnidades: 12,
  };
}

async function crearPrecarga(request: APIRequestContext, operadorId: number, seleccion: Seleccion, indice = 0, precio = "1371") {
  const respuesta = await request.post(rutaApi, { data: datosValidos(operadorId, seleccion, indice, precio) });
  expect(respuesta.status()).toBe(201);
  const resultado = await respuesta.json();
  expect(resultado.esValido).toBe(true);
  return resultado.id as number;
}

async function iniciarSesionOperador(page: Page, credenciales: Credenciales) {
  await page.goto("/iniciar-sesion");
  await page.getByLabel("Correo electrónico o nombre de usuario").fill(credenciales.usuario);
  await page.getByLabel("Contraseña", { exact: true }).fill(credenciales.contrasena);
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname.startsWith("/mi-mercado"));
  await expect(page.getByRole("heading", { name: "Mi Mercado", exact: true, level: 1 })).toBeVisible();
}

async function registrarOperador(page: Page, datos: DatosOperadorPrecarga) {
  await page.goto("/alta-usuario");
  await page.getByRole("combobox", { name: "Rol del usuario", exact: true }).click();
  await page.getByRole("option", { name: "Operador", exact: true }).click();
  await page.locator("#nombreUsuario").fill(datos.credenciales.usuario);
  await page.locator("#contraseña").fill(datos.credenciales.contrasena);
  await page.locator("#confirmacionContraseña").fill(datos.credenciales.contrasena);
  await page.locator("#nombre").fill(datos.nombre);
  await page.locator("#numero").fill("99123456");
  await page.getByPlaceholder("Número de local").first().fill(datos.local);
  await page.getByRole("combobox", { name: "Nave", exact: true }).click();
  await page.getByRole("option").and(page.locator(`[data-value="${datos.naveId}"]`)).click();
  await page.getByRole("button", { name: "Registrar usuario", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Operador creado satisfactoriamente", exact: true })).toBeVisible();
}

async function abrirPerfilAdmin(page: Page, operador: OperadorPrecarga) {
  await page.goto(`/gestion-operadores/${operador.id}`);
  await expect(page.locator("#nombre-operador")).toHaveText(operador.nombre);
}

async function abrirAlta(page: Page) {
  await page.getByRole("button", { name: "Agregar Producto", exact: true }).click();
  const formulario = page.getByRole("dialog", { name: "Nueva publicación", exact: true });
  await expect(formulario).toBeVisible();
  return formulario;
}

async function seleccionar(page: Page, formulario: Locator, campo: string, opcion: string) {
  await formulario.getByRole("combobox", { name: campo, exact: true }).click();
  await page.getByRole("option", { name: opcion, exact: true }).click();
}

async function completarProducto(page: Page, formulario: Locator, seleccion: Seleccion, indice = 0, precio = "1371") {
  await seleccionar(page, formulario, "Especie", seleccion.especie.nombre);
  await seleccionar(page, formulario, "Variedad", seleccion.variedad.nombre);
  await seleccionar(page, formulario, "Presentación", seleccion.presentacion.nombre);
  await seleccionar(page, formulario, "País de origen", seleccion.pais.nombre);
  await seleccionar(page, formulario, "Categoría", seleccion.categoria.nombre);
  await seleccionar(page, formulario, "Calibre", seleccion.calibres[indice].nombre);
  await formulario.getByRole("textbox", { name: "Precio en pesos", exact: true }).fill(precio);
  await formulario.getByRole("textbox", { name: /Unidades/ }).fill("12");
}

async function confirmarAlta(page: Page, formulario: Locator) {
  const guardado = page.waitForResponse((respuesta) => new URL(respuesta.url()).pathname === rutaApi && respuesta.request().method() === "POST");
  await formulario.getByRole("button", { name: "Confirmar", exact: true }).click();
  const respuesta = await guardado;
  expect(respuesta.status()).toBe(201);
  const resultado = await respuesta.json();
  expect(resultado.esValido).toBe(true);
  await expect(formulario).not.toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Publicación creada correctamente.");
  return resultado.id as number;
}

function tarjetaMercado(page: Page, precio: string) {
  return page.getByRole("button", { name: precio === "0" ? "Sin precio" : `$${precio}`, exact: true }).locator(
    'xpath=ancestor::div[.//button[contains(@aria-label, "Ver detalle de")]][1]',
  );
}

async function abrirConsultaMercado(page: Page, precio: string) {
  await tarjetaMercado(page, precio).getByRole("button", { name: /Ver detalle de/ }).click();
  const consulta = page.getByRole("dialog", { name: "Consulta de publicación", exact: true });
  await expect(consulta).toBeVisible();
  return consulta;
}

async function editarPrecarga(page: Page, precioAnterior: string, precioNuevo: string) {
  const consulta = await abrirConsultaMercado(page, precioAnterior);
  await consulta.getByRole("button", { name: "Editar", exact: true }).click();
  const edicion = page.getByRole("dialog", { name: "Editar publicación", exact: true });
  await edicion.getByRole("textbox", { name: "Precio en pesos", exact: true }).fill(precioNuevo);
  await edicion.getByRole("textbox", { name: /Unidades/ }).fill("35");
  await edicion.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(consulta).toBeVisible();
  await expect(consulta.getByRole("textbox", { name: "Precio en pesos", exact: true })).toHaveValue(precioNuevo);
  await consulta.getByRole("button", { name: "Cerrar consulta", exact: true }).click();
}

test.describe("BP-14.1: precarga de productos de un Operador", () => {
  test.beforeEach(() => { test.slow(); });
  test.afterEach(async ({ page }, informacion) => {
    if (!page.isClosed()) await informacion.attach(informacion.title.match(/CP-\d+/)![0], { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  });

  test("CP-01 CA-1: acceder a la precarga desde el alta", async ({ page, precargaOperadores }) => {
    const datos = precargaOperadores.reservarOperador();
    await iniciarSesionAdministrador(page, precargaOperadores.administrador);
    await registrarOperador(page, datos);
    const operador = await precargaOperadores.db.orm.public.Operador.where({ nombreFantasia: datos.nombre }).first();
    expect(operador).not.toBeNull();
    await expect(page.getByRole("link", { name: "Precargar productos", exact: true })).toBeVisible();
    const enlace = page.getByRole("link", { name: "Precargar productos", exact: true });
    const destino = new URL((await enlace.getAttribute("href"))!, page.url());
    await enlace.click();
    await expect(page).toHaveURL((url) => url.pathname === destino.pathname);
    const respuesta = await page.reload();
    expect(respuesta?.status(), "El enlace de precarga debe abrir un flujo implementado para el nuevo Operador").toBe(200);
    const url = new URL(page.url());
    const conservaOperador = [...url.searchParams.values()].includes(String(operador!.id)) || url.pathname.split("/").includes(String(operador!.id));
    expect(conservaOperador || await page.getByText(datos.nombre, { exact: true }).count() > 0, "La precarga debe conservar el Operador recién creado").toBe(true);
  });

  test("CP-02 CA-1: precargar varios productos revisando cada uno antes de confirmar", async ({ page, precargaOperadores }, informacion) => {
    const { db, operadorA, operadorB } = precargaOperadores;
    await iniciarSesionAdministrador(page, precargaOperadores.administrador);
    const datos = precargaOperadores.reservarOperador();
    await registrarOperador(page, datos);
    const operador = await db.orm.public.Operador.where({ nombreFantasia: datos.nombre }).first();
    expect(operador).not.toBeNull();
    await page.getByRole("link", { name: "Precargar productos", exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === `/gestion-operadores/${operador!.id}`);
    await expect(page.locator("#nombre-operador")).toHaveText(datos.nombre);
    await expect(page.getByRole("heading", { name: "Publicaciones (0)", exact: true })).toBeVisible();

    const seleccion = await obtenerSeleccion(page.request);
    const precios = ["1371", "2637", "3987"];
    const ids: number[] = [];
    for (const [indice, precio] of precios.entries()) {
      await test.step(`Seleccionar, revisar y confirmar producto ${indice + 1}`, async () => {
        const formulario = await abrirAlta(page);
        await completarProducto(page, formulario, seleccion, indice, precio);
        for (const [campo, valor] of [
          ["Especie", seleccion.especie.nombre], ["Variedad", seleccion.variedad.nombre],
          ["Presentación", seleccion.presentacion.nombre], ["Categoría", seleccion.categoria.nombre],
          ["Calibre", seleccion.calibres[indice].nombre], ["País de origen", seleccion.pais.nombre],
        ]) {
          await expect(formulario.getByRole("combobox", { name: campo, exact: true })).toContainText(valor);
        }
        await expect(formulario.getByRole("textbox", { name: "Precio en pesos", exact: true })).toHaveValue(precio);
        await expect(formulario.getByRole("textbox", { name: /Unidades/ })).toHaveValue("12");
        expect(await db.orm.public.PublicacionOperador.where({ operadorId: operador!.id }).all()).toHaveLength(indice);
        await informacion.attach(`Revisión producto ${indice + 1}`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });

        ids.push(await confirmarAlta(page, formulario));
        await expect(page.getByRole("heading", { name: `Publicaciones (${indice + 1})`, exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: /^Ver detalles de/ })).toHaveCount(indice + 1);
      });
    }

    await page.reload();
    await expect(page.getByRole("heading", { name: "Publicaciones (3)", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Ver detalles de/ })).toHaveCount(3);
    const relaciones = await db.orm.public.PublicacionOperador.where({ operadorId: operador!.id }).all();
    expect(relaciones.map((relacion) => relacion.publicacionId).sort()).toEqual([...ids].sort());
    for (const [indice, id] of ids.entries()) {
      const publicacion = await db.orm.public.Publicacion.where({ id }).first();
      expect(publicacion).toMatchObject({
        presentacionId: seleccion.presentacion.id, categoriaId: seleccion.categoria.id,
        calibreId: seleccion.calibres[indice].id, cantidadUnidades: 12, tipoPublicacion: "OPERADOR",
      });
      expect(Number(publicacion!.precio)).toBe(Number(precios[indice]));
      const calibre = await db.orm.public.Calibre.where({ id: seleccion.calibres[indice].id }).select("codigoCalibre").first();
      const tarjeta = page.getByRole("button", { name: /^Ver detalles de/ }).filter({
        has: page.getByText(`${calibre!.codigoCalibre} · Categoría ${seleccion.categoria.nombre}`, { exact: true }),
      });
      await expect(tarjeta).toHaveCount(1);
      await expect(tarjeta).toContainText(new Intl.NumberFormat("es-UY").format(Number(precios[indice])));
    }
    for (const otro of [operadorA, operadorB]) {
      expect(await db.orm.public.PublicacionOperador.where({ operadorId: otro.id }).all()).toHaveLength(0);
    }
    await informacion.attach("Productos precargados", { body: JSON.stringify({ operadorId: operador!.id, relaciones }, null, 2), contentType: "application/json" });
  });

  test("CP-03: crear publicaciones desde el perfil administrativo en web y móvil", async ({ page, browser, precargaOperadores }, informacion) => {
    const { db, operadorA, operadorB } = precargaOperadores;
    await iniciarSesionAdministrador(page, precargaOperadores.administrador);
    const seleccion = await obtenerSeleccion(page.request);
    const estadoSesion = await page.context().storageState();
    const registros: unknown[] = [];
    for (const [indice, dispositivo] of ["web", "móvil"].entries()) {
      await test.step(`Alta en ${dispositivo}`, async () => {
        const contexto = await browser.newContext({ baseURL: informacion.project.use.baseURL, storageState: estadoSesion, ...(dispositivo === "móvil" ? devices["Pixel 7"] : devices["Desktop Chrome"]) });
        const pagina = await contexto.newPage();
        try {
          await abrirPerfilAdmin(pagina, operadorA);
          await expect(pagina.getByRole("heading", { name: `Publicaciones (${indice})`, exact: true })).toBeVisible();
          const formulario = await abrirAlta(pagina);
          await completarProducto(pagina, formulario, seleccion, indice, indice === 0 ? "1371" : "");
          const id = await confirmarAlta(pagina, formulario);
          await expect(pagina.getByRole("heading", { name: `Publicaciones (${indice + 1})`, exact: true })).toBeVisible();
          const publicacion = await db.orm.public.Publicacion.where({ id }).first();
          expect(await db.orm.public.PublicacionOperador.where({ publicacionId: id, operadorId: operadorA.id }).first()).not.toBeNull();
          expect(publicacion!.tipoPublicacion).toBe("OPERADOR");
          if (indice === 0) expect(Number(publicacion!.precio)).toBe(1371);
          else expect(publicacion!.precio).toBeNull();
          registros.push(publicacion);
          await informacion.attach(`Alta ${dispositivo}`, { body: await pagina.screenshot({ fullPage: true }), contentType: "image/png" });
          await abrirPerfilAdmin(pagina, operadorB);
          await expect(pagina.getByRole("heading", { name: "Publicaciones (0)", exact: true })).toBeVisible();
        } finally { await contexto.close(); }
      });
    }
    expect(await db.orm.public.PublicacionOperador.where({ operadorId: operadorA.id }).all()).toHaveLength(2);
    expect(await db.orm.public.PublicacionOperador.where({ operadorId: operadorB.id }).all()).toHaveLength(0);
    await informacion.attach("Precargas registradas", { body: JSON.stringify(registros, null, 2), contentType: "application/json" });
  });

  test("CP-04 CA-2: consultar las precargas como Operador", async ({ page, precargaOperadores }) => {
    const { db, operadorA, operadorB } = precargaOperadores;
    await iniciarSesionAdministrador(page, precargaOperadores.administrador);
    const seleccion = await obtenerSeleccion(page.request);
    const ids = [await crearPrecarga(page.request, operadorA.id, seleccion), await crearPrecarga(page.request, operadorA.id, seleccion, 1, "2637")];
    await crearPrecarga(page.request, operadorB.id, seleccion, 0, "3987");
    await page.context().clearCookies();
    await iniciarSesionOperador(page, operadorA.credenciales);
    for (const precio of ["1371", "2637"]) {
      const consulta = await abrirConsultaMercado(page, precio);
      await expect(consulta.getByRole("combobox", { name: "Especie", exact: true })).toContainText(seleccion.especie.nombre);
      await expect(consulta.getByRole("textbox", { name: "Precio en pesos", exact: true })).toHaveValue(precio);
      await consulta.getByRole("button", { name: "Cerrar consulta", exact: true }).click();
    }
    await expect(tarjetaMercado(page, "3987")).toHaveCount(0);
    await page.reload();
    for (const precio of ["1371", "2637"]) await expect(tarjetaMercado(page, precio)).toBeVisible();
    const respuesta = await page.request.get(`/api/publicaciones/operador/${operadorA.id}`);
    expect(respuesta.status()).toBe(200);
    expect((await respuesta.json()).publicaciones.map((publicacion: { id: number }) => publicacion.id).sort()).toEqual([...ids].sort());
    expect(await db.orm.public.PublicacionOperador.where({ operadorId: operadorA.id }).all()).toHaveLength(2);
  });

  test("CP-05 CA-3 CA-4: completar y modificar las precargas originales", async ({ page, precargaOperadores }, informacion) => {
    const { db, operadorA } = precargaOperadores;
    await iniciarSesionAdministrador(page, precargaOperadores.administrador);
    const seleccion = await obtenerSeleccion(page.request);
    const idSinPrecio = await crearPrecarga(page.request, operadorA.id, seleccion, 0, "");
    const idConPrecio = await crearPrecarga(page.request, operadorA.id, seleccion, 1, "2637");
    const originalSegunda = await db.orm.public.Publicacion.where({ id: idConPrecio }).first();
    await page.context().clearCookies();
    await iniciarSesionOperador(page, operadorA.credenciales);
    await editarPrecarga(page, "0", "1482");
    expect(await db.orm.public.Publicacion.where({ id: idConPrecio }).first()).toEqual(originalSegunda);
    await editarPrecarga(page, "2637", "2750");
    await page.reload();
    await expect(tarjetaMercado(page, "1482")).toBeVisible();
    await expect(tarjetaMercado(page, "2750")).toBeVisible();
    await page.context().clearCookies();
    await iniciarSesionOperador(page, operadorA.credenciales);
    const relaciones = await db.orm.public.PublicacionOperador.where({ operadorId: operadorA.id }).all();
    expect(relaciones.map((relacion) => relacion.publicacionId).sort()).toEqual([idSinPrecio, idConPrecio].sort());
    const publicaciones = [];
    for (const [id, precio] of [[idSinPrecio, 1482], [idConPrecio, 2750]]) {
      const publicacion = await db.orm.public.Publicacion.where({ id }).first();
      expect(Number(publicacion!.precio)).toBe(precio);
      expect(publicacion!.cantidadUnidades).toBe(35);
      publicaciones.push(publicacion);
      await expect(tarjetaMercado(page, String(precio))).toBeVisible();
    }
    await informacion.attach("Precargas actualizadas", { body: JSON.stringify({ relaciones, publicaciones }, null, 2), contentType: "application/json" });
  });

  test("CP-06: consultar los cambios del Operador y abrir el perfil correspondiente al rol en web y móvil", async ({ page, browser, precargaOperadores }, informacion) => {
    const { operadorA } = precargaOperadores;
    await iniciarSesionAdministrador(page, precargaOperadores.administrador);
    const seleccion = await obtenerSeleccion(page.request);
    await crearPrecarga(page.request, operadorA.id, seleccion);
    await page.context().clearCookies();
    await iniciarSesionOperador(page, operadorA.credenciales);
    await editarPrecarga(page, "1371", "1482");
    await page.context().clearCookies();
    await iniciarSesionAdministrador(page, precargaOperadores.administrador);
    await abrirPerfilAdmin(page, operadorA);
    const tarjetaAdmin = page.getByRole("button", { name: /^Ver detalles de/ });
    await tarjetaAdmin.click();
    const consulta = page.getByRole("dialog", { name: "Consulta de publicación", exact: true });
    await expect(consulta.getByRole("textbox", { name: "Precio en pesos", exact: true })).toHaveValue("1482");
    await consulta.getByRole("button", { name: "Cerrar consulta", exact: true }).click();
    const sesionAdmin = await page.context().storageState();
    for (const dispositivo of ["web", "móvil"]) {
      for (const conSesion of [true, false]) {
        await test.step(`Ver Perfil ${dispositivo}, ${conSesion ? "Administrador" : "público"}`, async () => {
          const contexto = await browser.newContext({ baseURL: informacion.project.use.baseURL, ...(conSesion ? { storageState: sesionAdmin } : {}), ...(dispositivo === "móvil" ? devices["Pixel 7"] : devices["Desktop Chrome"]) });
          const pagina = await contexto.newPage();
          try {
            await pagina.goto(`/publicaciones?especie=${encodeURIComponent(seleccion.especie.nombre)}`);
            const tarjeta = pagina.getByRole("button", { name: /^Ver detalles de/ }).filter({ hasText: operadorA.nombre });
            await expect(tarjeta).toHaveCount(1);
            await tarjeta.click();
            const detalle = pagina.getByRole("dialog", { name: "Detalle de publicación", exact: true });
            const rutaEsperada = conSesion ? `/gestion-operadores/${operadorA.id}` : `/operadores/${encodeURIComponent(operadorA.nombre)}`;
            const enlaceEsperado = conSesion ? rutaEsperada : `${rutaEsperada}?origen=publicaciones`;
            await expect.soft(detalle.getByRole("link", { name: "Ver Perfil", exact: true })).toHaveAttribute("href", enlaceEsperado);
            await detalle.getByRole("link", { name: "Ver Perfil", exact: true }).click();
            await expect.soft(pagina).toHaveURL((url) => `${url.pathname}${url.search}` === enlaceEsperado);
            await informacion.attach(`Perfil ${dispositivo} ${conSesion ? "admin" : "público"}`, { body: await pagina.screenshot({ fullPage: true }), contentType: "image/png" });
          } finally { await contexto.close(); }
        });
      }
    }
  });

  test("CP-07: omitir o cancelar la precarga sin guardar productos", async ({ page, precargaOperadores }) => {
    const { db, operadorA } = precargaOperadores;
    await iniciarSesionAdministrador(page, precargaOperadores.administrador);
    const datos = precargaOperadores.reservarOperador();
    await registrarOperador(page, datos);
    await page.getByRole("button", { name: "Ahora no", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Operador creado satisfactoriamente", exact: true })).not.toBeVisible();
    const nuevo = await db.orm.public.Operador.where({ nombreFantasia: datos.nombre }).first();
    expect(nuevo).not.toBeNull();
    expect(await db.orm.public.PublicacionOperador.where({ operadorId: nuevo!.id }).all()).toHaveLength(0);
    const seleccion = await obtenerSeleccion(page.request);
    await abrirPerfilAdmin(page, operadorA);
    const formulario = await abrirAlta(page);
    await completarProducto(page, formulario, seleccion);
    const envios: string[] = [];
    page.on("request", (solicitud) => { if (new URL(solicitud.url()).pathname === rutaApi && solicitud.method() === "POST") envios.push(solicitud.url()); });
    await formulario.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(formulario).not.toBeVisible();
    expect(envios).toHaveLength(0);
    expect(await db.orm.public.PublicacionOperador.where({ operadorId: operadorA.id }).all()).toHaveLength(0);
    expect(await db.orm.public.Usuario.where({ id: nuevo!.usuarioId }).first()).not.toBeNull();
  });

  test("CP-08: validar destinatario y datos antes de guardar", async ({ page, precargaOperadores }) => {
    const { db, operadorA } = precargaOperadores;
    await iniciarSesionAdministrador(page, precargaOperadores.administrador);
    const seleccion = await obtenerSeleccion(page.request);
    const datos: Partial<ReturnType<typeof datosValidos>> = datosValidos(operadorA.id, seleccion);
    delete datos.operadorId;
    const inexistente = Math.max(...(await db.orm.public.Operador.select("id").all()).map((operador) => operador.id)) + 1000;
    const invalidos = [
      { datos, estado: 400 },
      { datos: { ...datosValidos(inexistente, seleccion) }, estado: 404 },
      ...["especieId", "variedadId", "presentacionId", "categoriaId", "calibreId", "paisId"].map((campo) => ({ datos: { ...datosValidos(operadorA.id, seleccion), [campo]: 0 }, estado: 400 })),
      { datos: { ...datosValidos(operadorA.id, seleccion), precio: "texto" }, estado: 400 },
    ];
    const cantidadPublicaciones = await db.orm.public.Publicacion.select("id").all();
    const cantidadRelaciones = await db.orm.public.PublicacionOperador.select("id").all();
    for (const invalido of invalidos) {
      const respuesta = await page.request.post(rutaApi, { data: invalido.datos });
      expect(respuesta.status()).toBe(invalido.estado);
      expect((await respuesta.json()).errores.length).toBeGreaterThan(0);
    }
    expect(await db.orm.public.Publicacion.select("id").all()).toHaveLength(cantidadPublicaciones.length);
    expect(await db.orm.public.PublicacionOperador.select("id").all()).toHaveLength(cantidadRelaciones.length);
    const id = await crearPrecarga(page.request, operadorA.id, seleccion);
    expect(await db.orm.public.PublicacionOperador.where({ operadorId: operadorA.id }).all()).toHaveLength(1);
    expect(await db.orm.public.Publicacion.where({ id }).first()).not.toBeNull();
  });

  test("CP-09: verificar roles y propiedad al crear publicaciones", async ({ page, precargaOperadores }) => {
    const { db, operadorA, operadorB } = precargaOperadores;
    await iniciarSesionAdministrador(page, precargaOperadores.administrador);
    const seleccion = await obtenerSeleccion(page.request);
    await crearPrecarga(page.request, operadorA.id, seleccion);
    await crearPrecarga(page.request, operadorB.id, seleccion);
    await page.context().clearCookies();
    await iniciarSesionOperador(page, operadorA.credenciales);
    await crearPrecarga(page.request, operadorA.id, seleccion, 1);
    expect((await page.request.post(rutaApi, { data: datosValidos(operadorB.id, seleccion, 1) })).status()).toBe(403);
    await page.context().clearCookies();
    await iniciarSesionProductor(page, precargaOperadores.productor);
    expect((await page.request.post(rutaApi, { data: datosValidos(operadorA.id, seleccion, 2) })).status()).toBe(403);
    await page.context().clearCookies();
    expect((await page.request.post(rutaApi, { data: datosValidos(operadorA.id, seleccion, 2) })).status()).toBe(401);
    expect(await db.orm.public.PublicacionOperador.where({ operadorId: operadorA.id }).all()).toHaveLength(2);
    expect(await db.orm.public.PublicacionOperador.where({ operadorId: operadorB.id }).all()).toHaveLength(1);
  });
});
