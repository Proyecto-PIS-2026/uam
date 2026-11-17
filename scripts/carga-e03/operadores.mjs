import assert from "node:assert/strict";
import { expect } from "@playwright/test";
import { paso } from "./diagnostico.mjs";

export async function iniciarSesion(browser, baseURL, usuario, password, timeout = 45_000) {
  const context = await browser.newContext({ baseURL, viewport: { width: 1366, height: 900 } });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(timeout);
    await page.goto("/iniciar-sesion", { waitUntil: "domcontentloaded" });
    await page.getByLabel("Correo electrónico o nombre de usuario").fill(usuario);
    await page.getByLabel("Contraseña", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
    await page.waitForURL(/\/mi-mercado(?:\/|$)/, { waitUntil: "domcontentloaded", timeout });
    await expect(page.getByRole("heading", { name: "Mi Mercado", exact: true })).toBeVisible({ timeout });
    return { context, page, usuario, baseURL, timeout, storageState: await context.storageState() };
  } catch (error) {
    await context.close();
    throw error;
  }
}

export async function obtenerEspeciesLibres(sesion, rol) {
  return paso(sesion, "consultar_especies_libres", async () => {
    const { page, timeout } = sesion;
    await page.goto(rol === "PRODUCTOR" ? "/mi-mercado/productor" : "/mi-mercado", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Mi Mercado", exact: true })).toBeVisible({ timeout });
    const usadas = new Set(await page.getByRole("button", { name: /^Ver detalle de / }).evaluateAll(botones =>
      botones.map(boton => boton.getAttribute("aria-label").replace(/^Ver detalle de /, "")),
    ));
    await page.getByRole("button", { name: "Nueva publicación", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: rol === "PRODUCTOR" ? "Nueva publicación de Productor" : "Nueva publicación", exact: true });
    await dialog.getByRole("combobox", { name: /^Especie(?:\s*\*)?$/ }).click();
    const opciones = page.getByRole("option", { disabled: false });
    await opciones.first().waitFor();
    const disponibles = (await opciones.allTextContents()).map(texto => texto.trim()).filter(Boolean);
    await page.keyboard.press("Escape");
    await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    return disponibles.filter(nombre => ![...usadas].some(usada => usada === nombre || usada.startsWith(nombre + " · ")));
  }, { rol });
}

function observarEnvio(sesion, metodo, ruta) {
  const { page, timeout } = sesion;
  let solicitud, resolverSolicitud, resolverRespuesta;
  const enviada = new Promise(resolve => { resolverSolicitud = resolve; });
  const recibida = new Promise(resolve => { resolverRespuesta = resolve; });
  const alEnviar = request => {
    if (!solicitud && request.method() === metodo && new URL(request.url()).pathname === ruta) {
      solicitud = request;
      resolverSolicitud({ solicitud });
      sesion.diagnostico?.anotar("solicitud_emitida", { metodo, ruta });
    }
  };
  const alResponder = response => {
    if (response.request() === solicitud) resolverRespuesta({ respuesta: response });
  };
  const alFallar = request => {
    if (request === solicitud) resolverRespuesta({ error: "La solicitud falló: " + request.failure()?.errorText });
  };
  const alCerrar = () => {
    const resultado = { error: "La página se cerró mientras se esperaba " + metodo + " " + ruta };
    resolverSolicitud(resultado);
    resolverRespuesta(resultado);
  };
  page.on("request", alEnviar);
  page.on("response", alResponder);
  page.on("requestfailed", alFallar);
  page.on("close", alCerrar);
  async function esperar(promesa, descripcion) {
    let temporizador;
    try {
      const resultado = await Promise.race([
        promesa,
        new Promise((_, reject) => {
          temporizador = setTimeout(() => reject(new Error("No se " + descripcion + " " + metodo + " " + ruta + " en " + timeout + " ms")), timeout);
        }),
      ]);
      assert.ok(!resultado.error, resultado.error);
      return resultado;
    } finally { clearTimeout(temporizador); }
  }
  return {
    async solicitud() { return (await esperar(enviada, "emitió la solicitud")).solicitud; },
    async respuesta() { return (await esperar(recibida, "recibió la respuesta de")).respuesta; },
    cerrar() {
      page.off("request", alEnviar);
      page.off("response", alResponder);
      page.off("requestfailed", alFallar);
      page.off("close", alCerrar);
    },
  };
}

function cambiosEnviados(solicitud) {
  const contenido = solicitud.postData() ?? "";
  const parte = /name="cambios"\r?\n\r?\n([^\r\n]*)/.exec(contenido);
  assert.ok(parte, "La solicitud PATCH debe incluir los cambios del formulario");
  return JSON.parse(parte[1]);
}

async function irAMercado(sesion) {
  await paso(sesion, "navegar_mi_mercado", async () => {
    const respuesta = await sesion.page.goto("/mi-mercado", { waitUntil: "domcontentloaded" });
    assert.equal(respuesta?.status(), 200, "Navegación a Mi Mercado");
    await expect(sesion.page.getByRole("heading", { name: "Mi Mercado", exact: true })).toBeVisible({ timeout: sesion.timeout });
  });
}

async function abrirPropia(sesion, registro) {
  await irAMercado(sesion);
  return paso(sesion, "abrir_consulta_propia", async () => {
    assert.equal(registro.usuario, sesion.usuario, "La publicación debe pertenecer a la sesión que la consulta");
    assert.equal(registro.propietario, sesion.nombre, "Nombre del propietario de la publicación de prueba");
    await sesion.page.getByRole("button", { name: "Ver detalle de " + registro.especie, exact: true }).first().click();
    const consulta = sesion.page.getByRole("dialog", { name: "Consulta de publicación", exact: true });
    await expect(consulta).toBeVisible({ timeout: sesion.timeout });
    await expect(consulta.getByRole("textbox", { name: "Comentario", exact: true })).toHaveValue(registro.etiqueta, { timeout: sesion.timeout });
    const campo = consulta.getByRole("textbox", { name: "Precio en pesos", exact: true });
    const id = await campo.getAttribute("id");
    const relacion = /^editar-publicacion-([1-9]\d*)-precio$/.exec(id ?? "");
    assert.ok(relacion, "El campo debe identificar la relación de la publicación consultada");
    const relacionId = Number(relacion[1]);
    if (registro.relacionId != null) assert.equal(relacionId, registro.relacionId, "La relación seleccionada cambió");
    registro.relacionId = relacionId;
    sesion.diagnostico?.anotar("publicacion_seleccionada", { publicacionId: registro.id, relacionId, propietario: registro.propietario, campoId: id });
    return consulta;
  }, { publicacionId: registro.id, especie: registro.especie });
}

export async function crearPublicacionOperadorDesdePantalla(sesion, especie, precio, etiqueta, creadas) {
  await irAMercado(sesion);
  const { page, timeout } = sesion;
  const dialog = page.getByRole("dialog", { name: "Nueva publicación", exact: true });
  await paso(sesion, "abrir_alta_operador", async () => {
    await page.getByRole("button", { name: "Nueva publicación", exact: true }).click();
    await expect(dialog).toBeVisible({ timeout });
  });
  await paso(sesion, "completar_alta_operador", async () => {
    await dialog.getByRole("combobox", { name: /^Especie(?:\s*\*)?$/ }).click();
    await page.getByRole("option", { name: especie, exact: true }).click();
    const campo = dialog.getByRole("textbox", { name: "Precio en pesos", exact: true });
    await expect(campo).toBeEditable({ timeout });
    await campo.fill(String(precio));
    await expect(campo).toHaveValue(String(precio), { timeout });
    await dialog.getByRole("textbox", { name: "Comentario", exact: true }).fill(etiqueta);
  }, { especie, precio });
  const envio = observarEnvio(sesion, "POST", "/api/publicaciones");
  let registro;
  try {
    await paso(sesion, "confirmar_alta_operador", async () => {
      const boton = dialog.getByRole("button", { name: "Confirmar", exact: true });
      await expect(boton).toBeEnabled({ timeout });
      await boton.click();
    });
    const solicitud = await paso(sesion, "alta_operador_solicitud_emitida", () => envio.solicitud());
    const respuesta = await paso(sesion, "alta_operador_respuesta", () => envio.respuesta());
    await paso(sesion, "alta_operador_guardada", async () => {
      const body = await respuesta.json();
      assert.equal(respuesta.status(), 201, "Alta UI operador: " + JSON.stringify(body.errores));
      assert.ok(Number.isSafeInteger(body.id));
      const enviados = solicitud.postDataJSON();
      registro = { id: body.id, operadorId: enviados.operadorId, especieId: enviados.especieId, especie, precio, etiqueta, nombre: sesion.nombre, propietario: sesion.nombre, usuario: sesion.usuario, rol: "OPERADOR" };
      creadas.push(registro);
      assert.equal(Number(enviados.precio), precio, "Precio enviado en el alta");
      sesion.diagnostico?.anotar("alta_confirmada", { publicacionId: registro.id, operadorId: registro.operadorId, precio, http: respuesta.status() });
    });
  } finally { envio.cerrar(); }
  await verificarPersistenciaOperadorPorApi(sesion, registro, precio);
  await paso(sesion, "alta_operador_cierra_drawer", () => expect(dialog).toBeHidden({ timeout }));
  await verificarPropiaOperadorDesdePantalla(sesion, registro);
  return registro;
}

export async function cambiarPrecioOperadorDesdePantalla(sesion, registro, precio, { antesDeCompletar } = {}) {
  const consulta = await abrirPropia(sesion, registro);
  const { page, timeout } = sesion;
  await paso(sesion, "clic_editar_operador", async () => {
    const boton = consulta.getByRole("button", { name: "Editar", exact: true });
    await expect(boton).toBeEnabled({ timeout });
    await boton.click();
  }, { publicacionId: registro.id });
  const dialog = page.getByRole("dialog", { name: "Editar publicación", exact: true });
  await paso(sesion, "drawer_edicion_operador_visible", () => expect(dialog).toBeVisible({ timeout }));
  const campo = dialog.getByRole("textbox", { name: "Precio en pesos", exact: true });
  await paso(sesion, "precio_operador_editable", async () => {
    await expect(campo).toHaveAttribute("id", "editar-publicacion-" + registro.relacionId + "-precio", { timeout });
    await expect(campo).toBeEditable({ timeout });
  });
  await antesDeCompletar?.({ page, dialog, campo });
  await paso(sesion, "completar_precio_operador", async () => {
    await campo.fill(String(precio));
    await expect(campo).toHaveValue(String(precio), { timeout });
  }, { publicacionId: registro.id, anterior: registro.precio, esperado: precio });
  const ruta = "/api/publicaciones/" + registro.id;
  const envio = observarEnvio(sesion, "PATCH", ruta);
  let estado;
  try {
    await paso(sesion, "clic_guardar_operador", async () => {
      const boton = dialog.getByRole("button", { name: "Guardar", exact: true });
      await expect(boton).toBeEnabled({ timeout });
      await expect(campo).toHaveValue(String(precio), { timeout });
      await boton.click();
    });
    const solicitud = await paso(sesion, "guardado_operador_solicitud_emitida", () => envio.solicitud(), { publicacionId: registro.id, ruta, precio });
    await paso(sesion, "guardado_operador_datos_enviados", async () => {
      const cambios = cambiosEnviados(solicitud);
      assert.equal(Number(new URL(solicitud.url()).searchParams.get("operadorId")), registro.operadorId);
      assert.equal(Number(cambios.precio), precio, "Precio enviado por el formulario");
      assert.ok(Number.isSafeInteger(cambios.version) && cambios.version >= 0, "Versión enviada por el formulario");
      sesion.diagnostico?.anotar("cambios_enviados", { publicacionId: registro.id, operadorId: registro.operadorId, precio: Number(cambios.precio), version: cambios.version });
    });
    const respuesta = await paso(sesion, "guardado_operador_respuesta", () => envio.respuesta());
    await paso(sesion, "guardado_operador_respuesta_valida", async () => {
      const body = await respuesta.json();
      estado = respuesta.status();
      assert.equal(estado, 200, "Edición UI operador: " + JSON.stringify(body.errores));
      assert.equal(body.publicacionId, registro.id);
      sesion.diagnostico?.anotar("guardado_respondido", { publicacionId: registro.id, precio, http: estado });
    });
  } finally { envio.cerrar(); }
  await verificarPersistenciaOperadorPorApi(sesion, registro, precio);
  registro.precio = precio;
  await paso(sesion, "precio_operador_guardado_visible", async () => {
    const guardada = page.getByRole("dialog", { name: "Consulta de publicación", exact: true });
    await expect(guardada).toBeVisible({ timeout });
    await expect(guardada.getByRole("textbox", { name: "Precio en pesos", exact: true })).toHaveValue(String(precio), { timeout });
  }, { publicacionId: registro.id, precio });
  return { publicacionId: registro.id, precio, http: estado };
}

export async function verificarPersistenciaOperadorPorApi(sesion, registro, precio = registro.precio) {
  return paso(sesion, "persistencia_operador_api", async () => {
    assert.ok(Number.isSafeInteger(registro.operadorId) && registro.operadorId > 0);
    assert.equal(registro.usuario, sesion.usuario);
    if (sesion.operadorValidadoId !== registro.operadorId) {
      const respuesta = await sesion.context.request.get("/api/publicaciones", { timeout: sesion.timeout });
      assert.equal(respuesta.status(), 200, "Catálogo autenticado para comprobar el propietario");
      const { operadores } = await respuesta.json();
      assert.equal(operadores?.length, 1, "La sesión debe identificar a un único operador propio");
      assert.equal(operadores[0].id, registro.operadorId);
      assert.equal(operadores[0].nombre, registro.propietario);
      sesion.operadorValidadoId = registro.operadorId;
    }
    const respuesta = await sesion.context.request.get("/api/publicaciones/operador/" + registro.operadorId, { timeout: sesion.timeout });
    assert.equal(respuesta.status(), 200, "Lectura independiente del precio persistido");
    const { publicaciones } = await respuesta.json();
    assert.ok(Array.isArray(publicaciones));
    const coincidencias = publicaciones.filter(p => p.id === registro.id);
    assert.equal(coincidencias.length, 1, "La publicación guardada debe existir una sola vez");
    assert.equal(coincidencias[0].especie, registro.especie);
    assert.equal(Number(coincidencias[0].precio), precio, "Precio realmente persistido");
    registro.ultimoGuardadoConfirmado = { precio, instante: Date.now() };
    const verificacion = { publicacionId: registro.id, operadorId: registro.operadorId, especie: registro.especie, precio, http: respuesta.status(), verificadoPor: "api" };
    sesion.diagnostico?.anotar("persistencia_confirmada", verificacion);
    return verificacion;
  }, { publicacionId: registro.id, operadorId: registro.operadorId, precioEsperado: precio });
}

export async function verificarPropiaOperadorDesdePantalla(sesion, registro) {
  const consulta = await abrirPropia(sesion, registro);
  return paso(sesion, "verificar_precio_propio_operador", async () => {
    const campo = consulta.getByRole("textbox", { name: "Precio en pesos", exact: true });
    await expect(campo).toHaveValue(String(registro.precio), { timeout: sesion.timeout });
    return { publicacionId: registro.id, precio: Number(await campo.inputValue()) };
  }, { publicacionId: registro.id, precioEsperado: registro.precio });
}
