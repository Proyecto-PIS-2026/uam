import assert from "node:assert/strict";
import { expect } from "@playwright/test";

export async function iniciarSesion(browser, baseURL, usuario, password, timeout = 45_000) {
  const context = await browser.newContext({ baseURL, viewport: { width: 1366, height: 900 } });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(timeout);
    await page.goto("/iniciar-sesion", { waitUntil: "domcontentloaded" });
    await page.getByLabel("Correo electrónico o nombre de usuario").fill(usuario);
    await page.getByLabel("Contraseña", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
    await page.waitForURL(/\/mi-mercado(?:\/|$)/, { waitUntil: "domcontentloaded", timeout });
    await expect(page.getByRole("heading", { name: "Mi Mercado", exact: true })).toBeVisible({ timeout });
    return { context, page, usuario, baseURL, timeout, storageState: await context.storageState() };
  } catch (error) {
    await context.close();
    throw error;
  }
}

export async function obtenerEspeciesLibres(sesion, rol) {
  const { page, timeout } = sesion;
  await page.goto(rol === "PRODUCTOR" ? "/mi-mercado/productor" : "/mi-mercado", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Mi Mercado", exact: true })).toBeVisible({ timeout });
  const usadas = new Set(await page.getByRole("button", { name: /^Ver detalle de / }).evaluateAll(botones =>
    botones.map(boton => boton.getAttribute("aria-label").replace(/^Ver detalle de /, "")),
  ));
  await page.getByRole("button", { name: "Nueva publicación", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: rol === "PRODUCTOR" ? "Nueva publicación de Productor" : "Nueva publicación", exact: true });
  await dialog.getByRole("combobox", { name: /^Especie(?:\s*\*)?$/ }).click();
  const opciones = page.getByRole("option", { disabled: false });
  await opciones.first().waitFor();
  const disponibles = (await opciones.allTextContents()).map(texto => texto.trim()).filter(Boolean);
  await page.keyboard.press("Escape");
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  return disponibles.filter(nombre => ![...usadas].some(usada => usada === nombre || usada.startsWith(nombre + " · ")));
}

async function irAMercado(sesion) {
  await sesion.page.goto("/mi-mercado", { waitUntil: "domcontentloaded" });
  await expect(sesion.page.getByRole("heading", { name: "Mi Mercado", exact: true })).toBeVisible({ timeout: sesion.timeout });
}

async function abrirPropia(sesion, registro) {
  await irAMercado(sesion);
  await sesion.page.getByRole("button", { name: "Ver detalle de " + registro.especie, exact: true }).first().click();
  const consulta = sesion.page.getByRole("dialog", { name: "Consulta de publicación", exact: true });
  await consulta.waitFor();
  await expect(consulta.getByRole("textbox", { name: "Comentario", exact: true })).toHaveValue(registro.etiqueta, { timeout: sesion.timeout });
  return consulta;
}

export async function crearPublicacionOperadorDesdePantalla(sesion, especie, precio, etiqueta, creadas) {
  await irAMercado(sesion);
  const { page } = sesion;
  await page.getByRole("button", { name: "Nueva publicación", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Nueva publicación", exact: true });
  await dialog.getByRole("combobox", { name: /^Especie(?:\s*\*)?$/ }).click();
  await page.getByRole("option", { name: especie, exact: true }).click();
  await dialog.getByRole("textbox", { name: "Precio en pesos", exact: true }).fill(String(precio));
  await dialog.getByRole("textbox", { name: "Comentario", exact: true }).fill(etiqueta);
  const pendiente = page.waitForResponse(r => r.request().method() === "POST" && new URL(r.url()).pathname === "/api/publicaciones");
  await dialog.getByRole("button", { name: "Confirmar", exact: true }).click();
  const respuesta = await pendiente;
  const body = await respuesta.json();
  assert.equal(respuesta.status(), 201, "Alta UI operador: " + JSON.stringify(body.errores));
  assert.ok(Number.isSafeInteger(body.id));
  const enviados = respuesta.request().postDataJSON();
  const registro = { id: body.id, operadorId: enviados.operadorId, especieId: enviados.especieId, especie, precio, etiqueta, nombre: sesion.nombre, propietario: sesion.nombre, usuario: sesion.usuario, rol: "OPERADOR" };
  creadas.push(registro);
  await dialog.waitFor({ state: "hidden" });
  await verificarPropiaOperadorDesdePantalla(sesion, registro);
  return registro;
}

export async function cambiarPrecioOperadorDesdePantalla(sesion, registro, precio) {
  const consulta = await abrirPropia(sesion, registro);
  await consulta.getByRole("button", { name: "Editar", exact: true }).click();
  const dialog = sesion.page.getByRole("dialog", { name: "Editar publicación", exact: true });
  await dialog.getByRole("textbox", { name: "Precio en pesos", exact: true }).fill(String(precio));
  const pendiente = sesion.page.waitForResponse(r => r.request().method() === "PATCH" && new URL(r.url()).pathname === "/api/publicaciones/" + registro.id);
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
  const respuesta = await pendiente;
  const body = await respuesta.json();
  assert.equal(respuesta.status(), 200, "Edición UI operador: " + JSON.stringify(body.errores));
  assert.equal(body.publicacionId, registro.id);
  registro.precio = precio;
  await expect(sesion.page.getByRole("dialog", { name: "Consulta de publicación", exact: true }).getByRole("textbox", { name: "Precio en pesos", exact: true })).toHaveValue(String(precio), { timeout: sesion.timeout });
  return { publicacionId: registro.id, precio, http: respuesta.status() };
}

export async function verificarPropiaOperadorDesdePantalla(sesion, registro) {
  const consulta = await abrirPropia(sesion, registro);
  await expect(consulta.getByRole("textbox", { name: "Precio en pesos", exact: true })).toHaveValue(String(registro.precio), { timeout: sesion.timeout });
  return { publicacionId: registro.id, precio: Number(await consulta.getByRole("textbox", { name: "Precio en pesos", exact: true }).inputValue()) };
}
