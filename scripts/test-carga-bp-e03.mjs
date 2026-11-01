import { chromium, request as playwrightRequest } from "@playwright/test";

const BASE_URL = (process.env.E03_BASE_URL ?? "https://uam-testing.bravesea-7e3d1ed9.brazilsouth.azurecontainerapps.io").replace(/\/$/, "");
const PASSWORD = process.env.E03_TEST_PASSWORD;
const OPERATORS = Array.from({ length: 30 }, (_, index) => `carga_e03_${String(index + 1).padStart(2, "0")}`);
const BUYER_LEVELS = [50, 75, 100];
const BROWSER_BUYERS = 10;
const REQUEST_TIMEOUT_MS = 45_000;

if (!PASSWORD) {
  console.error("Definí E03_TEST_PASSWORD con la contraseña temporal de las cuentas carga_e03_01 a carga_e03_15.");
  process.exit(2);
}

const metrics = new Map();
function bucket(name) {
  if (!metrics.has(name)) metrics.set(name, { latenciesMs: [], completed: 0, errors: 0, statuses: {}, bytes: 0 });
  return metrics.get(name);
}

async function measure(name, operation) {
  const result = bucket(name);
  const started = performance.now();
  try {
    const response = await operation();
    const status = typeof response === "number" ? response : response.status();
    result.latenciesMs.push(performance.now() - started);
    result.statuses[status] = (result.statuses[status] ?? 0) + 1;
    if (status >= 200 && status < 400) result.completed++;
    else result.errors++;
    if (typeof response !== "number") {
      try { result.bytes += (await response.body()).byteLength; } catch { /* métricas de latencia no dependen del cuerpo */ }
    }
    return { status, response };
  } catch (error) {
    result.latenciesMs.push(performance.now() - started);
    result.errors++;
    result.statuses.NETWORK_ERROR = (result.statuses.NETWORK_ERROR ?? 0) + 1;
    return { status: 0, error: error instanceof Error ? error.message : String(error) };
  }
}

function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Number(sorted[Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1)].toFixed(1));
}

function summarizeMetrics() {
  return Object.fromEntries([...metrics.entries()].map(([name, value]) => [name, {
    completadas: value.completed,
    errores: value.errors,
    estados: value.statuses,
    p50Ms: percentile(value.latenciesMs, 0.50),
    p95Ms: percentile(value.latenciesMs, 0.95),
    maxMs: value.latenciesMs.length ? Number(Math.max(...value.latenciesMs).toFixed(1)) : null,
    bytesRecibidos: value.bytes,
  }]));
}

async function iniciarContexto(browser, username) {
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  page.setDefaultTimeout(REQUEST_TIMEOUT_MS);
  await page.goto("/iniciar-sesion", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Correo electrónico o nombre de usuario").fill(username);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await page.waitForURL(/\/mi-mercado(?:\/|$)/, { timeout: REQUEST_TIMEOUT_MS });
  return { context, page, username };
}

async function requestJson(context, path, init) {
  const response = await context.request.fetch(path, { timeout: REQUEST_TIMEOUT_MS, ...init });
  let body = {};
  try { body = await response.json(); } catch { /* se devuelve el estado para su diagnóstico */ }
  return { response, body };
}

async function prepararPublicacion(context, accountIndex) {
  const catalogResult = await requestJson(context, "/api/publicaciones");
  if (!catalogResult.response.ok()) throw new Error(`No se pudieron consultar catálogos (${catalogResult.response.status()}).`);
  const operador = catalogResult.body.operadores?.[0];
  const especie = catalogResult.body.especies?.[accountIndex % catalogResult.body.especies.length];
  if (!operador?.id || !especie?.id) throw new Error("El catálogo no devolvió un operador y una especie activos.");

  const ownPath = `/api/publicaciones/operador/${operador.id}`;
  const before = await requestJson(context, ownPath);
  if (!before.response.ok()) throw new Error(`No se pudieron consultar publicaciones propias (${before.response.status()}).`);

  // Las cuentas fueron creadas para esta prueba. Crear una publicación propia permite
  // medir lecturas, cambios de precio y persistencia sin tocar publicaciones ajenas.
  const especies = catalogResult.body.especies ?? [];
  let publicationId;
  let selectedSpecies;
  for (let offset = 0; offset < especies.length; offset++) {
    const candidate = especies[(accountIndex + offset) % especies.length];
    const result = await requestJson(context, "/api/publicaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      data: {
        operadorId: operador.id,
        especieId: candidate.id,
        variedadId: null,
        presentacionId: null,
        categoriaId: null,
        calibreId: null,
        paisId: null,
        disponibilidad: true,
        precio: "1000",
        cantidadUnidades: null,
        fotografia: "",
      },
    });
    if (result.response.status() === 201) {
      publicationId = result.body.id;
      selectedSpecies = candidate;
      break;
    }
    if (result.response.status() !== 400 || !(result.body.errores ?? []).some((message) => /ya tiene una publicación/i.test(message))) {
      throw new Error(`No se pudo preparar publicación para ${OPERATORS[accountIndex]} (${result.response.status()}): ${(result.body.errores ?? []).join(" ")}`);
    }
  }
  if (!publicationId) throw new Error(`No se encontró una combinación de especie libre para ${OPERATORS[accountIndex]}.`);

  const after = await requestJson(context, ownPath);
  const own = (after.body.publicaciones ?? []).find((item) => item.id === publicationId);
  if (!after.response.ok() || !own) throw new Error(`La publicación de prueba no aparece en el catálogo propio de ${OPERATORS[accountIndex]}.`);

  return {
    username: OPERATORS[accountIndex],
    operatorId: operador.id,
    publicationId,
    speciesId: selectedSpecies.id,
    speciesName: selectedSpecies.nombre,
    version: 1,
    price: Number(own.precio),
    ownPath,
  };
}

async function leerPropias(context, operatorId) {
  return context.request.get(`/api/publicaciones/operador/${operatorId}`, { timeout: REQUEST_TIMEOUT_MS });
}

async function actualizarPrecio(context, record, newPrice, metricName) {
  const changes = {
    version: record.version,
    precio: String(newPrice),
    cantidadUnidades: null,
    foto: null,
    especieId: record.speciesId,
    variedadId: null,
    presentacionId: null,
    categoriaId: null,
    calibreId: null,
    paisId: null,
    disponible: true,
  };
  const result = await measure(metricName, async () => context.request.patch(`/api/publicaciones/${record.publicationId}?operadorId=${record.operatorId}`, {
    multipart: { cambios: JSON.stringify(changes) },
    timeout: REQUEST_TIMEOUT_MS,
  }));
  if (result.status >= 200 && result.status < 300) {
    record.version++;
    record.price = newPrice;
  }
  return result;
}

async function uiBuyerActivity(browser, index, searchTerm) {
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  page.setDefaultTimeout(REQUEST_TIMEOUT_MS);
  const started = performance.now();
  try {
    await page.goto("/publicaciones", { waitUntil: "domcontentloaded" });
    const search = page.getByRole("searchbox", { name: "Buscar publicaciones" });
    await search.fill(searchTerm);
    await page.waitForTimeout(350);
    const species = page.getByRole("combobox", { name: "Especie", exact: true });
    if (await species.count()) {
      await species.click();
      const option = page.getByRole("option").filter({ hasText: /.+/ }).nth((index % 5) + 1);
      if (await option.count()) await option.click();
      else await page.keyboard.press("Escape");
    }
    const minPrice = page.getByRole("textbox", { name: "Precio Mínimo", exact: true });
    if (await minPrice.count()) {
      await minPrice.fill(String(100 + (index % 5) * 100));
      await page.waitForTimeout(350);
    }
    return { status: 200, elapsedMs: performance.now() - started };
  } finally {
    await context.close();
  }
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.E03_BROWSER_CHANNEL ?? "chrome",
    args: ["--disable-crash-reporter", "--disable-crashpad"],
  });
  const anonymous = await playwrightRequest.newContext({ baseURL: BASE_URL, timeout: REQUEST_TIMEOUT_MS });
  const operatorContexts = [];
  const errors = [];
  const records = [];
  const started = new Date();
  try {
    console.log(`BP-E03: destino ${BASE_URL}; preparación de ${OPERATORS.length} cuentas y publicaciones de prueba.`);
    for (let index = 0; index < OPERATORS.length; index++) {
      try {
        const session = await iniciarContexto(browser, OPERATORS[index]);
        const record = await prepararPublicacion(session.context, index);
        records.push(record);
        operatorContexts.push({ ...session, record });
        console.log(`Preparada ${record.username}: publicación ${record.publicationId}, especie ${record.speciesName}.`);
      } catch (error) {
        errors.push({ fase: "preparacion", usuario: OPERATORS[index], error: error instanceof Error ? error.message : String(error) });
      }
    }

    if (records.length !== OPERATORS.length) {
      throw new Error(`Solo se prepararon ${records.length}/${OPERATORS.length} operadores; se cancela la carga para no generar métricas incompletas.`);
    }

    for (const buyerCount of BUYER_LEVELS) {
      console.log(`Ejecutando nivel de carga: 30 sesiones de Operador y ${buyerCount} Compradores.`);
      const browserBuyerCount = Math.min(BROWSER_BUYERS, buyerCount);
      const queryBuyers = buyerCount - browserBuyerCount;
      const publicSpecies = records.map((record) => record.speciesName);

      const tasks = [];
      for (let index = 0; index < browserBuyerCount; index++) {
        tasks.push((async () => {
          const startedAt = performance.now();
          try {
            await uiBuyerActivity(browser, index, publicSpecies[index % publicSpecies.length]);
            const result = bucket(`nivel_${buyerCount}_compradores_ui`);
            result.completed++;
            result.latenciesMs.push(performance.now() - startedAt);
            result.statuses[200] = (result.statuses[200] ?? 0) + 1;
          } catch (error) {
            const result = bucket(`nivel_${buyerCount}_compradores_ui`);
            result.errors++;
            result.statuses.UI_ERROR = (result.statuses.UI_ERROR ?? 0) + 1;
            errors.push({ fase: `nivel_${buyerCount}_compradores_ui`, error: error instanceof Error ? error.message : String(error) });
          }
        })());
      }
      for (let index = 0; index < queryBuyers; index++) {
        const species = publicSpecies[index % publicSpecies.length];
        tasks.push(measure(`nivel_${buyerCount}_compradores_http`, async () => anonymous.get(`/publicaciones?especie=${encodeURIComponent(species)}`)));
      }
      for (let index = 0; index < operatorContexts.length; index++) {
        const session = operatorContexts[index];
        tasks.push(measure(`nivel_${buyerCount}_operadores_lectura`, async () => leerPropias(session.context, session.record.operatorId)));
      }
      await Promise.all(tasks);

      const writers = operatorContexts;
      await Promise.all(writers.map((session, index) => actualizarPrecio(
        session.context,
        session.record,
        session.record.price + 10 + (buyerCount === 50 ? 1 : buyerCount === 75 ? 2 : 3),
        `nivel_${buyerCount}_operadores_cambio_precio`,
      ).then((result) => {
        if (result.status !== 200) errors.push({ fase: `nivel_${buyerCount}_cambio_precio`, usuario: session.username, estado: result.status });
      })));
    }

    console.log("Ejecutando 10 dispositivos simultáneos en la cuenta carga_e03_01 para medir conflictos de edición y consistencia.");
    const sameAccount = [operatorContexts[0]];
    for (let device = 1; device < 10; device++) sameAccount.push(await iniciarContexto(browser, OPERATORS[0]));
    operatorContexts.push(...sameAccount.slice(1));
    const record = records[0];
    const currentVersion = record.version;
    const raceResponses = await Promise.all(sameAccount.map(async (session) => {
      await measure("misma_cuenta_10_dispositivos_lectura", async () => leerPropias(session.context, record.operatorId));
      const result = await actualizarPrecio(session.context, { ...record, version: currentVersion }, 1200, "misma_cuenta_10_dispositivos_cambio_precio");
      if (result.status === 409) {
        const body = await result.response.json().catch(() => ({}));
        const reported = Array.isArray(body.errores) && body.errores.length > 0;
        const stats = bucket("misma_cuenta_10_dispositivos_conflictos_informados");
        if (reported) stats.completed++;
        else stats.errors++;
        stats.statuses[reported ? "409_INFORMADO" : "409_SIN_MENSAJE"] = (stats.statuses[reported ? "409_INFORMADO" : "409_SIN_MENSAJE"] ?? 0) + 1;
      }
      return result.status;
    }));
    const successfulRaceWrites = raceResponses.filter((status) => status === 200).length;
    record.version += successfulRaceWrites;
    record.price = successfulRaceWrites ? 1200 : record.price;

    for (const item of records) {
      const session = operatorContexts.find((candidate) => candidate.username === item.username && candidate.record?.publicationId === item.publicationId);
      const result = await measure("consistencia_final_consulta_propia", async () => leerPropias(session.context, item.operatorId));
      if (!result.response?.ok()) {
        errors.push({ fase: "consistencia", usuario: item.username, estado: result.status });
        continue;
      }
      const body = await result.response.json();
      const publication = body.publicaciones?.find((entry) => entry.id === item.publicationId);
      if (!publication || Number(publication.precio) !== item.price) {
        errors.push({ fase: "consistencia", usuario: item.username, esperado: item.price, observado: publication?.precio ?? null });
      }
    }

    const report = {
      prueba: "BP-E03",
      destino: BASE_URL,
      inicio: started.toISOString(),
      fin: new Date().toISOString(),
      cuentasOperador: records.length,
      sesionesOperadorPorNivel: 30,
      nivelesCompradores: BUYER_LEVELS,
      compradoresUiPorNivel: BROWSER_BUYERS,
      dispositivosMismaCuenta: 10,
      cambiosDePrecioExitososMismaCuenta: successfulRaceWrites,
      consistenciaFinal: errors.some((item) => item.fase === "consistencia") ? "con diferencias" : "verificada",
      metricas: summarizeMetrics(),
      errores: errors,
      publicacionesDePrueba: records.map(({ username, publicationId, speciesName, price }) => ({ usuario: username, publicacionId: publicationId, especie: speciesName, precioFinal: price })),
    };
    console.log(JSON.stringify(report, null, 2));
    if (errors.length) process.exitCode = 1;
  } finally {
    await Promise.allSettled(operatorContexts.map((session) => session.context.close()));
    await anonymous.dispose();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
