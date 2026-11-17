import assert from "node:assert/strict";
import { extraerObjetosRsc } from "./datos-servidor.mjs";
import { paso } from "./diagnostico.mjs";
import { verificarPersistenciaOperadorPorApi } from "./operadores.mjs";
import { leerPublicacionProductorPorApi, verificarPersistenciaProductorPorApi } from "./productores.mjs";

export async function leerPublicacionOperadorPorApi(sesion, registro) {
  const respuesta = await sesion.context.request.get("/mi-mercado");
  assert.equal(respuesta.status(), 200, "Lectura autenticada de Mi Mercado del operador");
  assert.ok(new URL(respuesta.url()).pathname.startsWith("/mi-mercado/"));
  const modelos = extraerObjetosRsc(await respuesta.text());
  const propietarios = modelos.filter(p => p.operadorId === registro.operadorId && p.nombreOperador === sesion.nombre && Array.isArray(p.publicaciones));
  assert.equal(propietarios.length, 1, "Propietario único en los datos de Mi Mercado");
  const publicaciones = propietarios[0].publicaciones.filter(p => p.id === registro.id);
  assert.equal(publicaciones.length, 1, "Publicación propia única en Mi Mercado");
  const publicacion = publicaciones[0];
  assert.equal(publicacion.comentario, registro.etiqueta, "Marca de la ejecución");
  assert.equal(publicacion.especie.id, registro.especieId);
  assert.ok(Number.isSafeInteger(publicacion.version));
  return { id: publicacion.id, precio: Number(publicacion.precio), version: publicacion.version,
    cambios: {
      especieId: publicacion.especie.id, variedadId: publicacion.variedad?.id ?? null,
      envaseId: publicacion.envase?.id ?? null, kilosId: publicacion.kilos?.id ?? null,
      categoriaId: publicacion.categoria?.id ?? null, calibreId: publicacion.calibre?.id ?? null,
      paisId: publicacion.paisId ?? null, disponible: publicacion.publicacionDisponible,
      version: publicacion.version,
    } };
}

export async function cambiarPrecioOperadorPorApi(sesion, registro, precio) {
  const actual = await paso(sesion, "api-leer-version-operador", () => leerPublicacionOperadorPorApi(sesion, registro));
  const ruta = "/api/publicaciones/" + registro.id + "?operadorId=" + registro.operadorId;
  const cambios = { ...actual.cambios, precio: String(precio) };
  const respuesta = await paso(sesion, "api-guardar-operador", async () => {
    const r = await sesion.context.request.patch(ruta, { multipart: { cambios: JSON.stringify(cambios) } });
    const body = await r.json();
    sesion.diagnostico?.anotar("respuesta-api", { ruta, estado: r.status(), precio, version: actual.version, respuesta: body });
    assert.equal(r.status(), 200, "Guardado HTTP del operador");
    assert.equal(body.publicacionId, registro.id);
    return r;
  }, { ruta, precio, version: actual.version });
  const persistencia = await paso(sesion, "api-persistencia-operador", () => verificarPersistenciaOperadorPorApi(sesion, registro, precio));
  registro.precio = precio;
  registro.ultimoGuardadoConfirmado = { precio, instante: Date.now() };
  return { publicacionId: registro.id, precio, http: respuesta.status(), persistencia };
}

export async function cambiarPrecioProductorPorApi(sesion, registro, precio) {
  const actual = await paso(sesion, "api-leer-productor", () => leerPublicacionProductorPorApi(sesion, registro));
  const ruta = "/api/publicaciones/productor/" + actual.relacionId;
  const respuesta = await paso(sesion, "api-guardar-productor", async () => {
    const r = await sesion.context.request.patch(ruta, { multipart: { cambios: JSON.stringify({ ...actual.cambios, precio: String(precio) }) } });
    const body = await r.json();
    sesion.diagnostico?.anotar("respuesta-api", { ruta, estado: r.status(), precio, respuesta: body });
    assert.equal(r.status(), 200, "Guardado HTTP del productor");
    assert.equal(body.publicacion?.id, registro.id);
    return r;
  }, { ruta, precio });
  const persistencia = await paso(sesion, "api-persistencia-productor", () => verificarPersistenciaProductorPorApi(sesion, registro, precio));
  registro.precio = precio;
  registro.ultimoGuardadoConfirmado = { precio, instante: Date.now() };
  return { publicacionId: registro.id, precio, http: respuesta.status(), persistencia };
}
