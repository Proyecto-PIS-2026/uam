import assert from "node:assert/strict";
import { request } from "@playwright/test";

function filtrosDe(request) {
  if (request.method() !== "POST" || new URL(request.url()).pathname !== "/publicaciones") return null;
  try { return JSON.parse(request.postData())[0]; } catch { return null; }
}

function resultadoDe(texto) {
  for (const linea of texto.split("\n")) {
    const dato = linea.slice(linea.indexOf(":") + 1);
    if (!dato.startsWith("{")) continue;
    let valor;
    try { valor = JSON.parse(dato); } catch { continue; }
    if (Array.isArray(valor.publicaciones) && Number.isInteger(valor.total)) return valor;
  }
  throw new Error("La respuesta de búsqueda no contiene un catálogo de publicaciones.");
}

async function comprobarConsulta(respuesta, especie, minimo) {
  assert.equal(respuesta.status(), 200, "La consulta pública debe responder 200");
  const { total, publicaciones } = resultadoDe(await respuesta.text());
  assert.ok(total > 0 && publicaciones.some(p => p.especie === especie), "No apareció la especie buscada: " + especie);
  if (minimo) assert.ok(publicaciones.every(p => p.precio != null && Number(p.precio) >= Number(minimo)), "El filtro devolvió un precio fuera del rango");
  return respuesta.status();
}

async function consultarDesdePantalla(page, especie, minimo) {
  const campo = minimo
    ? page.getByRole("textbox", { name: "Precio Mínimo", exact: true })
    : page.getByRole("searchbox", { name: "Buscar publicaciones" });
  const [respuesta] = await Promise.all([
    page.waitForResponse(r => {
      const filtros = filtrosDe(r.request());
      return filtros?.busqueda === especie && (filtros.precioMinimo || "") === (minimo || "");
    }),
    campo.fill(minimo || especie),
  ]);
  assert.equal(respuesta.status(), 200, "La búsqueda desde la pantalla debe responder 200");
  // La respuesta de la acción puede llegar antes de que React confirme el
  // nuevo catálogo en el DOM; esperar aria-busy=false evita leer tarjetas viejas.
  await page.waitForFunction(() =>
    document.querySelector(".secciones-pagina[aria-busy]")?.getAttribute("aria-busy") === "false",
  );
  const tarjeta = page.getByRole("button", { name: "Ver detalles de " + especie, exact: true }).first();
  await tarjeta.waitFor();
  if (minimo) {
    const tarjetas = await page.getByRole("button", { name: /^Ver detalles de / }).allTextContents();
    assert.ok(tarjetas.length && tarjetas.every(texto => {
      const precio = texto.match(/\$\s*([\d.]+)/);
      return precio && Number(precio[1].replaceAll(".", "")) >= Number(minimo);
    }), "La vista de comprador muestra precios fuera del filtro");
  }
  return respuesta;
}

async function irAlMercado(page) {
  const res = await page.goto("/publicaciones", { waitUntil: "domcontentloaded" });
  assert.equal(res.status(), 200);
  await page.getByRole("searchbox", { name: "Buscar publicaciones" }).waitFor();
}

export async function identificarConsultaPublica(browser, baseURL, especie) {
  const context = await browser.newContext({ baseURL });
  try {
    const page = await context.newPage();
    await irAlMercado(page);
    const response = await consultarDesdePantalla(page, especie);
    const req = response.request();
    const headers = req.headers();
    assert.ok(headers["next-action"], "No se identificó la acción pública de búsqueda");
    const comunes = { origin: baseURL, accept: "text/x-component", "content-type": headers["content-type"], "next-action": headers["next-action"] };
    if (headers["next-router-state-tree"]) comunes["next-router-state-tree"] = headers["next-router-state-tree"];
    return { headers: comunes, filtros: filtrosDe(req) };
  } finally {
    await context.close();
  }
}

export async function crearComprador(browser, baseURL, plantilla, usaPantalla, timeout) {
  if (usaPantalla) {
    const context = await browser.newContext({ baseURL, viewport: { width: 1366, height: 900 } });
    const page = await context.newPage();
    page.setDefaultTimeout(timeout);
    return {
      canal: "ui",
      async navegar() {
        await irAlMercado(page);
        return 200;
      },
      async consultar(especie, minimo) { return (await consultarDesdePantalla(page, especie, minimo)).status(); },
      async abrirDetalle(especie) {
        await page.getByRole("button", { name: new RegExp("^Ver detalles de " + escaparRegExp(especie) + "(?:$|\\s)") }).first().click();
        const dialog = page.getByRole("dialog", { name: "Detalle de publicación" });
        await dialog.waitFor({ state: "visible" });
        await page.getByRole("button", { name: "Detalle de consulta" }).click();
        await dialog.waitFor({ state: "hidden" });
        return 200;
      },
      cerrar: () => context.close(),
    };
  }

  const context = await request.newContext({ baseURL, timeout });
  return {
    canal: "http",
    async navegar(especie) {
      const r = await context.get("/publicaciones?especie=" + encodeURIComponent(especie));
      try {
        assert.equal(r.status(), 200);
        assert.ok((await r.text()).includes("Mercado Virtual"), "No se recibió el mercado público");
        return r.status();
      } finally { await r.dispose(); }
    },
    async consultar(especie, minimo) {
      const filtros = { ...plantilla.filtros, busqueda: especie, precioMinimo: minimo || "" };
      const r = await context.post("/publicaciones", { headers: plantilla.headers, data: JSON.stringify([filtros]) });
      try { return await comprobarConsulta(r, especie, minimo); } finally { await r.dispose(); }
    },
    cerrar: () => context.dispose(),
  };
}

function escaparRegExp(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
