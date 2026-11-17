import assert from "node:assert/strict";
import { expect } from "@playwright/test";
import { crearPendiente } from "./dependencias.mjs";
import { cambiarPrecioOperadorDesdePantalla } from "./operadores.mjs";
import { cambiarPrecioOperadorPorApi } from "./api.mjs";
import { paso } from "./diagnostico.mjs";

async function conLimite(promesa, timeout, mensaje) {
  let temporizador;
  try {
    return await Promise.race([promesa, new Promise((_, reject) => {
      temporizador = setTimeout(() => reject(new Error(mensaje)), timeout);
    })]);
  } finally { clearTimeout(temporizador); }
}

// Cambiar otra publicación dispara una actualización real sin alterar la versión
// del registro en edición. Se retiene su respuesta para observar el bloqueo.
export async function reproducirEdicionDuranteSincronizacion(sesion, registro, otraPublicacion) {
  assert.notEqual(registro.id, otraPublicacion.id);
  const capturada = crearPendiente("sincronizacion");
  const liberar = crearPendiente("liberacion");
  const finalizada = crearPendiente("intercepcion-finalizada");
  let retenida = false, instalada = false, bloqueo;
  const ruta = /\/mi-mercado(?:\/[^?]*)?(?:\?.*)?$/;
  const interceptar = async route => {
    const req = route.request();
    try {
      if (retenida || req.method() !== "POST" || !req.headers()["next-action"]) {
        await route.continue();
        return;
      }
      retenida = true;
      const respuesta = await route.fetch();
      capturada.resolve({ estado: respuesta.status(), ruta: new URL(req.url()).pathname });
      await liberar.promise;
      await route.fulfill({ response: respuesta });
      finalizada.resolve();
    } catch (error) {
      capturada.reject(error);
      finalizada.reject(error);
      await route.abort().catch(() => {});
    }
  };
  const nuevoPrecio = registro.precio + 37;
  let errorOriginal;
  try {
    await cambiarPrecioOperadorDesdePantalla(sesion, registro, nuevoPrecio, {
      antesDeCompletar: async ({ dialog, campo }) => {
        await paso(sesion, "reproduccion-editor-activo", async () => {
          await expect(dialog).toBeVisible({ timeout: sesion.timeout });
          await expect(campo).toBeEditable({ timeout: sesion.timeout });
          await campo.fill(String(nuevoPrecio));
        });
        await sesion.page.route(ruta, interceptar);
        instalada = true;
        await cambiarPrecioOperadorPorApi(sesion, otraPublicacion, otraPublicacion.precio + 19);
        const respuesta = await conLimite(capturada.promise, sesion.timeout, "No se recibió la sincronización durante la edición");
        assert.equal(respuesta.estado, 200);
        await paso(sesion, "reproduccion-editor-bloqueado-por-sincronizacion", async () => {
          await expect(dialog).toBeVisible({ timeout: sesion.timeout });
          await expect(campo).toBeDisabled({ timeout: sesion.timeout });
          await expect(campo).toHaveValue(String(nuevoPrecio), { timeout: sesion.timeout });
          bloqueo = { respuesta, editorActivo: true, campoDeshabilitado: true, borradorConservado: true };
        });
        liberar.resolve();
        await conLimite(finalizada.promise, sesion.timeout, "No terminó la respuesta retenida");
        await paso(sesion, "reproduccion-editor-recuperado", async () => {
          await expect(campo).toBeEditable({ timeout: sesion.timeout });
          await expect(campo).toHaveValue(String(nuevoPrecio), { timeout: sesion.timeout });
        });
      },
    });
  } catch (error) { errorOriginal = error; }
  finally {
    liberar.resolve();
    if (retenida) {
      try { await conLimite(finalizada.promise, sesion.timeout, "No terminó la interceptación"); }
      catch (error) { errorOriginal ??= error; }
    }
    if (instalada) {
      try { await sesion.page.unroute(ruta, interceptar); }
      catch (error) { errorOriginal ??= error; }
    }
  }
  if (errorOriginal) throw errorOriginal;
  return { ...bloqueo, precioGuardado: nuevoPrecio, edicionCompletada: true };
}
