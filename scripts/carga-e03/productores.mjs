import assert from "node:assert/strict";
import { crearObservadorMercado } from "./compradores.mjs";
import { iniciarSesion } from "./operadores.mjs";

const rutaPropia = "/mi-mercado/productor";
const rutaAlta = "/api/publicaciones/productor";
const rutaIndividual = /^\/api\/publicaciones\/productor\/(\d+)$/;

function validarPrecio(precio) {
  assert.ok(Number.isSafeInteger(precio) && precio > 0 && precio <= 9_999_999_999, "Precio de prueba inválido");
}

function esRespuesta(respuesta, metodo, ruta) {
  return respuesta.request().method() === metodo && new URL(respuesta.url()).pathname === ruta;
}

async function irAMercadoPropio(sesion, { recargar = false } = {}) {
  const { page } = sesion;
  if (recargar || new URL(page.url()).pathname !== rutaPropia) {
    const respuesta = await page.goto(rutaPropia, { waitUntil: "domcontentloaded" });
    if (respuesta) assert.equal(respuesta.status(), 200, "Mi Mercado del productor");
  }
  await page.getByRole("button", { name: "Nueva publicación", exact: true }).waitFor({ state: "visible" });
}

async function abrirPublicacionPropia(sesion, registro, { recargar = false } = {}) {
  await irAMercadoPropio(sesion, { recargar });
  const { page } = sesion;
  await page.getByRole("searchbox", { name: "Buscar publicaciones", exact: true }).fill(registro.especie);
  const tarjeta = page.getByRole("button", { name: "Ver detalle de " + registro.especie, exact: true });
  await tarjeta.getByText("$" + registro.precio, { exact: true }).waitFor({ state: "visible" });
  assert.equal(await tarjeta.count(), 1, "La oferta propia debe identificarse sin ambigüedad");
  await tarjeta.click();
  const drawer = page.getByRole("dialog", { name: "Consulta de publicación", exact: true });
  await drawer.waitFor({ state: "visible" });
  const precio = drawer.getByRole("textbox", { name: "Precio en pesos", exact: true });
  assert.equal(await precio.getAttribute("id"), "publicacion-productor-" + registro.id + "-precio");
  assert.equal(Number(await precio.inputValue()), registro.precio, "Precio propio guardado");
  assert.equal(await drawer.getByRole("textbox", { name: "Comentario", exact: true }).inputValue(), registro.etiqueta);
  return drawer;
}

async function comenzarEdicion(sesion, registro, consulta) {
  const [respuesta] = await Promise.all([
    sesion.page.waitForResponse(resultado => resultado.request().method() === "GET"
      && rutaIndividual.test(new URL(resultado.url()).pathname)),
    consulta.getByRole("button", { name: "Editar", exact: true }).click(),
  ]);
  assert.equal(respuesta.status(), 200, "Opciones de edición del productor");
  const relacionId = Number(rutaIndividual.exec(new URL(respuesta.url()).pathname)[1]);
  assert.ok(Number.isSafeInteger(relacionId) && relacionId > 0);
  if (registro.relacionId != null) assert.equal(relacionId, registro.relacionId, "Relación de la publicación editada");
  registro.relacionId = relacionId;
  const drawer = sesion.page.getByRole("dialog", { name: "Editar publicación", exact: true });
  await drawer.waitFor({ state: "visible" });
  assert.equal(await drawer.getByRole("textbox", { name: "Precio en pesos", exact: true }).getAttribute("id"),
    "publicacion-productor-" + registro.id + "-precio");
  return drawer;
}

async function cerrarConsulta(sesion) {
  const drawer = sesion.page.getByRole("dialog", { name: "Consulta de publicación", exact: true });
  await drawer.getByRole("button", { name: "Cerrar consulta", exact: true }).click();
  await drawer.waitFor({ state: "hidden" });
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
  await page.getByRole("button", { name: "Nueva publicación", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "Nueva publicación de Productor", exact: true });
  await drawer.getByRole("combobox", { name: /^Especie(?:\s*\*)?$/ }).click();
  await page.getByRole("option", { name: especieNombre, exact: true }).click();
  await drawer.getByRole("textbox", { name: "Precio en pesos", exact: true }).fill(String(precio));
  await drawer.getByRole("textbox", { name: "Comentario", exact: true }).fill(etiqueta);
  const [respuesta] = await Promise.all([
    page.waitForResponse(resultado => esRespuesta(resultado, "POST", rutaAlta)),
    drawer.getByRole("button", { name: "Confirmar", exact: true }).click(),
  ]);
  const resultado = await respuesta.json();
  assert.equal(respuesta.status(), 201, "Alta del productor " + sesion.usuario + ": " + JSON.stringify(resultado));
  assert.equal(resultado.esValido, true);
  assert.ok(Number.isSafeInteger(resultado.id) && resultado.id > 0);
  const datosEnviados = respuesta.request().postDataJSON();
  const registro = {
    id: resultado.id, relacionId: null, productorId: datosEnviados.productorId,
    especieId: datosEnviados.especieId, especie: especieNombre, propietario: sesion.nombre,
    nombre: sesion.nombre, precio, usuario: sesion.usuario, rol: "PRODUCTOR", etiqueta, http: respuesta.status(),
  };
  creadas.push(registro);
  assert.ok(Number.isSafeInteger(registro.productorId) && registro.productorId > 0);
  assert.ok(Number.isSafeInteger(registro.especieId) && registro.especieId > 0);
  sesion.productorId = registro.productorId;
  await drawer.waitFor({ state: "hidden" });
  const consulta = await abrirPublicacionPropia(sesion, registro);
  const edicion = await comenzarEdicion(sesion, registro, consulta);
  await edicion.getByRole("button", { name: "Cancelar", exact: true }).click();
  await cerrarConsulta(sesion);
  return registro;
}

export async function cambiarPrecioProductorDesdePantalla(sesion, registro, precio) {
  validarPrecio(precio);
  const consulta = await abrirPublicacionPropia(sesion, registro);
  const drawer = await comenzarEdicion(sesion, registro, consulta);
  await drawer.getByRole("textbox", { name: "Precio en pesos", exact: true }).fill(String(precio));
  const [respuesta] = await Promise.all([
    sesion.page.waitForResponse(resultado => esRespuesta(resultado, "PATCH", rutaAlta + "/" + registro.relacionId)),
    drawer.getByRole("button", { name: "Confirmar", exact: true }).click(),
  ]);
  const resultado = await respuesta.json();
  assert.equal(respuesta.status(), 200, "Edición de precio del productor: " + JSON.stringify(resultado));
  assert.equal(resultado.publicacion?.id, registro.id);
  assert.equal(resultado.publicacion?.publicacionProductorId, registro.relacionId);
  assert.equal(Number(resultado.publicacion?.precio), precio);
  registro.precio = precio;
  const guardada = sesion.page.getByRole("dialog", { name: "Consulta de publicación", exact: true });
  await guardada.waitFor({ state: "visible" });
  assert.equal(Number(await guardada.getByRole("textbox", { name: "Precio en pesos", exact: true }).inputValue()), precio);
  await cerrarConsulta(sesion);
  await sesion.page.getByRole("button", { name: "Ver detalle de " + registro.especie, exact: true })
    .getByText("$" + precio, { exact: true }).waitFor({ state: "visible" });
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
  return nueva
    ? sesionOperador.observadorProductor.verificarAlta(oferta, precioEsperado)
    : sesionOperador.observadorProductor.verificar(oferta, precioEsperado);
}

export async function resolverRelacionProductorParaLimpieza(api, registro) {
  assert.equal(registro.rol, "PRODUCTOR", "La limpieza requiere un registro de productor");
  assert.match(registro.usuario, /^carga_e03_productor_(?:0[1-9]|10)$/, "Cuenta de prueba para la limpieza");
  assert.ok(Number.isSafeInteger(registro.id) && registro.id > 0);
  assert.ok(Number.isSafeInteger(registro.productorId) && registro.productorId > 0);
  assert.match(registro.etiqueta, /^E03-[0-9a-f-]{36} (inicial|alta) PRODUCTOR-/, "Marca de la corrida para la limpieza");
  const propietario = "Prueba Concurrencia E03 Productor " + registro.usuario.slice(-2);
  assert.equal(registro.propietario, propietario, "Propietario de la publicación de prueba");

  const respuesta = await api.get(rutaPropia, { maxRedirects: 0 });
  assert.equal(respuesta.status(), 200, "Consulta autenticada para identificar la relación del productor");
  assert.equal(new URL(respuesta.url()).pathname, rutaPropia);
  assert.match(respuesta.headers()["content-type"] ?? "", /^text\/html\b/i);
  const html = await respuesta.text();
  const patronFragmento = /self\.__next_f\.push\(\s*(\[\s*1\s*,\s*"(?:\\.|[^"\\])*"\s*\])\s*\)/g;
  const fragmentos = [...html.matchAll(patronFragmento)].map(coincidencia => JSON.parse(coincidencia[1])[1]);
  assert.ok(fragmentos.length > 0, "Mi Mercado no contiene datos RSC reconocibles para la limpieza");

  const filas = new Map();
  for (const linea of fragmentos.join("").split("\n")) {
    const fila = /^([0-9a-f]+):(.*)$/i.exec(linea);
    if (!fila || !/^[\[{"\d-]|^(?:true|false|null)$/.test(fila[2])) continue;
    try {
      filas.set(fila[1], JSON.parse(fila[2]));
    } catch {
      // Los registros de módulos y texto del protocolo no son modelos JSON.
    }
  }

  function resolver(valor) {
    const referencias = new Set();
    while (typeof valor === "string" && /^\$[0-9a-f]+$/i.test(valor)) {
      const id = valor.slice(1);
      assert.ok(!referencias.has(id), "Referencia circular en los datos de limpieza");
      referencias.add(id);
      if (!filas.has(id)) return undefined;
      valor = filas.get(id);
    }
    return valor;
  }

  const visitados = new Set();
  const coincidencias = [];
  function buscar(valor) {
    const objeto = resolver(valor);
    if (!objeto || typeof objeto !== "object" || visitados.has(objeto)) return;
    visitados.add(objeto);
    if (!Array.isArray(objeto) && objeto.productorId === registro.productorId && objeto.nombreProductor === propietario) {
      const publicaciones = resolver(objeto.publicaciones);
      if (Array.isArray(publicaciones)) {
        for (const valorPublicacion of publicaciones) {
          const publicacion = resolver(valorPublicacion);
          if (publicacion?.id === registro.id) coincidencias.push(publicacion);
        }
      }
    }
    for (const hijo of Object.values(objeto)) buscar(hijo);
  }
  for (const fila of filas.values()) buscar(fila);

  assert.equal(coincidencias.length, 1, "No se identificó una única publicación propia para limpiar; no se eliminará");
  const publicacion = coincidencias[0];
  assert.equal(resolver(publicacion.comentario), registro.etiqueta, "La publicación no pertenece a esta corrida; no se eliminará");
  const especie = resolver(publicacion.especie);
  assert.equal(especie?.id, registro.especieId, "Especie de la publicación que se limpiará");
  assert.equal(especie?.nombreEspecie, registro.especie, "Nombre de la especie que se limpiará");
  const relacionId = publicacion.publicacionProductorId;
  assert.ok(Number.isSafeInteger(relacionId) && relacionId > 0, "Relación válida para la limpieza");
  if (registro.relacionId != null) assert.equal(relacionId, registro.relacionId, "La relación recuperada debe coincidir con la conocida");
  registro.relacionId = relacionId;
  return relacionId;
}
