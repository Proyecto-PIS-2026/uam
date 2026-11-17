import assert from "node:assert/strict";
import { expect } from "@playwright/test";
import { crearObservadorMercado } from "./compradores.mjs";
import { iniciarSesion } from "./operadores.mjs";
import { paso } from "./diagnostico.mjs";
import { extraerObjetosRsc } from "./datos-servidor.mjs";

const rutaPropia = "/mi-mercado/productor";
const rutaAlta = "/api/publicaciones/productor";
const rutaIndividual = /^\/api\/publicaciones\/productor\/(\d+)$/;

function validarPrecio(precio) {
  assert.ok(Number.isSafeInteger(precio) && precio > 0 && precio <= 9_999_999_999, "Precio de prueba inválido");
}

async function datosEnviados(solicitud) {
  const tipo = solicitud.headers()["content-type"] ?? "";
  if (tipo.includes("application/json")) return solicitud.postDataJSON();
  assert.ok(tipo.includes("multipart/form-data"), "El guardado debe enviar JSON o formulario multipart");
  const formulario = await new Response(solicitud.postDataBuffer(), { headers: { "content-type": tipo } }).formData();
  const cambios = formulario.get("cambios");
  assert.equal(typeof cambios, "string", "El formulario debe contener los cambios");
  return JSON.parse(cambios);
}

async function intercambioDesdePantalla(sesion, metodo, coincideRuta, boton, precioEsperado) {
  const { page } = sesion;
  let solicitud;
  let resolverSolicitud, resolverRespuesta;
  const esperas = [new Promise(resolve => { resolverSolicitud = resolve; }), new Promise(resolve => { resolverRespuesta = resolve; })];
  const temporizador = setTimeout(() => {
    resolverSolicitud({ error: new Error("No se emitió la solicitud " + metodo + " esperada") });
    resolverRespuesta({ error: new Error("No llegó la respuesta " + metodo + " esperada") });
  }, sesion.timeout ?? 45_000);
  const alSolicitar = candidata => {
    if (solicitud || candidata.method() !== metodo || !coincideRuta(new URL(candidata.url()).pathname)) return;
    solicitud = candidata;
    resolverSolicitud({ valor: candidata });
  };
  const alResponder = respuesta => {
    if (respuesta.request() === solicitud) resolverRespuesta({ valor: respuesta });
  };
  page.on("request", alSolicitar);
  page.on("response", alResponder);
  try {
    await paso(sesion, "productor.boton_" + (metodo === "GET" ? "editar" : "confirmar"), async () => {
      await expect(boton).toBeEnabled({ timeout: sesion.timeout });
      await boton.click();
    }, { metodo });
    await paso(sesion, "productor.peticion_emitida", async () => {
      const resultado = await esperas[0];
      if (resultado.error) throw resultado.error;
      let enviados;
      if (precioEsperado !== undefined) {
        enviados = await datosEnviados(resultado.valor);
        assert.equal(Number(enviados.precio), precioEsperado, "El precio enviado debe coincidir con el ingresado");
      }
      sesion.diagnostico?.anotar("productor.peticion", {
        metodo, ruta: new URL(resultado.valor.url()).pathname,
        precioEnviado: enviados?.precio, precioEsperado,
      });
    }, { metodo, precioEsperado });
    return await paso(sesion, "productor.respuesta_recibida", async () => {
      const resultado = await esperas[1];
      if (resultado.error) throw resultado.error;
      sesion.diagnostico?.anotar("productor.respuesta", {
        metodo, ruta: new URL(resultado.valor.url()).pathname, estado: resultado.valor.status(),
      });
      return resultado.valor;
    }, { metodo });
  } finally {
    clearTimeout(temporizador);
    page.off("request", alSolicitar);
    page.off("response", alResponder);
  }
}

async function irAMercadoPropio(sesion, { recargar = false } = {}) {
  await paso(sesion, "productor.navegar_mi_mercado", async () => {
    const { page } = sesion;
    if (recargar || new URL(page.url()).pathname !== rutaPropia) {
      const respuesta = await page.goto(rutaPropia, { waitUntil: "domcontentloaded" });
      if (respuesta) assert.equal(respuesta.status(), 200, "Mi Mercado del productor");
    }
    await page.getByRole("button", { name: "Nueva publicación", exact: true }).waitFor({ state: "visible" });
  });
}

async function abrirPublicacionPropia(sesion, registro, { recargar = false } = {}) {
  await irAMercadoPropio(sesion, { recargar });
  return paso(sesion, "productor.abrir_consulta", async () => {
    const { page } = sesion;
    await page.getByRole("searchbox", { name: "Buscar publicaciones", exact: true }).fill(registro.especie);
    const tarjeta = page.getByRole("button", { name: "Ver detalle de " + registro.especie, exact: true });
    await tarjeta.getByText("$" + registro.precio, { exact: true }).waitFor({ state: "visible" });
    assert.equal(await tarjeta.count(), 1, "La oferta propia debe identificarse sin ambigüedad");
    await tarjeta.click();
    const drawer = page.getByRole("dialog", { name: "Consulta de publicación", exact: true });
    await drawer.waitFor({ state: "visible" });
    const precio = drawer.getByRole("textbox", { name: "Precio en pesos", exact: true });
    await expect(precio).toHaveAttribute("id", "publicacion-productor-" + registro.id + "-precio", { timeout: sesion.timeout });
    await expect(precio).toHaveValue(String(registro.precio), { timeout: sesion.timeout });
    await expect(drawer.getByRole("textbox", { name: "Comentario", exact: true })).toHaveValue(registro.etiqueta, { timeout: sesion.timeout });
    return drawer;
  }, { publicacionId: registro.id, relacionId: registro.relacionId, precio: registro.precio });
}

async function comenzarEdicion(sesion, registro, consulta) {
  const respuesta = await intercambioDesdePantalla(sesion, "GET", ruta => rutaIndividual.test(ruta),
    consulta.getByRole("button", { name: "Editar", exact: true }));
  return paso(sesion, "productor.edicion_abierta", async () => {
    assert.equal(respuesta.status(), 200, "Opciones de edición del productor");
    const relacionId = Number(rutaIndividual.exec(new URL(respuesta.url()).pathname)[1]);
    assert.ok(Number.isSafeInteger(relacionId) && relacionId > 0);
    if (registro.relacionId != null) assert.equal(relacionId, registro.relacionId, "Relación de la publicación editada");
    registro.relacionId = relacionId;
    const drawer = sesion.page.getByRole("dialog", { name: "Editar publicación", exact: true });
    await drawer.waitFor({ state: "visible" });
    await expect(drawer.getByRole("textbox", { name: "Precio en pesos", exact: true })).toHaveAttribute(
      "id", "publicacion-productor-" + registro.id + "-precio", { timeout: sesion.timeout });
    return drawer;
  }, { publicacionId: registro.id });
}

async function escribirPrecio(sesion, drawer, precio) {
  const campo = drawer.getByRole("textbox", { name: "Precio en pesos", exact: true });
  await paso(sesion, "productor.precio_editable", () => expect(campo).toBeEditable({ timeout: sesion.timeout }), { precio });
  await paso(sesion, "productor.completar_precio", async () => {
    await campo.fill(String(precio));
    await expect(campo).toHaveValue(String(precio), { timeout: sesion.timeout });
  }, { precio });
}

async function cerrarConsulta(sesion) {
  await paso(sesion, "productor.cerrar_consulta", async () => {
    const drawer = sesion.page.getByRole("dialog", { name: "Consulta de publicación", exact: true });
    await drawer.getByRole("button", { name: "Cerrar consulta", exact: true }).click();
    await drawer.waitFor({ state: "hidden" });
  });
}

export async function crearSesionProductor(browser, baseURL, usuario, password, timeout) {
  assert.match(usuario, /^carga_e03_productor_(?:0[1-9]|10)$/, "Cuenta de productor de prueba");
  const sesion = await iniciarSesion(browser, baseURL, usuario, password, timeout);
  try {
    await sesion.page.waitForURL(url => url.pathname === rutaPropia, { waitUntil: "domcontentloaded" });
    await irAMercadoPropio(sesion);
    return { ...sesion, baseURL, timeout, rol: "PRODUCTOR", nombre: "Prueba Concurrencia E03 Productor " + usuario.slice(-2) };
  } catch (error) {
    await sesion.context.close();
    throw error;
  }
}

export async function crearPublicacionProductorDesdePantalla(sesion, especieNombre, precio, etiqueta, creadas) {
  validarPrecio(precio);
  assert.ok(typeof especieNombre === "string" && especieNombre.trim());
  assert.ok(typeof etiqueta === "string" && etiqueta.trim() && etiqueta.length <= 500);
  await irAMercadoPropio(sesion);
  const { page } = sesion;
  const drawer = page.getByRole("dialog", { name: "Nueva publicación de Productor", exact: true });
  await paso(sesion, "productor.preparar_alta", async () => {
    await page.getByRole("button", { name: "Nueva publicación", exact: true }).click();
    await drawer.waitFor({ state: "visible" });
    await drawer.getByRole("combobox", { name: /^Especie(?:\s*\*)?$/ }).click();
    await page.getByRole("option", { name: especieNombre, exact: true }).click();
    await drawer.getByRole("textbox", { name: "Comentario", exact: true }).fill(etiqueta);
  }, { especie: especieNombre });
  await escribirPrecio(sesion, drawer, precio);
  const respuesta = await intercambioDesdePantalla(sesion, "POST", ruta => ruta === rutaAlta,
    drawer.getByRole("button", { name: "Confirmar", exact: true }));
  const registro = await paso(sesion, "productor.alta_confirmada", async () => {
    const resultado = await respuesta.json();
    assert.equal(respuesta.status(), 201, "Alta del productor " + sesion.usuario + ": " + JSON.stringify(resultado));
    assert.equal(resultado.esValido, true);
    assert.ok(Number.isSafeInteger(resultado.id) && resultado.id > 0);
    const datos = respuesta.request().postDataJSON();
    const creada = {
      id: resultado.id, relacionId: null, productorId: datos.productorId,
      especieId: datos.especieId, especie: especieNombre, propietario: sesion.nombre,
      nombre: sesion.nombre, precio, usuario: sesion.usuario, rol: "PRODUCTOR", etiqueta, http: respuesta.status(),
    };
    creadas.push(creada);
    assert.equal(Number(datos.precio), precio, "El precio enviado en el alta debe coincidir con el ingresado");
    sesion.diagnostico?.anotar("productor.precio_enviado_alta", { publicacionId: creada.id, precioEnviado: datos.precio, precioEsperado: precio });
    assert.ok(Number.isSafeInteger(creada.productorId) && creada.productorId > 0);
    assert.ok(Number.isSafeInteger(creada.especieId) && creada.especieId > 0);
    sesion.productorId = creada.productorId;
    return creada;
  });
  await verificarPersistenciaProductorPorApi(sesion, registro, precio);
  registro.ultimoGuardadoConfirmado = { precio, instante: Date.now() };
  await paso(sesion, "productor.alta_cerrada", () => drawer.waitFor({ state: "hidden" }));
  const consulta = await abrirPublicacionPropia(sesion, registro);
  const edicion = await comenzarEdicion(sesion, registro, consulta);
  await paso(sesion, "productor.cancelar_consulta_edicion", () => edicion.getByRole("button", { name: "Cancelar", exact: true }).click());
  await cerrarConsulta(sesion);
  return registro;
}

export async function cambiarPrecioProductorDesdePantalla(sesion, registro, precio) {
  validarPrecio(precio);
  const consulta = await abrirPublicacionPropia(sesion, registro);
  const drawer = await comenzarEdicion(sesion, registro, consulta);
  await escribirPrecio(sesion, drawer, precio);
  const respuesta = await intercambioDesdePantalla(sesion, "PATCH", ruta => ruta === rutaAlta + "/" + registro.relacionId,
    drawer.getByRole("button", { name: "Confirmar", exact: true }), precio);
  await paso(sesion, "productor.guardado_confirmado", async () => {
    const resultado = await respuesta.json();
    assert.equal(respuesta.status(), 200, "Edición de precio del productor: " + JSON.stringify(resultado));
    assert.equal(resultado.publicacion?.id, registro.id);
    assert.equal(resultado.publicacion?.publicacionProductorId, registro.relacionId);
    assert.equal(Number(resultado.publicacion?.precio), precio);
  }, { publicacionId: registro.id, precio });
  await verificarPersistenciaProductorPorApi(sesion, registro, precio);
  registro.ultimoGuardadoConfirmado = { precio, instante: Date.now() };
  registro.precio = precio;
  await paso(sesion, "productor.precio_actualizado_en_pantalla", async () => {
    const guardada = sesion.page.getByRole("dialog", { name: "Consulta de publicación", exact: true });
    await guardada.waitFor({ state: "visible" });
    await expect(guardada.getByRole("textbox", { name: "Precio en pesos", exact: true })).toHaveValue(String(precio), { timeout: sesion.timeout });
  }, { publicacionId: registro.id, precio });
  await cerrarConsulta(sesion);
  await paso(sesion, "productor.tarjeta_actualizada", () => sesion.page.getByRole("button", { name: "Ver detalle de " + registro.especie, exact: true })
    .getByText("$" + precio, { exact: true }).waitFor({ state: "visible" }), { publicacionId: registro.id, precio });
  return { id: registro.id, relacionId: registro.relacionId, precio, http: respuesta.status(), rol: "PRODUCTOR" };
}

export async function verificarPropiaProductorDesdePantalla(sesion, registro) {
  await abrirPublicacionPropia(sesion, registro, { recargar: true });
  await cerrarConsulta(sesion);
  return { id: registro.id, relacionId: registro.relacionId, precio: registro.precio, rol: "PRODUCTOR" };
}

export async function prepararObservacionProductor(sesionOperador, propietario, registro = null) {
  assert.ok(typeof propietario === "string" && propietario.trim());
  await sesionOperador.observadorProductor?.cerrar();
  const observador = crearObservadorMercado({
    page: sesionOperador.page, context: sesionOperador.context,
    baseURL: sesionOperador.baseURL ?? new URL(sesionOperador.page.url()).origin,
    timeout: sesionOperador.timeout ?? 45_000, tipo: "PRODUCTOR",
  });
  sesionOperador.observadorProductor = observador;
  if (registro) return observador.preparar({ ...registro, nombre: propietario });
  return observador.prepararAlta(propietario);
}

export async function verificarProductorDesdeOperador(sesionOperador, registro, precioEsperado, { nueva = false } = {}) {
  validarPrecio(precioEsperado);
  assert.ok(sesionOperador.observadorProductor, "Prepará la observación del productor antes de iniciar la fase");
  const oferta = { ...registro, nombre: registro.propietario ?? registro.nombre };
  return paso(sesionOperador, "operador.observar_productor", () => nueva
    ? sesionOperador.observadorProductor.verificarAlta(oferta, precioEsperado)
    : sesionOperador.observadorProductor.verificar(oferta, precioEsperado), { publicacionId: registro.id, precioEsperado });
}

async function leerRegistroProductor(api, registro) {
  assert.equal(registro.rol, "PRODUCTOR", "La consulta requiere un registro de productor");
  assert.match(registro.usuario, /^carga_e03_productor_(?:0[1-9]|10)$/, "Cuenta de productor de prueba");
  assert.ok(Number.isSafeInteger(registro.id) && registro.id > 0);
  assert.ok(Number.isSafeInteger(registro.productorId) && registro.productorId > 0);
  assert.match(registro.etiqueta, /^E03-[0-9a-f-]{36} (inicial|alta) PRODUCTOR-/, "Marca de la corrida");
  const propietario = "Prueba Concurrencia E03 Productor " + registro.usuario.slice(-2);
  assert.equal(registro.propietario, propietario, "Propietario de la publicación de prueba");
  const respuesta = await api.get(rutaPropia, { maxRedirects: 0 });
  assert.equal(respuesta.status(), 200, "Consulta autenticada de la publicación del productor");
  assert.equal(new URL(respuesta.url()).pathname, rutaPropia);
  assert.match(respuesta.headers()["content-type"] ?? "", /^text\/html\b/i);
  const props = extraerObjetosRsc(await respuesta.text()).filter(objeto => objeto.productorId === registro.productorId
    && objeto.nombreProductor === propietario && Array.isArray(objeto.publicaciones));
  assert.equal(props.length, 1, "No se identificó un único mercado propio del productor");
  const coincidencias = props[0].publicaciones.filter(publicacion => publicacion?.id === registro.id);
  assert.equal(coincidencias.length, 1, "No se identificó una única publicación propia; no se modificará ni eliminará");
  const publicacion = coincidencias[0];
  assert.equal(publicacion.comentario, registro.etiqueta, "La publicación no pertenece a esta corrida");
  assert.equal(publicacion.especie?.id, registro.especieId, "Especie de la publicación de prueba");
  assert.equal(publicacion.especie?.nombreEspecie, registro.especie, "Nombre de la especie de prueba");
  const relacionId = publicacion.publicacionProductorId;
  assert.ok(Number.isSafeInteger(relacionId) && relacionId > 0, "Relación válida del productor");
  if (registro.relacionId != null) assert.equal(relacionId, registro.relacionId, "La relación recuperada debe coincidir con la conocida");
  registro.relacionId = relacionId;
  return publicacion;
}

export async function leerPublicacionProductorPorApi(sesion, registro) {
  const publicacion = await leerRegistroProductor(sesion.context.request, registro);
  return {
    id: publicacion.id, relacionId: publicacion.publicacionProductorId,
    precio: publicacion.precio === null ? null : Number(publicacion.precio), version: null, fecha: publicacion.fecha,
    cambios: {
      especieId: publicacion.especie.id, variedadId: publicacion.variedad?.id ?? null,
      envaseId: publicacion.envase?.id ?? null, kilosId: publicacion.kilos?.id ?? null,
      categoriaId: publicacion.categoria?.id ?? null, calibreId: publicacion.calibre?.id ?? null,
      paisId: publicacion.paisId ?? null, precio: publicacion.precio, foto: publicacion.foto,
      cantidadUnidades: publicacion.cantidadUnidades, comentario: publicacion.comentario,
      disponible: publicacion.publicacionDisponible, fechaVigencia: publicacion.fechaVigencia,
      ubicaciones: publicacion.ubicaciones,
    },
  };
}

export async function verificarPersistenciaProductorPorApi(sesion, registro, precio = registro.precio) {
  return paso(sesion, "productor.persistencia_confirmada", async () => {
    const leida = await leerPublicacionProductorPorApi(sesion, registro);
    assert.equal(leida.precio, precio, "El precio debe estar persistido en la lectura independiente del productor");
    return { publicacionId: leida.id, relacionId: leida.relacionId, precio: leida.precio, http: 200 };
  }, { publicacionId: registro.id, precio });
}

export async function resolverRelacionProductorParaLimpieza(api, registro) {
  const publicacion = await leerRegistroProductor(api, registro);
  return publicacion.publicacionProductorId;
}
