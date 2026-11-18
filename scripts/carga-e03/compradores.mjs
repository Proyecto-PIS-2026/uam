import assert from "node:assert/strict";
import { expect } from "@playwright/test";

function resultadoDe(texto) {
  for (const linea of texto.split("\n")) {
    const contenido = linea.slice(linea.indexOf(":") + 1);
    if (!contenido.startsWith("{")) continue;
    try {
      const valor = JSON.parse(contenido);
      if (Array.isArray(valor.publicaciones)) return valor;
    } catch { /* Otras líneas pertenecen al protocolo de componentes de servidor. */ }
  }
  throw new Error("La consulta de mercado no devolvió un listado reconocible.");
}

function nombrePropietario(valor) {
  const nombre = typeof valor === "string" ? valor : valor?.propietario ?? valor?.nombre;
  assert.ok(typeof nombre === "string" && nombre.trim(), "Falta el nombre comercial exacto del propietario.");
  return nombre.trim();
}

function validarRegistro(registro) {
  assert.ok(Number.isSafeInteger(registro?.id) && registro.id > 0, "Falta el ID de la publicación.");
  assert.ok(typeof registro.especie === "string" && registro.especie.trim(), "Falta la especie de la publicación.");
  return { ...registro, propietario: nombrePropietario(registro) };
}

function valorPrecio(precio) {
  if (precio === null) return null;
  assert.ok(precio !== undefined && precio !== "", "Falta el precio esperado.");
  const valor = Number(precio);
  assert.ok(Number.isFinite(valor) && valor >= 0, "El precio esperado no es válido.");
  return valor;
}

function expresionPrecio(precio) {
  if (precio === null) return /^\s*Consultar precio\s*$/;
  return new RegExp("^\\s*\\$\\s*" + String(precio).replace(".", "[.,]") + "\\s*$");
}

function especieFiltro(valor) {
  return !valor || valor === "Todas" ? "Todas" : valor;
}

/**
 * Observa una página existente sin crear otra sesión ni cerrarla.
 * Registro: { id, especie, precio, nombre }, con nombre comercial exacto.
 * Admite propietario como alias de nombre y operadorId/productorId opcionales.
 * La fixture debe tener una sola oferta por propietario y especie.
 */
export function crearObservadorMercado({ page, context = page.context(), baseURL, timeout = 45_000, tipo = "OPERADOR" }) {
  assert.ok(["OPERADOR", "PRODUCTOR"].includes(tipo), "El tipo de mercado no es válido.");
  const ruta = tipo === "PRODUCTOR" ? "/publicaciones-productor" : "/publicaciones";
  const rutaPerfiles = tipo === "PRODUCTOR" ? "productores" : "operadores";
  const campoPropietario = tipo === "PRODUCTOR" ? "productor" : "operador";
  page.setDefaultTimeout(timeout);
  page.setDefaultNavigationTimeout(timeout);

  const numeros = new WeakMap();
  const lecturas = new Set();
  let numeroSolicitud = 0;
  let observacion = null;
  let filtrosEsperados = null;
  let ultimaVerificacion = null;
  let altaPreparada = null;
  let cerrado = false;

  function filtrosDe(solicitud) {
    if (solicitud.method() !== "POST" || new URL(solicitud.url()).pathname !== ruta
      || !solicitud.headers()["next-action"]) return null;
    if (tipo === "PRODUCTOR") return {};
    try {
      const filtros = JSON.parse(solicitud.postData())[0];
      return filtros && typeof filtros === "object" ? filtros : null;
    } catch { return null; }
  }

  const registrarSolicitud = solicitud => {
    if (filtrosDe(solicitud)) numeros.set(solicitud, ++numeroSolicitud);
  };
  const registrarRespuesta = respuesta => {
    const solicitud = respuesta.request();
    const filtros = filtrosDe(solicitud);
    const numero = numeros.get(solicitud);
    if (!filtros || numero === undefined) return;
    const lectura = (async () => {
      try {
        if (!respuesta.ok()) return;
        const resultado = resultadoDe(await respuesta.text());
        if (!cerrado && (!observacion || numero > observacion.numero)) {
          // Solo se conserva el último resultado para limitar memoria.
          observacion = { numero, filtros, publicaciones: resultado.publicaciones };
        }
      } catch { /* Si la consulta falla, la verificación vence sin forzar otra petición. */ }
    })();
    lecturas.add(lectura);
    void lectura.finally(() => lecturas.delete(lectura));
  };
  page.on("request", registrarSolicitud);
  page.on("response", registrarRespuesta);

  const drawer = () => page.getByRole("dialog", { name: "Detalle de publicación", exact: true });
  const panel = () => page.locator(".secciones-pagina[aria-busy]");

  function consultaVigente() {
    if (!observacion || !filtrosEsperados) return null;
    if (tipo === "PRODUCTOR") return observacion;
    return observacion.filtros.busqueda === filtrosEsperados.propietario
      && especieFiltro(observacion.filtros.especie) === filtrosEsperados.especie
      ? observacion : null;
  }

  async function esperarConsulta() {
    await expect.poll(() => Boolean(consultaVigente()), {
      timeout, message: "No llegó una consulta de mercado desde la página observada.",
    }).toBe(true);
    await expect(panel()).toHaveAttribute("aria-busy", "false", { timeout });
    return consultaVigente();
  }

  async function cerrarDetalle() {
    if (await drawer().isVisible()) {
      await drawer().getByRole("button", { name: "Detalle de consulta", exact: true }).click();
      await expect(drawer()).toBeHidden({ timeout });
    }
  }

  async function prepararFiltros(propietario, especie) {
    if (new URL(page.url()).pathname !== ruta || !observacion) {
      const destino = new URL(ruta, baseURL ?? page.url()).href;
      const respuesta = await page.goto(destino, { waitUntil: "domcontentloaded" });
      assert.equal(respuesta?.status(), 200, "No abrió el mercado requerido.");
    }
    await cerrarDetalle();
    const buscador = page.getByRole("searchbox", { name: "Buscar publicaciones", exact: true });
    await expect(buscador).toBeVisible({ timeout });
    await buscador.fill(propietario);
    const selector = page.getByRole("combobox", { name: "Especie", exact: true });
    if ((await selector.innerText()).trim() !== especie) {
      await selector.click();
      await page.getByRole("option", { name: especie, exact: true }).click();
    }
    await expect(buscador).toHaveValue(propietario, { timeout });
    await expect(selector).toHaveText(especie, { timeout });
    filtrosEsperados = { propietario, especie };
    return esperarConsulta();
  }

  function coincidencias(consulta, registro) {
    return consulta.publicaciones.filter(publicacion => publicacion.especie === registro.especie
      && publicacion[campoPropietario]?.nombreFantasia === registro.propietario);
  }

  function validarIdentidad(consulta, registro) {
    const candidatas = coincidencias(consulta, registro);
    assert.equal(candidatas.length, 1,
      "La fixture debe identificar una sola oferta de " + registro.propietario + " y " + registro.especie
      + "; encontradas " + candidatas.length + ".");
    const publicacion = candidatas[0];
    assert.equal(publicacion.id, registro.id, "La oferta visible no corresponde al ID esperado.");
    const propietarioId = registro[tipo === "PRODUCTOR" ? "productorId" : "operadorId"];
    if (propietarioId !== undefined) {
      assert.equal(publicacion[campoPropietario].id, propietarioId, "La oferta pertenece a otro usuario.");
    }
    return publicacion;
  }

  function tarjetaDe(registro, publicacion) {
    const producto = publicacion.variedad && publicacion.variedad !== "-"
      ? registro.especie + " - " + publicacion.variedad : registro.especie;
    return page.getByRole("button", { name: "Ver detalles de " + producto, exact: true })
      .filter({ has: page.getByTitle(registro.propietario, { exact: true }) });
  }

  async function encontrarTarjeta(registro, publicacion) {
    const tarjeta = tarjetaDe(registro, publicacion);
    const paginacion = page.getByRole("navigation", { name: "Paginación de publicaciones", exact: true });
    // Es un límite superior. El filtro local de productores puede mostrar menos filas.
    const totalPaginas = Math.max(1, Math.ceil((consultaVigente()?.publicaciones.length ?? 0) / 20));
    if (await paginacion.isVisible()) {
      await paginacion.getByRole("button", { name: "Página 1", exact: true }).click();
    }
    for (let pagina = 1; pagina <= totalPaginas; pagina++) {
      if (await tarjeta.count()) {
        await expect(tarjeta).toHaveCount(1, { timeout });
        await expect(tarjeta).toBeVisible({ timeout });
        return tarjeta;
      }
      const siguiente = paginacion.getByRole("button", { name: "Siguiente", exact: true });
      if (!await siguiente.isVisible() || !await siguiente.isEnabled()) break;
      await siguiente.click();
      await expect(paginacion.getByRole("button", { name: "Página " + (pagina + 1), exact: true }))
        .toHaveAttribute("aria-current", "page", { timeout });
    }
    await expect(tarjeta, "No apareció la tarjeta exacta de publicación " + registro.id + ".").toBeVisible({ timeout });
    return tarjeta;
  }

  async function comprobarPrecioVisible(contenedor, precio) {
    const texto = contenedor.getByText(expresionPrecio(precio), { exact: true });
    await expect(texto).toHaveCount(1, { timeout });
    await expect(texto).toBeVisible({ timeout });
    const visible = (await texto.innerText()).trim();
    assert.match(visible, expresionPrecio(precio), "El texto visible del precio no coincide con el esperado.");
    const real = visible === "Consultar precio" ? null : Number(visible.replace(/^\$\s*/, "").replace(",", "."));
    assert.equal(real, precio, "El precio visible no coincide con el esperado.");
    return real;
  }

  async function comprobarDrawer(registro, precio) {
    await expect(drawer()).toBeVisible({ timeout });
    const propietario = drawer().getByRole("link", { name: registro.propietario, exact: true });
    await expect(propietario).toHaveCount(1, { timeout });
    await expect(propietario).toHaveAttribute("href", "/" + rutaPerfiles + "/"
      + encodeURIComponent(registro.propietario) + "?origen=publicaciones", { timeout });
    await expect(drawer().getByText(registro.especie, { exact: true })).toBeVisible({ timeout });
    return comprobarPrecioVisible(drawer(), precio);
  }

  async function comprobarTarjetaYDetalle(registro, publicacion, precio) {
    await cerrarDetalle();
    const tarjeta = await encontrarTarjeta(registro, publicacion);
    const precioTarjeta = await comprobarPrecioVisible(tarjeta, precio);
    await tarjeta.click();
    const precioDrawer = await comprobarDrawer(registro, precio);
    return { precio: precioTarjeta, precioTarjeta, precioDrawer };
  }

  async function esperarRegistro(registro, precio, posteriorA) {
    await expect.poll(() => {
      const consulta = consultaVigente();
      if (!consulta || consulta.numero <= posteriorA) return null;
      const candidatas = coincidencias(consulta, registro);
      if (candidatas.length !== 1) return null;
      const publicacion = candidatas[0];
      return { id: publicacion.id, precio: valorPrecio(publicacion.precio) };
    }, {
      timeout, message: "La publicación " + registro.id + " no se actualizó automáticamente en el mercado.",
    }).toEqual({ id: registro.id, precio });
    await expect(panel()).toHaveAttribute("aria-busy", "false", { timeout });
    const consulta = consultaVigente();
    return { consulta, publicacion: validarIdentidad(consulta, registro) };
  }

  return {
    context,
    page,
    async preparar(entrada) {
      const registro = validarRegistro(entrada);
      const precio = valorPrecio(registro.precio);
      const consulta = await prepararFiltros(registro.propietario, registro.especie);
      const publicacion = validarIdentidad(consulta, registro);
      assert.equal(valorPrecio(publicacion.precio), precio, "El precio inicial no coincide.");
      const visibles = await comprobarTarjetaYDetalle(registro, publicacion, precio);
      ultimaVerificacion = { id: registro.id, precio: visibles.precio, numero: consulta.numero };
      altaPreparada = null;
      return { publicacionId: registro.id, propietario: registro.propietario, ...visibles };
    },
    async verificar(entrada, precioEsperado) {
      const registro = validarRegistro(entrada);
      const precio = valorPrecio(precioEsperado);
      assert.equal(ultimaVerificacion?.id, registro.id, "Prepará la publicación antes de modificar su precio.");
      assert.notEqual(ultimaVerificacion.precio, precio, "El precio debe cambiar para comprobar la actualización.");
      // Primero comprueba el drawer que ya estaba abierto, sin clics ni recargas.
      const { consulta, publicacion } = await esperarRegistro(registro, precio, ultimaVerificacion.numero);
      const precioDrawerEnVivo = await comprobarDrawer(registro, precio);
      const visibles = await comprobarTarjetaYDetalle(registro, publicacion, precio);
      const previo = ultimaVerificacion.precio;
      ultimaVerificacion = { id: registro.id, precio: visibles.precio, numero: consulta.numero };
      return { publicacionId: registro.id, propietario: registro.propietario, previo,
        ...visibles, precioDrawerEnVivo, sinRecargar: true };
    },
    async prepararAlta(propietario) {
      const nombre = nombrePropietario(propietario);
      const consulta = await prepararFiltros(nombre, "Todas");
      altaPreparada = { propietario: nombre, numero: consulta.numero,
        ids: new Set(consulta.publicaciones.map(publicacion => publicacion.id)) };
      ultimaVerificacion = null;
      return { propietario: nombre, publicacionesIniciales: [...altaPreparada.ids] };
    },
    async verificarAlta(entrada, precioEsperado = entrada.precio) {
      const registro = validarRegistro(entrada);
      const precio = valorPrecio(precioEsperado);
      assert.equal(altaPreparada?.propietario, registro.propietario, "Prepará el listado antes de crear la oferta.");
      assert.ok(!altaPreparada.ids.has(registro.id), "La publicación ya existía antes de observar el alta.");
      const { consulta, publicacion } = await esperarRegistro(registro, precio, altaPreparada.numero);
      const visibles = await comprobarTarjetaYDetalle(registro, publicacion, precio);
      ultimaVerificacion = { id: registro.id, precio: visibles.precio, numero: consulta.numero };
      altaPreparada = null;
      return { publicacionId: registro.id, propietario: registro.propietario,
        ...visibles, altaVisibleSinRecargar: true };
    },
    async cerrar() {
      cerrado = true;
      page.off("request", registrarSolicitud);
      page.off("response", registrarRespuesta);
      await Promise.allSettled([...lecturas]);
    },
  };
}

export async function crearComprador(browser, baseURL, timeout = 45_000) {
  const context = await browser.newContext({ baseURL, viewport: { width: 1366, height: 900 } });
  try {
    const page = await context.newPage();
    const observador = crearObservadorMercado({ page, context, baseURL, timeout, tipo: "OPERADOR" });
    return {
      ...observador,
      async cerrar() {
        await context.close();
        await observador.cerrar();
      },
    };
  } catch (error) {
    await context.close();
    throw error;
  }
}
