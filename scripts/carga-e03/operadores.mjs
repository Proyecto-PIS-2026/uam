import assert from "node:assert/strict";

export async function iniciarSesion(browser, baseURL, usuario, password, timeout) {
  const context = await browser.newContext({ baseURL });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(timeout);
    await page.goto("/iniciar-sesion", { waitUntil: "domcontentloaded" });
    await page.getByLabel("Correo electrónico o nombre de usuario").fill(usuario);
    await page.getByLabel("Contraseña", { exact: true }).fill(password);
    const urlDeDestino = /\/mi-mercado(?:\/|$)/;
    const navegacion = page.waitForURL(urlDeDestino, { waitUntil: "domcontentloaded", timeout })
      .then(() => ({ ok: true }));
    const accion = page.waitForResponse(respuesta =>
      respuesta.request().method() === "POST"
      && Boolean(respuesta.request().headers()["next-action"]), { timeout });
    const resultadoAccion = accion.then(async respuesta => {
      const boton = page.getByRole("button", { name: "Iniciar sesión", exact: true });
      await boton.waitFor({ state: "visible", timeout: 8_000 }).catch(() => {});
      if (urlDeDestino.test(new URL(page.url()).pathname)) return { ok: true };
      const mensajes = (await page.locator('[role="alert"]').allTextContents())
        .map(texto => texto.trim()).filter(Boolean);
      return {
        ok: false,
        mensaje: mensajes.join(" | ") || "La acción terminó sin redirigir ni mostrar un mensaje.",
        estadoHttp: respuesta.status(),
        botonVisible: await boton.isVisible().catch(() => false),
      };
    });
    await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
    const resultado = await Promise.race([navegacion, resultadoAccion]);
    if (!resultado.ok) throw new Error("El acceso no llegó a Mi Mercado: " + JSON.stringify(resultado));
    return { context, page, usuario };
  } catch (error) {
    const url = await pageUrl(context);
    await context.close();
    throw new Error("Inicio de sesión de " + usuario + " (URL: " + url + "): " + error.message, { cause: error });
  }
}

async function pageUrl(context) {
  try { return context.pages()[0]?.url() ?? "desconocida"; }
  catch { return "desconocida"; }
}

export async function leerPropias(sesion, operadorId = sesion.operadorId, { reintentos = 0 } = {}) {
  let respuesta;
  for (let intento = 0; intento <= reintentos; intento++) {
    respuesta = await sesion.context.request.get("/api/publicaciones/operador/" + operadorId);
    if (respuesta.status() === 200) break;
    if (respuesta.status() < 500 || intento === reintentos) {
      assert.equal(respuesta.status(), 200, "Lectura de publicaciones propias de " + sesion.usuario);
    }
    await new Promise(resolve => setTimeout(resolve, 750 * (intento + 1)));
  }
  const { publicaciones } = await respuesta.json();
  assert.ok(Array.isArray(publicaciones));
  return publicaciones;
}

export async function identificarOperador(sesion) {
  const r = await sesion.context.request.get("/api/publicaciones");
  assert.equal(r.status(), 200);
  const catalogo = await r.json();
  const esperado = "Prueba Carga E03 " + sesion.usuario.slice(-2);
  assert.equal(catalogo.operadores.length, 1);
  assert.equal(catalogo.operadores[0].nombre, esperado, "No se pudo verificar el propietario de los datos de prueba");
  sesion.nombre = esperado;
  sesion.operadorId = catalogo.operadores[0].id;
  sesion.especies = catalogo.especies;
  sesion.inventarioInicial = await leerPropias(sesion, sesion.operadorId, { reintentos: 2 });
}

export async function prepararInterfazOperador(sesion) {
  const respuesta = await sesion.page.goto("/mi-mercado", { waitUntil: "domcontentloaded" });
  if (respuesta) assert.equal(respuesta.status(), 200);
  await sesion.page.getByRole("button", {
    name: "Ver detalle de " + sesion.registro.especie, exact: true,
  }).first().waitFor({ state: "visible" });
}

export async function crearPublicacion(sesion, posicion, creadas) {
  const ocupadas = new Set((await leerPropias(sesion, sesion.operadorId, { reintentos: 2 })).map(p => p.especie));
  const especies = sesion.especies;
  for (let i = 0; i < especies.length; i++) {
    const especie = especies[(posicion + i) % especies.length];
    if (ocupadas.has(especie.nombre)) continue;
    const r = await sesion.context.request.post("/api/publicaciones", { data: {
      operadorId: sesion.operadorId, especieId: especie.id, precio: "1000", disponibilidad: true,
      variedadId: null, envaseId: null, kilosId: null, categoriaId: null, calibreId: null, paisId: null,
      cantidadUnidades: null, fotografia: "",
    } });
    const body = await r.json();
    if (r.status() === 400 && body.errores?.some(e => /ya tiene una publicación/i.test(e))) continue;
    assert.equal(r.status(), 201, "Alta de prueba de " + sesion.usuario + ": " + JSON.stringify(body.errores));
    assert.ok(Number.isInteger(body.id));
    const registro = { usuario: sesion.usuario, operadorId: sesion.operadorId, id: body.id, especie: especie.nombre, especieId: especie.id, version: 1, precio: 1000 };
    creadas.push(registro);
    const propia = (await leerPropias(sesion, sesion.operadorId, { reintentos: 2 })).find(p => p.id === registro.id);
    assert.ok(propia && Number(propia.precio) === registro.precio, "Alta sin persistencia verificada");
    return registro;
  }
  throw new Error("No quedan especies libres para " + sesion.usuario);
}

export function enviarPrecio(sesion, registro, precio, version = registro.version) {
  const cambios = { version, precio: String(precio), especieId: registro.especieId, disponible: true,
    variedadId: null, envaseId: null, kilosId: null, categoriaId: null, calibreId: null, paisId: null,
    cantidadUnidades: null, foto: null };
  return sesion.context.request.patch("/api/publicaciones/" + registro.id + "?operadorId=" + registro.operadorId,
    { multipart: { cambios: JSON.stringify(cambios) } });
}

export async function cambiarPrecio(sesion, registro, precio) {
  const r = await enviarPrecio(sesion, registro, precio);
  const body = await r.json();
  assert.equal(r.status(), 200, "PATCH de " + registro.id + ": " + JSON.stringify(body.errores));
  assert.equal(body.publicacionId, registro.id);
  registro.precio = precio;
  registro.version++;
  return r.status();
}

export async function cambiarPrecioDesdePantalla(sesion, registro, precio) {
  const { page } = sesion;
  const detalle = page.getByRole("button", { name: "Ver detalle de " + registro.especie, exact: true }).first();
  const tarjeta = detalle.locator("xpath=..");
  const editar = tarjeta.getByTitle("Editar precio", { exact: true });
  await editar.click();
  const entrada = tarjeta.getByRole("textbox", { name: "Editar precio", exact: true });
  const respuestaPendiente = page.waitForResponse(r =>
    r.request().method() === "POST" && Boolean(r.request().headers()["next-action"]))
    .then(respuesta => ({ respuesta }), error => ({ error }));
  await entrada.fill(String(precio));
  await entrada.press("Enter");
  const resultado = await respuestaPendiente;
  if (resultado.error) throw resultado.error;
  const respuesta = resultado.respuesta;
  assert.equal(respuesta.status(), 200, "Edición de precio desde la interfaz de " + sesion.usuario);
  const botonPrecio = tarjeta.getByTitle("Editar precio", { exact: true });
  await botonPrecio.waitFor({ state: "visible" });
  const mostrado = Number((await botonPrecio.innerText()).replace(/[^\d]/g, ""));
  assert.equal(mostrado, precio, "El precio actualizado no aparece en la tarjeta " + registro.id);
  const propia = (await leerPropias(sesion)).find(publicacion => publicacion.id === registro.id);
  assert.equal(Number(propia?.precio), precio, "El precio actualizado no se persistió para " + registro.id);
  registro.precio = precio;
  registro.version++;
  return { http: respuesta.status(), precio };
}

export async function crearPublicacionDesdePantalla(sesion, posicion, creadas) {
  const propias = await leerPropias(sesion);
  const ocupadas = new Set(propias.map(publicacion => publicacion.especie));
  const especie = sesion.especies.find((opcion, indice) =>
    !ocupadas.has(opcion.nombre) && indice >= posicion);
  const alternativa = especie ?? sesion.especies.find(opcion => !ocupadas.has(opcion.nombre));
  assert.ok(alternativa, "No quedan especies disponibles para " + sesion.usuario);

  const { page } = sesion;
  await page.getByRole("button", { name: "Nueva publicación", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Nueva publicación" });
  await dialog.waitFor({ state: "visible" });
  const selector = dialog.getByRole("combobox", { name: "Especie", exact: true });
  await selector.click();
  await page.getByRole("option", { name: alternativa.nombre, exact: true }).click();
  await dialog.getByRole("textbox", { name: "Precio en pesos", exact: true }).fill("1000");
  const respuestaPendiente = page.waitForResponse(r =>
    r.request().method() === "POST" && new URL(r.url()).pathname === "/api/publicaciones")
    .then(respuesta => ({ respuesta }), error => ({ error }));
  await dialog.getByRole("button", { name: "Confirmar", exact: true }).click();
  const resultado = await respuestaPendiente;
  if (resultado.error) throw resultado.error;
  const respuesta = resultado.respuesta;
  const body = await respuesta.json();
  assert.equal(respuesta.status(), 201, "Alta desde la interfaz de " + sesion.usuario);
  assert.ok(Number.isInteger(body.id), "El alta no devolvió un identificador");
  const registro = {
    usuario: sesion.usuario, operadorId: sesion.operadorId, id: body.id,
    especie: alternativa.nombre, especieId: alternativa.id, version: 1, precio: 1000,
    http: respuesta.status(),
  };
  creadas.push(registro);
  await dialog.waitFor({ state: "hidden" });
  const propia = (await leerPropias(sesion)).find(publicacion => publicacion.id === registro.id);
  assert.ok(propia && Number(propia.precio) === registro.precio, "El alta desde la interfaz no persistió " + registro.id);
  return registro;
}

export async function verificarConflictoEnPantalla(escritor, lector, registro) {
  const page = lector.page;
  await page.goto("/mi-mercado", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Ver detalle de " + registro.especie, exact: true }).first().click();
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  const precioConfirmado = registro.precio + 1;
  const precioRechazado = registro.precio + 2;
  await page.getByRole("textbox", { name: "Precio en pesos" }).fill(String(precioRechazado));
  await cambiarPrecio(escritor, registro, precioConfirmado);
  const [respuesta] = await Promise.all([
    page.waitForResponse(r => r.request().method() === "PATCH" && new URL(r.url()).pathname === "/api/publicaciones/" + registro.id),
    page.getByRole("button", { name: "Guardar", exact: true }).click(),
  ]);
  assert.equal(respuesta.status(), 409);
  const { errores } = await respuesta.json();
  assert.ok(errores?.[0], "Conflicto sin mensaje");
  await page.getByText(errores[0], { exact: true }).first().waitFor({ state: "visible" });
  assert.equal(await page.getByText(/publicación (modificada correctamente|actualizada)\./i).count(), 0);
  assert.equal(Number((await leerPropias(escritor)).find(p => p.id === registro.id)?.precio), precioConfirmado);
  return { publicacion: registro.id, http: 409, mensaje: errores[0], precioConfirmado, precioRechazado };
}

export async function verificarVistas(browser, baseURL, sesion, operador, registros) {
  await sesion.page.reload({ waitUntil: "domcontentloaded" });
  const publicas = await browser.newContext({ baseURL });
  try {
    const page = await publicas.newPage();
    await page.goto("/operadores/" + encodeURIComponent(operador.nombre), { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: operador.nombre, exact: true }).waitFor();
    const propias = await leerPropias(sesion, operador.operadorId);
    const datos = [];
    for (const reg of registros) {
      const item = propias.find(p => p.id === reg.id);
      assert.ok(item, "Publicación propia ausente: " + reg.id);
      assert.equal(Number(item.precio), reg.precio);
      const detalle = sesion.page.getByRole("button", { name: "Ver detalle de " + reg.especie, exact: true }).first();
      const precioVisible = await detalle.locator("xpath=..").getByTitle("Editar precio", { exact: true }).innerText();
      const ficha = page.getByRole("button", { name: "Ver detalles de " + reg.especie, exact: true });
      const precioPublico = (await ficha.innerText()).match(/\$\s*([\d.]+)/);
      assert.equal(Number(precioVisible.replace(/[^\d]/g, "")), reg.precio, "Precio en la vista propietaria de " + reg.id);
      assert.ok(precioPublico && Number(precioPublico[1].replaceAll(".", "")) === reg.precio, "Precio público de " + reg.id);
      datos.push({ id: reg.id, precio: reg.precio });
    }
    const nuevas = new Set(registros.map(r => r.id));
    assert.deepEqual(propias.filter(p => !nuevas.has(p.id)), operador.inventarioInicial, "Cambió otra publicación de " + operador.usuario);
    return datos;
  } finally { await publicas.close(); }
}
