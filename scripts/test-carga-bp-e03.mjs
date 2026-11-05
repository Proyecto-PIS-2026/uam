import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { crearComprador, identificarConsultaPublica } from "./carga-e03/compradores.mjs";
import { cambiarPrecioDesdePantalla, crearPublicacion, crearPublicacionDesdePantalla, enviarPrecio, identificarOperador, iniciarSesion, leerPropias, prepararInterfazOperador, verificarConflictoEnPantalla, verificarVistas } from "./carga-e03/operadores.mjs";

const BASE_URL = (process.env.E03_BASE_URL ?? "https://uam-testing.bravesea-7e3d1ed9.brazilsouth.azurecontainerapps.io").replace(/\/$/, "");
const PASSWORD = process.env.E03_TEST_PASSWORD;
const CUENTAS = Array.from({ length: 30 }, (_, i) => "carga_e03_" + String(i + 1).padStart(2, "0"));
const NIVELES = [50, 75, 100];
const RONDAS = 2;
// Cada comprador tiene contexto y página de navegador propios. Esto prueba el
// recorrido real de la aplicación con 50/75/100 compradores concurrentes.
const compradoresUiPorNivel = nivel => nivel;
const TIMEOUT = 45_000;
const TIMEOUT_LOGIN = 120_000;
if (!PASSWORD) {
  console.error("Definí E03_TEST_PASSWORD para las cuentas carga_e03_01 a carga_e03_30.");
  process.exit(2);
}

const reporte = {
  prueba: "BP-E03", destino: BASE_URL, inicio: new Date().toISOString(),
  sesionesOperadorPorNivel: CUENTAS.length, nivelesCompradores: NIVELES,
  compradoresUiPorNivel: Object.fromEntries(NIVELES.map(nivel => [nivel, compradoresUiPorNivel(nivel)])),
  canalCompradores: "interfaz web con contexto de navegador aislado por comprador",
  rondasPorNivel: RONDAS, dispositivosMismaCuenta: 10,
  casos: {}, metricas: {}, operaciones: [], verificaciones: [], publicacionesDePrueba: [], errores: [],
};
const creadas = [];
const operadores = [];
const resultadoNivel = new Map();
const sesionesPorRecorrido = nivel => ({
  navegacion: nivel, busqueda: nivel, filtro_precio: nivel,
  consulta_propia: CUENTAS.length, cambio_precio: CUENTAS.length,
  drawer_publico: compradoresUiPorNivel(nivel),
  alta_publicacion_ui: CUENTAS.length,
});
// Playwright incluye cabeceras y cookies en su «Call log». El informe guarda
// el motivo del fallo sin copiar credenciales ni identificadores de sesión.
const fallo = e => (e instanceof Error ? e.message : String(e)).split(/\r?\nCall log:/)[0];

async function enGrupos(items, limite, accion) {
  for (let inicio = 0; inicio < items.length; inicio += limite) {
    const resultados = await Promise.allSettled(items.slice(inicio, inicio + limite).map((v, i) => accion(v, inicio + i)));
    const fallos = resultados.filter(r => r.status === "rejected");
    if (fallos.length) throw new Error(fallos.map(r => fallo(r.reason)).join("\n"));
  }
}

async function verificar(nombre, fn, contexto = {}) {
  try {
    const datos = await fn();
    reporte.verificaciones.push({ nombre, ...contexto, datos, ok: true });
    return true;
  } catch (e) {
    const error = fallo(e);
    reporte.verificaciones.push({ nombre, ...contexto, ok: false, error });
    reporte.errores.push({ fase: nombre, ...contexto, error });
    console.error(nombre, contexto, error.split("\n")[0]);
    return false;
  }
}

async function medir(nivel, ronda, sesion, canal, operacion, fn, datos = {}) {
  const inicio = Date.now();
  const fila = { nivel, ronda, sesion, canal, operacion, inicio, ...datos };
  try {
    const resultado = await fn();
    fila.estado = resultado && typeof resultado === "object"
      ? resultado.http ?? resultado.status ?? "OK"
      : resultado ?? "OK";
    fila.ok = true;
  } catch (e) {
    fila.ok = false;
    if (Number.isInteger(e.actual) && e.actual >= 400 && e.actual <= 599) fila.estado = e.actual;
    fila.error = fallo(e);
    reporte.errores.push({ fase: operacion, nivel, ronda, sesion, error: fila.error });
  } finally {
    fila.duracionMs = Date.now() - inicio;
    reporte.operaciones.push(fila);
  }
}

function resumir(rows) {
  const tiempos = rows.map(v => v.duracionMs).sort((a, b) => a - b);
  const pct = k => tiempos[Math.ceil(tiempos.length * k) - 1] ?? null;
  const estados = {};
  for (const row of rows) {
    const estado = row.estado ?? "ERROR";
    estados[estado] = (estados[estado] ?? 0) + 1;
  }
  return { completadas: rows.filter(r => r.ok).length, errores: rows.filter(r => !r.ok).length, estados, p50Ms: pct(0.5), p95Ms: pct(0.95), maxMs: tiempos.at(-1) ?? null };
}

async function ejecutarNivel(browser, nivel, plantilla) {
  const compradores = [];
  try {
    await enGrupos(Array.from({ length: nivel }, (_, i) => i), 10, async i => {
      compradores[i] = await crearComprador(browser, BASE_URL, plantilla, true, TIMEOUT);
    });
    for (let ronda = 1; ronda <= RONDAS; ronda++) {
      function compradoresActivos(operacion, accion) {
        return compradores.map((c, i) => medir(nivel, ronda, i + 1, c.canal, operacion,
          () => accion(c, operadores[(i + ronda - 1) % operadores.length].registro.especie)));
      }
      // Las lecturas y escrituras de los operadores se solapan con la actividad
      // de compradores. Las barreras permiten comparar la misma mezcla en cada ronda.
      await Promise.all([
        ...compradoresActivos("navegacion", (c, especie) => c.navegar(especie)),
        ...operadores.map(o => medir(nivel, ronda, o.usuario, "operador", "consulta_propia", async () => {
          const item = (await leerPropias(o)).find(p => p.id === o.registro.id);
          assert.ok(item && Number(item.precio) === o.registro.precio);
          return 200;
        }, { publicacion: o.registro.id })),
      ]);
      const compradoresConInterfaz = compradores
        .map((comprador, index) => ({ comprador, index }))
        .filter(({ comprador }) => comprador.canal === "ui");
      await Promise.all([
        ...compradoresConInterfaz.map(({ comprador, index }) =>
          medir(nivel, ronda, index + 1, comprador.canal, "drawer_publico",
            () => comprador.abrirDetalle(operadores[(index + ronda - 1) % operadores.length].registro.especie))),
        ...operadores.map(async o => {
          const reg = o.registro, previo = reg.precio, nuevo = previo + 1;
          await medir(nivel, ronda, o.usuario, "ui_operador", "cambio_precio", () => cambiarPrecioDesdePantalla(o, reg, nuevo),
            { publicacion: reg.id, previo, nuevo });
          if (ronda === 1) {
            await medir(nivel, ronda, o.usuario, "ui_operador", "alta_publicacion_ui",
              () => crearPublicacionDesdePantalla(o, Number(o.usuario.slice(-2)), creadas));
          }
        }),
      ]);
      await Promise.all(compradores.map((c, i) => (async () => {
        const especie = operadores[(i + ronda - 1) % operadores.length].registro.especie;
        await medir(nivel, ronda, i + 1, c.canal, "busqueda", () => c.consultar(especie));
        await medir(nivel, ronda, i + 1, c.canal, "filtro_precio", () => c.consultar(especie, "100"));
      })()));
    }
    const filas = reporte.operaciones.filter(r => r.nivel === nivel);
    const distribucion = {};
    for (const [op, cantidad] of Object.entries(sesionesPorRecorrido(nivel))) {
      const rows = filas.filter(r => r.operacion === op);
      distribucion[op] = rows.length;
      for (let ronda = 1; ronda <= RONDAS; ronda++) {
        const activas = rows.filter(r => r.ronda === ronda && r.ok);
        const esperadoEnRonda = op === "alta_publicacion_ui" && ronda > 1 ? 0 : cantidad;
        assert.equal(new Set(activas.map(r => r.sesion)).size, esperadoEnRonda, "Faltan sesiones con " + op + " completada en ronda " + ronda);
      }
    }
    return distribucion;
  } finally {
    await Promise.allSettled(compradores.filter(Boolean).map(c => c.cerrar()));
  }
}

async function probarDispositivos(browser) {
  const propietario = operadores[0];
  const dispositivos = [propietario];
  const registros = [];
  try {
    await enGrupos(Array.from({ length: 9 }, (_, i) => i + 1), 1, async i => {
      dispositivos[i] = await iniciarSesion(browser, BASE_URL, propietario.usuario, PASSWORD, TIMEOUT_LOGIN);
      dispositivos[i].operadorId = propietario.operadorId;
    });
    // Un timeout de escritura deja incierta la versión de esa publicación. El
    // caso de diez dispositivos usa una nueva si la carga anterior dejó dudas.
    if (!reporte.operaciones.some(r => r.sesion === propietario.usuario && r.operacion === "cambio_precio" && !r.ok)) registros.push(propietario.registro);
    while (registros.length < dispositivos.length) registros.push(await crearPublicacion(propietario, registros.length, creadas));
    for (let i = 0; i < dispositivos.length; i++) {
      dispositivos[i].registro = registros[i];
      await prepararInterfazOperador(dispositivos[i]);
    }
    const cp03 = await verificar("diez_publicaciones_distintas", async () => {
      const lecturas = await Promise.all(dispositivos.map(d => leerPropias(d)));
      const escrituras = await Promise.all(dispositivos.map((d, i) => verificar("escritura_dispositivo", async () => {
        const reg = registros[i], previo = reg.precio, nuevo = previo + 100 + i;
        assert.equal(Number(lecturas[i].find(p => p.id === reg.id)?.precio), previo);
        const resultado = await cambiarPrecioDesdePantalla(d, reg, nuevo);
        return { id: reg.id, previo, nuevo, http: resultado.http };
      }, { dispositivo: i + 1 })));
      assert.ok(escrituras.every(Boolean), "No se confirmaron las diez escrituras");
      await Promise.all(dispositivos.map(async (d, i) => {
        const otro = registros[(i + 1) % registros.length];
        assert.equal(Number((await leerPropias(d)).find(p => p.id === otro.id)?.precio), otro.precio);
      }));
      return { sesiones: dispositivos.length, ids: registros.map(r => r.id), relecturasDesdeOtraSesion: dispositivos.length };
    });
    if (cp03) reporte.casos["CP-E03-03"] = "Aprobado";

    const reg = registros[0];
    const carrera = await verificar("misma_version_diez_dispositivos", async () => {
      const version = reg.version;
      const respuestas = await Promise.all(dispositivos.map(async (d, i) => {
        const precio = 1600 + i;
        const r = await enviarPrecio(d, reg, precio, version);
        const body = await r.json();
        return { dispositivo: i + 1, precio, status: r.status(), id: body.publicacionId, mensaje: body.errores?.[0] };
      }));
      const exitos = respuestas.filter(r => r.status === 200 && r.id === reg.id);
      reporte.cambiosDePrecioExitososMismaCuenta = exitos.length;
      assert.equal(exitos.length, 1);
      reg.version++; reg.precio = exitos[0].precio;
      assert.equal(respuestas.filter(r => r.status === 409 && r.mensaje).length, 9);
      assert.equal(Number((await leerPropias(propietario)).find(p => p.id === reg.id)?.precio), reg.precio);
      return { publicacion: reg.id, version, respuestas };
    });
    const ui = await verificar("conflicto_visible_sin_sobrescritura", () => verificarConflictoEnPantalla(propietario, dispositivos[1], reg));
    if (carrera && ui) reporte.casos["CP-E03-05"] = "Aprobado";
  } finally {
    await Promise.allSettled(dispositivos.slice(1).filter(Boolean).map(d => d.context.close()));
  }
}

async function verificarFinal(browser) {
  const aislamiento = [];
  for (let i = 0; i < operadores.length; i++) {
    const origen = operadores[i], objetivo = operadores[(i + 1) % operadores.length], reg = objetivo.registro;
    aislamiento.push(await verificar("aislamiento", async () => {
      const antes = await leerPropias(objetivo);
      const lectura = await origen.context.request.get("/api/publicaciones/operador/" + objetivo.operadorId);
      const escritura = await enviarPrecio(origen, reg, reg.precio + 500);
      assert.ok([403, 404].includes(lectura.status()), "Lectura ajena HTTP " + lectura.status());
      assert.ok([403, 404].includes(escritura.status()), "Escritura ajena HTTP " + escritura.status());
      assert.deepEqual(await leerPropias(objetivo), antes);
      return { objetivo: objetivo.usuario, publicacion: reg.id, lectura: lectura.status(), escritura: escritura.status() };
    }, { usuario: origen.usuario }));
  }
  const vistas = [];
  await enGrupos(operadores, 1, async o => {
    vistas.push(await verificar("persistencia_y_vista_publica", async () => {
      const nueva = await iniciarSesion(browser, BASE_URL, o.usuario, PASSWORD, TIMEOUT_LOGIN);
      try { return await verificarVistas(browser, BASE_URL, nueva, o, creadas.filter(r => r.usuario === o.usuario)); }
      finally { await nueva.context.close(); }
    }, { usuario: o.usuario }));
  });
  const persistencia = vistas.length === CUENTAS.length && vistas.every(Boolean);
  reporte.consistenciaFinal = persistencia ? "verificada" : "con diferencias";
  if (persistencia) reporte.casos["CP-E03-04"] = "Aprobado";
  if (persistencia && aislamiento.every(Boolean)) reporte.casos["CP-E03-07"] = "Aprobado";
}

async function main() {
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: process.env.E03_BROWSER_CHANNEL ?? "chrome", args: ["--disable-crash-reporter", "--disable-crashpad"] });
    console.log("BP-E03: preparando las 30 cuentas de prueba en " + BASE_URL);
    await enGrupos(CUENTAS, 1, async (usuario, i) => {
      const sesion = await iniciarSesion(browser, BASE_URL, usuario, PASSWORD, TIMEOUT_LOGIN);
      operadores[i] = sesion;
      await identificarOperador(sesion);
      sesion.registro = await crearPublicacion(sesion, i, creadas);
      await prepararInterfazOperador(sesion);
      console.log("Preparada " + usuario + ": publicación " + sesion.registro.id);
    });
    let plantilla;
    const consultaDisponible = await verificar("preparar_consulta_publica", async () => {
      plantilla = await identificarConsultaPublica(browser, BASE_URL, operadores[0].registro.especie);
    });
    if (consultaDisponible) {
      for (const nivel of NIVELES) {
        console.log("Carga: 30 operadores y " + nivel + " compradores, " + RONDAS + " rondas.");
        const ok = await verificar("carga", () => ejecutarNivel(browser, nivel, plantilla), { nivel });
        resultadoNivel.set(nivel, ok);
      }
    }
    if (resultadoNivel.get(50)) reporte.casos["CP-E03-01"] = "Aprobado";
    if (resultadoNivel.get(100)) reporte.casos["CP-E03-02"] = "Aprobado";
    const actividad = NIVELES.every(nivel => {
      const filas = reporte.operaciones.filter(r => r.nivel === nivel && r.ok);
      return Object.entries(sesionesPorRecorrido(nivel))
        .every(([op, cantidad]) => new Set(filas.filter(r => r.operacion === op).map(r => r.sesion)).size === cantidad);
    });
    if (actividad) reporte.casos["CP-E03-08"] = "Aprobado";
    const totalEsperado = RONDAS * NIVELES.reduce((s, n) => s + 4 * n + 2 * CUENTAS.length, 0)
      + NIVELES.length * CUENTAS.length;
    if (reporte.operaciones.length === totalEsperado && reporte.operaciones.every(r => Number.isFinite(r.duracionMs) && (r.ok || r.error))) reporte.casos["CP-E03-06"] = "Aprobado";
    console.log("Concurrencia: 10 sesiones de la misma cuenta, publicaciones distintas y conflicto controlado.");
    await verificar("dispositivos", () => probarDispositivos(browser));
    console.log("Persistencia, vistas públicas y aislamiento entre cuentas.");
    await verificarFinal(browser);
  } catch (error) {
    reporte.errores.push({ fase: "ejecucion", error: fallo(error) });
    console.error(fallo(error));
  } finally {
    // Por defecto se conservan las publicaciones, igual que en el script original.
    // La limpieza optativa se limita a IDs cuya alta confirmó esta ejecución.
    if (process.env.E03_LIMPIAR === "1") {
      await enGrupos(creadas, 3, reg => verificar("limpieza", async () => {
        const o = operadores.find(s => s?.usuario === reg.usuario);
        let status;
        for (let intento = 0; intento < 3; intento++) {
          const r = await o.context.request.delete("/api/publicaciones/" + reg.id + "?operadorId=" + reg.operadorId);
          status = r.status();
          if ([200, 404].includes(status) || status < 500) break;
          await new Promise(resolve => setTimeout(resolve, 1000 * (intento + 1)));
        }
        assert.ok([200, 404].includes(status), "Baja de fixture HTTP " + status);
        return status;
      }, { publicacion: reg.id }));
    }
    if (browser) await browser.close().catch(error => reporte.errores.push({ fase: "cerrar_navegador", error: fallo(error) }));
    for (let i = 1; i <= 8; i++) reporte.casos["CP-E03-0" + i] ??= "Sin aprobar";
    reporte.cuentasOperador = operadores.filter(o => o?.registro).length;
    reporte.publicacionesDePrueba = creadas.map(r => ({ usuario: r.usuario, operadorId: r.operadorId, publicacionId: r.id, especie: r.especie, precioFinal: r.precio }));
    for (const nivel of NIVELES) {
      const filas = reporte.operaciones.filter(r => r.nivel === nivel);
      for (const tipo of new Set(filas.map(r => r.operacion))) reporte.metricas["nivel_" + nivel + "_" + tipo] = resumir(filas.filter(r => r.operacion === tipo));
    }
    reporte.fin = new Date().toISOString();
    if (process.env.E03_REPORT_PATH) {
      await writeFile(process.env.E03_REPORT_PATH, JSON.stringify(reporte, null, 2) + "\n", "utf8");
      const { operaciones, verificaciones, ...resumen } = reporte;
      console.log(JSON.stringify({ ...resumen, operacionesRegistradas: operaciones.length, verificacionesRegistradas: verificaciones.length }, null, 2));
    } else {
      console.log(JSON.stringify(reporte, null, 2));
    }
    if (reporte.errores.length || Object.values(reporte.casos).some(v => v !== "Aprobado")) process.exitCode = 1;
  }
}

main().catch(error => { console.error(fallo(error)); process.exitCode = 1; });
