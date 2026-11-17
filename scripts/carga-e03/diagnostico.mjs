import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const MAX_EVENTOS = 1500;
const MAX_PASOS = 250;
const claveSensible = /authorization|cookie|password|contrase(?:ñ|n)a|secret|token|storageState/i;

function ocultar(texto, secretos = []) {
  let salida = String(texto);
  const valores = [process.env.E03_TEST_PASSWORD, process.env.SESSION_SECRET,
    process.env.TWO_FACTOR_ENCRYPTION_KEY, ...secretos];
  for (const valor of valores) {
    if (typeof valor === "string" && valor.length >= 8) salida = salida.split(valor).join("[OCULTO]");
  }
  return salida
    .replace(/\bBearer\s+[^\s"',]+/gi, "Bearer [OCULTO]")
    .replace(/((?:authorization|set-cookie|cookie)\s*:\s*)[^\r\n]+/gi, "$1[OCULTO]")
    .replace(/([?&](?:token|password|secret|session|sesion|code)=)[^&#\s"']+/gi, "$1[OCULTO]")
    .replace(/(https?:\/\/)[^/\s@]+@/gi, "$1[OCULTO]@")
    .slice(0, 30_000);
}

export function describirError(error, secretos = []) {
  return ocultar(error instanceof Error ? error.message : String(error), secretos);
}

function limpiarDatos(valor, secretos, vistos = new WeakSet(), nivel = 0) {
  if (typeof valor === "string") return ocultar(valor, secretos);
  if (typeof valor === "bigint") return String(valor);
  if (valor == null || typeof valor !== "object") return valor;
  if (valor instanceof Error) return describirError(valor, secretos);
  if (nivel >= 8 || vistos.has(valor)) return "[OMITIDO]";
  vistos.add(valor);
  if (Array.isArray(valor)) return valor.slice(-200).map(v => limpiarDatos(v, secretos, vistos, nivel + 1));
  return Object.fromEntries(Object.entries(valor).slice(0, 80).map(([clave, dato]) => [clave,
    claveSensible.test(clave) ? "[OCULTO]" : limpiarDatos(dato, secretos, vistos, nivel + 1)]));
}

function rutaDe(url) {
  try { const valor = new URL(url); return valor.origin + valor.pathname; }
  catch { return "URL no disponible"; }
}

async function conLimite(promesa, tiempo, mensaje) {
  let temporizador;
  try {
    return await Promise.race([promesa, new Promise((_, rechazar) => {
      temporizador = setTimeout(() => rechazar(new Error(mensaje)), tiempo);
    })]);
  } finally { clearTimeout(temporizador); }
}

async function estadoDePagina(page) {
  if (page.isClosed()) return { cerrada: true };
  try {
    return await conLimite(page.evaluate(() => {
      const visible = elemento => {
        const estilo = getComputedStyle(elemento);
        return elemento.getClientRects().length > 0 && estilo.display !== "none" && estilo.visibility !== "hidden";
      };
      const texto = elemento => elemento?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const etiqueta = elemento => elemento.getAttribute("aria-label")
        || (elemento.getAttribute("aria-labelledby") ?? "").split(/\s+/).map(id => texto(document.getElementById(id))).join(" ").trim()
        || [...(elemento.labels ?? [])].map(texto).join(" ");
      const dialogos = [...document.querySelectorAll('[role="dialog"]')].filter(visible).slice(0, 5);
      return {
        url: location.origin + location.pathname,
        visibilidad: document.visibilityState,
        dialogos: dialogos.map(elemento => ({ titulo: etiqueta(elemento), texto: texto(elemento).slice(0, 2000) })),
        precios: [...document.querySelectorAll("input, textarea")].filter(elemento =>
          visible(elemento) && /precio/i.test([elemento.id, elemento.name, etiqueta(elemento)].join(" ")))
          .slice(0, 15).map(elemento => ({
            id: elemento.id, etiqueta: etiqueta(elemento), valor: elemento.value.slice(0, 80),
            disabled: elemento.matches(":disabled"), readOnly: elemento.readOnly,
            ariaDisabled: elemento.getAttribute("aria-disabled"),
            ocultoParaAccesibilidad: Boolean(elemento.closest('[aria-hidden="true"]')),
          })),
        botones: [...document.querySelectorAll('button, [role="button"]')].filter(elemento =>
          visible(elemento) && /^(Editar|Guardar|Confirmar|Cancelar|Reintentar)(?:\s|$)/i.test(etiqueta(elemento) || texto(elemento)))
          .slice(0, 20).map(elemento => ({
            texto: etiqueta(elemento) || texto(elemento), disabled: elemento.matches(":disabled"),
            ariaDisabled: elemento.getAttribute("aria-disabled"),
          })),
        cargas: [...document.querySelectorAll("[aria-busy]")].filter(visible).slice(0, 10)
          .map(elemento => ({ etiqueta: etiqueta(elemento) || elemento.className, valor: elemento.getAttribute("aria-busy") })),
        avisos: [...document.querySelectorAll('[role="alert"]')].filter(visible).slice(0, 5).map(elemento => texto(elemento).slice(0, 1000)),
      };
    }), 3000, "La página no respondió a la captura de estado en 3 segundos");
  } catch (error) { return { url: rutaDe(page.url()), errorCaptura: describirError(error) }; }
}

export async function iniciarDiagnostico(sesion, directorio) {
  if (sesion.diagnostico) return sesion.diagnostico;
  const { page, context } = sesion;
  const nombre = String(sesion.id ?? sesion.usuario ?? "actor").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "actor";
  const carpeta = join(resolve(directorio), nombre);
  await mkdir(carpeta, { recursive: true });
  const secretos = (sesion.storageState?.cookies ?? []).map(cookie => cookie.value);
  const archivoTrace = join(carpeta, "trace.zip");
  const archivoRegistro = join(carpeta, "diagnostico.json");
  const eventos = [], pasos = [], errores = [], capturas = [];
  const solicitudes = new WeakMap();
  let numeroSolicitud = 0, numeroPaso = 0, etapaActual = null;
  let eventosOmitidos = 0, pasosOmitidos = 0, trazaIniciada = false, guardado;

  function anotar(nombreEvento, datos = {}) {
    eventos.push({ instante: Date.now(), evento: nombreEvento, etapa: etapaActual, datos: limpiarDatos(datos, secretos) });
    if (eventos.length > MAX_EVENTOS) { eventos.shift(); eventosOmitidos++; }
  }
  function esPublicacion(solicitud) {
    try {
      const url = new URL(solicitud.url());
      return url.origin === new URL(sesion.baseURL ?? page.url()).origin
        && /^\/(?:api\/publicaciones|mi-mercado|publicaciones)(?:[/-]|$)/.test(url.pathname);
    } catch { return false; }
  }
  const alSolicitar = solicitud => {
    if (!esPublicacion(solicitud)) return;
    const id = ++numeroSolicitud;
    solicitudes.set(solicitud, id);
    anotar("solicitud", { id, metodo: solicitud.method(), ruta: rutaDe(solicitud.url()),
      accionServidor: Boolean(solicitud.headers()["next-action"]) });
  };
  const alResponder = respuesta => {
    const id = solicitudes.get(respuesta.request());
    if (id === undefined) return;
    anotar("respuesta", { id, metodo: respuesta.request().method(), ruta: rutaDe(respuesta.url()), estado: respuesta.status() });
  };
  const alFallarSolicitud = solicitud => {
    const id = solicitudes.get(solicitud);
    if (id === undefined) return;
    anotar("solicitud-fallida", { id, metodo: solicitud.method(), ruta: rutaDe(solicitud.url()), error: solicitud.failure()?.errorText });
  };
  const alFinalizarSolicitud = solicitud => {
    const id = solicitudes.get(solicitud);
    if (id !== undefined) anotar("solicitud-finalizada", { id });
  };
  const alConsola = mensaje => {
    if (mensaje.type() === "error" || mensaje.type() === "warning") anotar("consola", { tipo: mensaje.type(), mensaje: mensaje.text() });
  };
  const alErrorPagina = error => anotar("error-pagina", { mensaje: describirError(error, secretos) });
  const escuchas = [["request", alSolicitar], ["response", alResponder], ["requestfailed", alFallarSolicitud],
    ["requestfinished", alFinalizarSolicitud], ["console", alConsola], ["pageerror", alErrorPagina]];

  const diagnostico = {
    anotar,
    async paso(nombrePaso, accion, detalles = {}) {
      const anterior = etapaActual;
      etapaActual = nombrePaso;
      const fila = { numero: ++numeroPaso, nombre: nombrePaso, inicio: Date.now(), detalles: limpiarDatos(detalles, secretos),
        antes: limpiarDatos(await estadoDePagina(page), secretos) };
      pasos.push(fila);
      if (pasos.length > MAX_PASOS) { pasos.shift(); pasosOmitidos++; }
      try {
        const resultado = await accion();
        fila.ok = true;
        return resultado;
      } catch (error) {
        fila.ok = false;
        fila.error = describirError(error, secretos);
        errores.push({ etapa: nombrePaso, instante: Date.now(), error: fila.error });
        try { if (error && typeof error === "object" && !error.etapa) error.etapa = nombrePaso; } catch { /* Puede ser un error inmutable. */ }
        if (!page.isClosed()) {
          const captura = join(carpeta, "fallo-" + fila.numero + ".png");
          try {
            await page.screenshot({ path: captura, fullPage: false, timeout: 5000 });
            capturas.push(captura);
            fila.captura = captura;
          } catch (errorCaptura) { fila.errorCaptura = describirError(errorCaptura, secretos); }
        }
        throw error;
      } finally {
        fila.despues = limpiarDatos(await estadoDePagina(page), secretos);
        fila.fin = Date.now();
        etapaActual = anterior;
      }
    },
    guardar() {
      if (guardado) return guardado;
      guardado = (async () => {
        for (const [evento, escuchar] of escuchas) page.off(evento, escuchar);
        const estadoFinal = limpiarDatos(await estadoDePagina(page), secretos);
        let trace = null;
        if (trazaIniciada) {
          try { await context.tracing.stop({ path: archivoTrace }); trace = archivoTrace; }
          catch (error) { errores.push({ etapa: "guardar-traza", error: describirError(error, secretos) }); }
        }
        const datos = { sesion: sesion.id ?? sesion.usuario, rol: sesion.rol, trace, capturas, pasos,
          eventos, eventosOmitidos, pasosOmitidos, errores, estadoFinal };
        await writeFile(archivoRegistro, JSON.stringify(datos, null, 2).replace(/\n/g, "\r\n") + "\r\n");
        return { sesion: datos.sesion, trace, registro: archivoRegistro, capturas: [...capturas], errores: [...errores] };
      })();
      return guardado;
    },
  };
  sesion.diagnostico = diagnostico;
  for (const [evento, escuchar] of escuchas) page.on(evento, escuchar);
  try {
    await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
  } catch (error) {
    errores.push({ etapa: "iniciar-traza", error: describirError(error, secretos) });
    throw error;
  }
  trazaIniciada = true;
  anotar("inicio-diagnostico", { sesion: sesion.id, rol: sesion.rol, url: rutaDe(page.url()) });
  return diagnostico;
}

export async function paso(sesion, nombre, accion, detalles = {}) {
  return sesion.diagnostico ? sesion.diagnostico.paso(nombre, accion, detalles) : accion();
}
