import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { freemem } from "node:os";
import { dirname, join } from "node:path";
import { chromium, request } from "@playwright/test";
import { crearComprador } from "./carga-e03/compradores.mjs";
import { iniciarSesion, obtenerEspeciesLibres, crearPublicacionOperadorDesdePantalla,
  cambiarPrecioOperadorDesdePantalla, verificarPropiaOperadorDesdePantalla } from "./carga-e03/operadores.mjs";
import { crearSesionProductor, crearPublicacionProductorDesdePantalla, cambiarPrecioProductorDesdePantalla,
  verificarPropiaProductorDesdePantalla, prepararObservacionProductor, verificarProductorDesdeOperador,
  resolverRelacionProductorParaLimpieza, leerPublicacionProductorPorApi } from "./carga-e03/productores.mjs";

import { iniciarDiagnostico, paso, describirError } from "./carga-e03/diagnostico.mjs";
import { crearPendiente, esperarDependencia, publicarResultado, DependenciaFallida } from "./carga-e03/dependencias.mjs";
import { cambiarPrecioOperadorPorApi, cambiarPrecioProductorPorApi, leerPublicacionOperadorPorApi } from "./carga-e03/api.mjs";
import { reproducirEdicionDuranteSincronizacion } from "./carga-e03/reproducir-edicion.mjs";

const BASE_URL = (process.env.E03_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const PASSWORD = process.env.E03_TEST_PASSWORD;
const MODO = process.env.E03_MODO ?? "completo";
assert.ok(["completo", "verificacion", "diagnostico"].includes(MODO), "E03_MODO debe ser completo, verificacion o diagnostico");
assert.ok(PASSWORD, "Defini E03_TEST_PASSWORD para las 15 cuentas carga_e03_XX y las 5 carga_e03_productor_XX");
const CANTIDADES = MODO === "completo"
  ? { PUBLICO: 50, OPERADOR: 15, PRODUCTOR: 5 }
  : { PUBLICO: 3, OPERADOR: 2, PRODUCTOR: 1 };
const TIMEOUT = 90_000;
const MIN_RAM_MB = Number(process.env.E03_MIN_RAM_MB ?? 5120);
assert.ok(Number.isFinite(MIN_RAM_MB) && MIN_RAM_MB > 0, "E03_MIN_RAM_MB debe ser positivo");
const REPORT_PATH = process.env.E03_REPORT_PATH ?? "test-results/e03-concurrencia.json";
const runId = "E03-" + randomUUID();
const ARTIFACTOS = join(dirname(REPORT_PATH), "e03-artifactos", runId);
const operadores = [], productores = [], publico = [], creadas = [];
const reporte = {
  prueba: "BP-E03", modo: MODO, destino: BASE_URL, inicio: new Date().toISOString(), runId,
  cantidades: CANTIDADES, canal: "Una pagina y contexto aislado por persona; acciones por interfaz web",
  fases: [], fasesApi: [], operaciones: [], persistencia: [], limpieza: [], errores: [], bloqueos: [], diagnosticos: [],
  objetivoCompletoVerificado: false,
};
let browser, monitor, interrupcion;
const fallo = describirError;
const sesionId = (rol, i) => rol + "-" + String(i + 1).padStart(3, "0");

function registrarErroresHTTP(sesion) {
  sesion.page.on("response", respuesta => {
    const url = new URL(respuesta.url());
    const metodo = respuesta.request().method();
    if (url.origin === new URL(BASE_URL).origin && respuesta.status() >= 400
      && (url.pathname.startsWith("/api/") || metodo === "POST")) {
      reporte.errores.push({ fase: "http", sesion: sesion.id, instante: Date.now(),
        metodo, ruta: url.pathname, estado: respuesta.status() });
    }
  });
}

async function enGrupos(items, accion, limite = 2) {
  for (let inicio = 0; inicio < items.length; inicio += limite) {
    comprobarRecursos();
    const resultados = await Promise.allSettled(items.slice(inicio, inicio + limite).map(accion));
    const errores = resultados.filter(r => r.status === "rejected");
    if (errores.length) throw new Error(errores.map(r => fallo(r.reason)).join("\n"));
  }
}

function detener(motivo) {
  if (interrupcion) return;
  interrupcion = motivo;
  console.error(motivo);
  // Solo se cierra el navegador creado por esta prueba.
  void browser?.close().catch(() => {});
}
function comprobarRecursos() {
  if (!interrupcion && freemem() / 1024 ** 2 < MIN_RAM_MB) detener("Interrumpido por memoria disponible inferior a " + MIN_RAM_MB + " MB");
  if (interrupcion) throw new Error(interrupcion);
}
const interrumpir = () => detener("Ejecucion interrumpida por el usuario");

async function faseConcurrente(nombre, acciones, canal = "UI") {
  assert.equal(acciones.length, Object.values(CANTIDADES).reduce((a, b) => a + b, 0));
  assert.equal(new Set(acciones.map(a => a.sesion.context)).size, acciones.length, "Las sesiones deben estar aisladas");
  assert.equal(new Set(acciones.map(a => a.sesion.id)).size, acciones.length);
  await enGrupos(acciones, async ({ sesion }) => {
    assert.equal(await sesion.page.evaluate(() => document.visibilityState), "visible", sesion.id + " no esta visible para recibir tiempo real");
  }, 5);
  comprobarRecursos();
  const fase = { nombre, canal, inicio: Date.now(), sesionesListas: acciones.length, completadas: {}, ok: false };
  (canal === "UI" ? reporte.fases : reporte.fasesApi).push(fase);
  const salida = crearPendiente(nombre);
  const tareas = acciones.map(async ({ sesion, ejecutar }) => {
    await salida.promise;
    const fila = { fase: nombre, canal, sesion: sesion.id, rol: sesion.rol, inicio: Date.now() };
    try {
      fila.resultado = await ejecutar();
      fila.ok = true;
      fila.estado = "completado";
    } catch (error) {
      fila.ok = false;
      fila.estado = error instanceof DependenciaFallida ? "bloqueado" : "fallido";
      fila.etapa = error.etapa;
      fila.dependencia = error.dependencia;
      fila.origen = error.origen;
      fila.error = fallo(error);
    } finally {
      fila.fin = Date.now();
      fila.duracionMs = fila.fin - fila.inicio;
      reporte.operaciones.push(fila);
    }
  });
  console.log(nombre + ": " + acciones.length + " personas listas; inicio conjunto.");
  salida.resolve();
  await Promise.allSettled(tareas);
  const filas = reporte.operaciones.filter(f => f.fase === nombre);
  for (const rol of Object.keys(CANTIDADES)) fase.completadas[rol] = filas.filter(f => f.rol === rol && f.ok).length;
  fase.bloqueados = filas.filter(f => f.estado === "bloqueado").length;
  fase.fallosOriginales = filas.filter(f => f.estado === "fallido").length;
  fase.fin = Date.now();
  fase.ok = !interrupcion && Object.entries(CANTIDADES).every(([rol, cantidad]) => fase.completadas[rol] === cantidad);
  for (const fila of filas.filter(f => !f.ok)) {
    const destino = fila.estado === "bloqueado" ? reporte.bloqueos : reporte.errores;
    destino.push({ fase: nombre, canal, sesion: fila.sesion, etapa: fila.etapa,
      dependencia: fila.dependencia, origen: fila.origen, error: fila.error });
  }
  console.log(nombre, fase.ok ? "OK" : "FALLO", fase.completadas);
  assert.ok(fase.ok, "No completaron el recorrido todas las personas de " + nombre);
}

async function preparar(browser) {
  console.log("Preparando cuentas y especies disponibles desde los formularios.");
  const numeros = n => Array.from({ length: n }, (_, i) => i);
  await enGrupos(numeros(CANTIDADES.PRODUCTOR), async i => {
    const sufijo = String(i + 1).padStart(2, "0");
    const sesion = await crearSesionProductor(browser, BASE_URL, "carga_e03_productor_" + sufijo, PASSWORD, TIMEOUT);
    productores[i] = Object.assign(sesion, { id: sesionId("PRODUCTOR", i), indice: i });
    registrarErroresHTTP(sesion);
    await iniciarDiagnostico(sesion, ARTIFACTOS);
    sesion.libres = await obtenerEspeciesLibres(sesion, "PRODUCTOR");
  });
  await enGrupos(numeros(CANTIDADES.OPERADOR), async i => {
    const sufijo = String(i + 1).padStart(2, "0");
    const sesion = await iniciarSesion(browser, BASE_URL, "carga_e03_" + sufijo, PASSWORD, TIMEOUT);
    operadores[i] = Object.assign(sesion, { id: sesionId("OPERADOR", i), rol: "OPERADOR", indice: i,
      nombre: "Prueba Carga E03 " + sufijo, productor: productores[i % productores.length], margen: i + 10 });
    registrarErroresHTTP(sesion);
    await iniciarDiagnostico(sesion, ARTIFACTOS);
    sesion.libres = await obtenerEspeciesLibres(sesion, "OPERADOR");
  });
  for (const productor of productores) {
    const grupo = operadores.filter(o => o.productor === productor);
    const especies = productor.libres.filter(e => grupo.every(o => o.libres.includes(e))).slice(0, 2);
    assert.equal(especies.length, 2, "Faltan dos especies libres en las cuentas del grupo " + productor.id);
    productor.especies = especies;
  }
  await enGrupos(productores, async productor => {
    console.log("Alta inicial", productor.id, productor.especies[0]);
    productor.oferta = await crearPublicacionProductorDesdePantalla(productor, productor.especies[0], 1000 + productor.indice, runId + " inicial " + productor.id, creadas);
  });
  await enGrupos(operadores, async operador => {
    console.log("Preparando oferta conectada", operador.id);
    const observado = await prepararObservacionProductor(operador, operador.productor.nombre, operador.productor.oferta);
    operador.oferta = await crearPublicacionOperadorDesdePantalla(operador, operador.productor.especies[0], observado.precio + operador.margen, runId + " inicial " + operador.id, creadas);
  });
  await enGrupos(numeros(CANTIDADES.PUBLICO), async i => {
    const comprador = await crearComprador(browser, BASE_URL, TIMEOUT);
    publico[i] = Object.assign(comprador, { id: sesionId("PUBLICO", i), rol: "PUBLICO", operador: operadores[i % operadores.length] });
    registrarErroresHTTP(comprador);
    await comprador.preparar(comprador.operador.oferta);
  });
  console.log("Preparacion completa", CANTIDADES);
}

async function probarPrecios(ronda, canal = "UI") {
  await enGrupos(operadores, o => prepararObservacionProductor(o, o.productor.nombre, o.productor.oferta));
  await enGrupos(publico, p => p.preparar(p.operador.oferta));
  const esperados = new Map(productores.map(p => [p.id, 1000 + ronda * 100 + p.indice]));
  const pendientesProductor = new Map(productores.map(p => [p.id, crearPendiente(p.id)]));
  const pendientesOperador = new Map(operadores.map(o => [o.id, crearPendiente(o.id)]));
  const cambiarProductor = canal === "UI" ? cambiarPrecioProductorDesdePantalla : cambiarPrecioProductorPorApi;
  const cambiarOperador = canal === "UI" ? cambiarPrecioOperadorDesdePantalla : cambiarPrecioOperadorPorApi;
  const confirmado = (registro, precio) => registro.ultimoGuardadoConfirmado?.precio === precio ? { precio, publicacionId: registro.id } : null;
  await faseConcurrente((canal === "UI" ? "precios-" : "api-precios-") + ronda, [
    ...productores.map(p => ({ sesion: p, ejecutar: () => publicarResultado(pendientesProductor.get(p.id),
      () => cambiarProductor(p, p.oferta, esperados.get(p.id)),
      () => confirmado(p.oferta, esperados.get(p.id))) })),
    ...operadores.map(o => ({ sesion: o, ejecutar: () => publicarResultado(pendientesOperador.get(o.id), async () => {
      await esperarDependencia(pendientesProductor.get(o.productor.id));
      const origen = await paso(o, "observar-precio-productor", () => verificarProductorDesdeOperador(o, o.productor.oferta, esperados.get(o.productor.id)),
        { publicacionId: o.productor.oferta.id, precioEsperado: esperados.get(o.productor.id) });
      const destino = await cambiarOperador(o, o.oferta, origen.precio + o.margen);
      return { origen, margen: o.margen, destino };
    }, () => confirmado(o.oferta, esperados.get(o.productor.id) + o.margen)) })),
    ...publico.map(p => ({ sesion: p, ejecutar: async () => {
      await esperarDependencia(pendientesOperador.get(p.operador.id));
      return p.verificar(p.operador.oferta, esperados.get(p.operador.productor.id) + p.operador.margen);
    } })),
  ], canal);
}

async function probarAltas() {
  await enGrupos(operadores, o => prepararObservacionProductor(o, o.productor.nombre));
  await enGrupos(publico, p => p.prepararAlta(p.operador.nombre));
  const altasProductor = new Map(productores.map(p => [p.id, crearPendiente(p.id)]));
  const altasOperador = new Map(operadores.map(o => [o.id, crearPendiente(o.id)]));
  const altaConfirmada = sesion => {
    const registro = creadas.find(r => r.usuario === sesion.usuario && r.etiqueta === runId + " alta " + sesion.id
      && r.ultimoGuardadoConfirmado?.precio === r.precio);
    if (registro) sesion.nueva = registro;
    return registro;
  };
  await faseConcurrente("altas-conectadas", [
    ...productores.map(p => ({ sesion: p, ejecutar: () => publicarResultado(altasProductor.get(p.id), async () => {
      p.nueva = await crearPublicacionProductorDesdePantalla(p, p.especies[1], 2000 + p.indice, runId + " alta " + p.id, creadas);
      return p.nueva;
    }, () => altaConfirmada(p)) })),
    ...operadores.map(o => ({ sesion: o, ejecutar: async () => {
      let origen;
      const destino = await publicarResultado(altasOperador.get(o.id), async () => {
        const nueva = await esperarDependencia(altasProductor.get(o.productor.id));
        origen = await paso(o, "observar-alta-productor", () => verificarProductorDesdeOperador(o, nueva, nueva.precio, { nueva: true }));
        o.nueva = await crearPublicacionOperadorDesdePantalla(o, nueva.especie, origen.precio + o.margen, runId + " alta " + o.id, creadas);
        return o.nueva;
      }, () => altaConfirmada(o));
      return { origen, margen: o.margen, destino };
    } })),
    ...publico.map(p => ({ sesion: p, ejecutar: async () => {
      const nueva = await esperarDependencia(altasOperador.get(p.operador.id));
      return p.verificarAlta(nueva, nueva.precio);
    } })),
  ]);
}

async function limpiar() {
  if (process.env.E03_LIMPIAR === "0") {
    reporte.limpiezaOmitida = true;
    return;
  }
  // Elimina únicamente los registros propios de esta ejecución.
  for (const sesion of [...productores, ...operadores].filter(Boolean)) {
    let api;
    try {
      api = await request.newContext({ baseURL: BASE_URL, storageState: sesion.storageState, timeout: 15_000 });
      for (const registro of creadas.filter(r => r.usuario === sesion.usuario)) {
        try {
          if (registro.rol === "PRODUCTOR") await resolverRelacionProductorParaLimpieza(api, registro);
          const ruta = registro.rol === "PRODUCTOR" ? "/api/publicaciones/productor/" + registro.relacionId
            : "/api/publicaciones/" + registro.id + "?operadorId=" + registro.operadorId;
          const respuesta = await api.delete(ruta);
          assert.ok(respuesta.ok() || respuesta.status() === 404, "Limpieza HTTP " + respuesta.status());
          reporte.limpieza.push({ id: registro.id, ok: true });
        } catch (error) { reporte.limpieza.push({ id: registro.id, ok: false, error: fallo(error) }); }
      }
    } catch (error) { reporte.errores.push({ fase: "limpieza", sesion: sesion.id, error: fallo(error) }); }
    finally { await api?.dispose(); }
  }
  if (reporte.limpieza.some(r => !r.ok)) reporte.errores.push({ fase: "limpieza", error: "Quedaron publicaciones de prueba pendientes de eliminar" });
}

try {
  comprobarRecursos();
  browser = await chromium.launch({ headless: true, channel: process.env.E03_BROWSER_CHANNEL ?? "chrome", args: ["--disable-gpu"] });
  process.on("SIGINT", interrumpir);
  process.on("SIGTERM", interrumpir);
  monitor = setInterval(() => {
    if (freemem() / 1024 ** 2 < MIN_RAM_MB) detener("Interrumpido por memoria disponible inferior a " + MIN_RAM_MB + " MB");
  }, 1000);
  await preparar(browser);
  if (MODO === "diagnostico") {
    try {
      const operador = operadores[0];
      const especie = operador.libres.find(nombre => !operador.productor.especies.includes(nombre));
      assert.ok(especie, "Falta una tercera especie libre para la reproducción controlada");
      const auxiliar = await crearPublicacionOperadorDesdePantalla(operador, especie, 500, runId + " reproduccion " + operador.id, creadas);
      reporte.reproduccion = { ok: true, resultado: await reproducirEdicionDuranteSincronizacion(operador, operador.oferta, auxiliar) };
    } catch (error) {
      reporte.reproduccion = { ok: false, error: fallo(error) };
      reporte.errores.push({ fase: "reproduccion-controlada", etapa: error.etapa, error: fallo(error) });
    }
  }
  try {
    await probarPrecios(1);
    await probarPrecios(2);
    await probarAltas();
    await enGrupos([...productores, ...operadores], async sesion => {
      const verificar = sesion.rol === "PRODUCTOR" ? verificarPropiaProductorDesdePantalla : verificarPropiaOperadorDesdePantalla;
      for (const registro of [sesion.oferta, sesion.nueva]) reporte.persistencia.push({ sesion: sesion.id, ...await verificar(sesion, registro) });
    });
  } catch (error) {
    reporte.errores.push({ fase: "recorrido-ui", error: fallo(error) });
    console.error("Recorrido UI:", fallo(error));
  }
  // Usa las mismas sesiones y publicaciones temporales. Los visitantes siguen
  // observando la pagina, pero el guardado omite los formularios para aislarlos.
  try {
    await enGrupos([...productores, ...operadores], async sesion => {
      const leer = sesion.rol === "PRODUCTOR" ? leerPublicacionProductorPorApi : leerPublicacionOperadorPorApi;
      const actual = await paso(sesion, "api-leer-estado-previo", () => leer(sesion, sesion.oferta));
      sesion.oferta.precio = actual.precio;
    });
    await probarPrecios(9, "API");
    reporte.api = { ok: true };
  } catch (error) {
    reporte.api = { ok: false, error: fallo(error) };
    reporte.errores.push({ fase: "comprobacion-api", error: fallo(error) });
  }
} catch (error) {
  reporte.errores.push({ fase: "ejecucion", error: fallo(error) });
  console.error(fallo(error));
} finally {
  clearInterval(monitor);
  process.off("SIGINT", interrumpir);
  process.off("SIGTERM", interrumpir);
  for (const sesion of [...productores, ...operadores].filter(Boolean)) {
    try {
      if (sesion.diagnostico) reporte.diagnosticos.push(await sesion.diagnostico.guardar());
    } catch (error) { reporte.errores.push({ fase: "guardar-diagnostico", sesion: sesion.id, error: fallo(error) }); }
  }
  await browser?.close().catch(() => {});
  await limpiar();
  reporte.diagnosticoCompleto = reporte.diagnosticos.length === productores.length + operadores.length
    && reporte.diagnosticos.every(d => d.trace && d.registro
      && !d.errores.some(e => ["iniciar-traza", "guardar-traza"].includes(e.etapa)));
  reporte.interrupcion = interrupcion ?? null;
  reporte.publicacionesDePrueba = creadas;
  reporte.fin = new Date().toISOString();
  reporte.ok = !interrupcion && !reporte.errores.length && reporte.fases.length === 3 && reporte.fases.every(f => f.ok) && reporte.api?.ok === true;
  reporte.objetivoCompletoVerificado = MODO === "completo" && reporte.ok;
  await mkdir(dirname(REPORT_PATH), { recursive: true });
  await writeFile(REPORT_PATH, JSON.stringify(reporte, null, 2).replace(/\n/g, "\r\n") + "\r\n");
  console.log("Informe:", REPORT_PATH, "Resultado:", reporte.ok ? "OK" : "FALLO", "Modo:", MODO);
  process.exitCode = reporte.ok ? 0 : 1;
}
