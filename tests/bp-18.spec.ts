import { expect, type Page } from "@playwright/test";
import { test } from "./usuarios-administrativos";
import {
  iniciarSesionAdministrador,
  iniciarSesionOperador,
  iniciarSesionProductor,
} from "./autenticacion";

const rutaIncremento = "/api/configuracion/incremento_precio";
const confirmacionGuardado = "La configuración se guardó correctamente.";

async function seleccionarRol(page: Page, rol: string) {
  await page.getByRole("combobox", { name: "Rol", exact: true }).click();
  await page.getByRole("option", { name: rol, exact: true }).click();
}

test("BP-18.6 y BP-18.9: panel, listado de usuarios y navegación administrativa", async ({ page, browser, usuariosAdministrativos }) => {
  test.slow();
  await iniciarSesionAdministrador(page, usuariosAdministrativos.administrador);

  const secciones = page.getByRole("group", { name: "Secciones de configuración" });
  await expect(secciones.getByRole("button")).toHaveCount(3);
  for (const nombre of ["Publicaciones", "Usuarios", "Público"]) {
    await expect(secciones.getByRole("button", { name: nombre, exact: true })).toBeVisible();
  }

  await expect(page.getByText("Importe de ajuste rápido de precios", { exact: true })).toBeVisible();
  await secciones.getByRole("button", { name: "Público", exact: true }).click();
  await expect(page).toHaveURL(/\/administracion#publico$/);
  await expect(page.getByText("Lista Inteligente", { exact: true })).toBeVisible();
  await secciones.getByRole("button", { name: "Usuarios", exact: true }).click();
  await expect(page).toHaveURL(/\/administracion#usuarios$/);
  await expect(page.getByRole("heading", { name: "Gestión de Usuarios" })).toBeVisible();

  const filas = page.getByRole("button").filter({
    has: page.getByText(/^(Administrador|Operador|Productor)$/, { exact: true }),
  });
  const busqueda = page.getByRole("searchbox", { name: "Buscar usuarios" });
  for (const rol of ["Administrador", "Operador", "Productor"]) {
    await seleccionarRol(page, rol);
    await expect(filas.first()).toBeVisible();
    await expect(filas.locator("span").filter({ hasText: new RegExp(`^${rol}$`) }))
      .toHaveCount(await filas.count());
    for (const otroRol of ["Administrador", "Operador", "Productor"].filter((otro) => otro !== rol)) {
      await expect(filas.getByText(otroRol, { exact: true })).toHaveCount(0);
    }
  }

  await seleccionarRol(page, "Administrador");
  await expect(filas.getByText(usuariosAdministrativos.administrador.usuario, { exact: true })).toBeVisible();
  await seleccionarRol(page, "Operador");
  const username = (await filas.first().locator("span").first().innerText()).trim();
  const nombreOperador = (await filas.first().locator("span").nth(1).innerText()).trim();
  expect(username).not.toBe("");
  expect(nombreOperador).not.toBe("");

  await busqueda.fill(username);
  const filaOperador = filas.filter({ has: page.getByText(username, { exact: true }) });
  await expect(filaOperador).toHaveCount(1);
  await expect(filaOperador.getByText("Operador", { exact: true })).toBeVisible();
  await expect(filaOperador.getByText(nombreOperador, { exact: true })).toBeVisible();

  // La misma búsqueda no debe traer al operador cuando el rol es Productor.
  await seleccionarRol(page, "Productor");
  await expect(busqueda).toHaveValue("");
  await busqueda.fill(username);
  await expect(filas).toHaveCount(0);
  await expect(page.getByText("No se encontraron usuarios.", { exact: true })).toBeVisible();
  await seleccionarRol(page, "Operador");
  await busqueda.fill(username);

  await filaOperador.click();
  await expect(page).toHaveURL(/\/gestion-operadores\/\d+$/, { timeout: 30_000 });
  const rutaPerfil = new URL(page.url()).pathname;
  await expect(page.getByRole("heading", { name: nombreOperador, exact: true, level: 1 })).toBeVisible();
  await page.getByRole("link", { name: /Volver al listado de operadores/ }).click();
  await expect(page.getByRole("heading", { name: "Panel Administrativo", exact: true })).toBeVisible();

  await secciones.getByRole("button", { name: "Usuarios", exact: true }).click();
  await seleccionarRol(page, "Operador");
  await busqueda.fill(username);
  await filaOperador.getByTitle("Editar perfil", { exact: true }).click();
  await expect(page).toHaveURL(`${rutaPerfil}/editar`, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Modificar operador", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Volver al perfil/ }).click();
  await expect(page).toHaveURL(rutaPerfil);
  await page.getByRole("link", { name: /Volver al listado de operadores/ }).click();
  await expect(page).toHaveURL(/\/administracion#usuarios$/);

  // Una URL directa también debe respetar los permisos, con sesiones independientes.
  for (const perfil of [
    { nombre: "visitante", iniciarSesion: undefined, destino: /^\/iniciar-sesion$/ },
    { nombre: "operador", iniciarSesion: iniciarSesionOperador, destino: /^\/mi-mercado(?:\/|$)/ },
    { nombre: "productor", iniciarSesion: (pagina: Page) => iniciarSesionProductor(pagina, usuariosAdministrativos.productor), destino: /^\/mi-mercado\/productor$/ },
  ]) {
    await test.step(`BP-18.9: rechazar el acceso administrativo del ${perfil.nombre}`, async () => {
      const pagina = await browser.newPage();
      try {
        if (perfil.iniciarSesion) await perfil.iniciarSesion(pagina);
        for (const ruta of ["/administracion", rutaPerfil, `${rutaPerfil}/editar`]) {
          await pagina.goto(ruta);
          await expect(pagina).toHaveURL((url) => perfil.destino.test(url.pathname));
          await expect(pagina.getByRole("link", { name: "Administración", exact: true })).toHaveCount(0);
          await expect(pagina.getByRole("heading", { name: "Panel Administrativo" })).toHaveCount(0);
        }
      } finally {
        await pagina.close();
      }
    });
  }
});

test("BP-18.2: el importe guardado se aplica al ajuste rápido del operador", async ({ page, browser, usuariosAdministrativos }) => {
  test.slow();
  await iniciarSesionAdministrador(page, usuariosAdministrativos.administrador);
  const campoImporte = page.getByRole("textbox");
  const importeOriginal = await campoImporte.inputValue();
  expect(importeOriginal).toMatch(/^[1-9]\d*$/);
  const nuevoImporte = importeOriginal === "25" ? "37" : "25";
  const operador = await browser.newPage();
  let precioOriginal: number | undefined;
  let indicePrecio = -1;
  let precioModificado = false;

  try {
    await iniciarSesionOperador(operador);
    const precios = operador.getByTitle("Editar precio", { exact: true });
    await expect(precios.first()).toBeVisible();
    const preciosOriginales = await precios.allTextContents();
    indicePrecio = preciosOriginales.findIndex((texto) => /^\$[1-9]\d*$/.test(texto.trim()));
    expect(indicePrecio).toBeGreaterThanOrEqual(0);
    const precio = precios.nth(indicePrecio);
    const controles = precio.locator("..");
    precioOriginal = Number((await precio.innerText()).replace("$", ""));
    expect(Number.isSafeInteger(precioOriginal)).toBe(true);
    expect(precioOriginal).toBeGreaterThan(0);
    expect(precioOriginal + Number(nuevoImporte)).toBeLessThanOrEqual(9999999999);

    // Abandonar un cambio sin guardar conserva el importe vigente.
    await campoImporte.fill(nuevoImporte);
    await page.reload();
    await expect(campoImporte).toHaveValue(importeOriginal);

    // Un rechazo del servidor no debe reemplazar el importe guardado.
    await campoImporte.fill("0");
    const rechazo = page.waitForResponse((respuesta) =>
      new URL(respuesta.url()).pathname === rutaIncremento && respuesta.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
    expect((await rechazo).status()).toBe(400);
    await expect(page.getByRole("alert").filter({ hasText: "mayor a cero" })).toBeVisible();
    await page.reload();
    await expect(campoImporte).toHaveValue(importeOriginal);

    await campoImporte.fill(nuevoImporte);
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: confirmacionGuardado })).toBeVisible();
    await page.reload();
    await expect(campoImporte).toHaveValue(nuevoImporte);

    // Guardar la configuración no cambia los precios ya publicados.
    await operador.reload();
    await expect(precios).toHaveText(preciosOriginales);

    precioModificado = true;
    await controles.getByRole("button", { name: "Aumentar precio", exact: true }).click();
    await expect(precio).toHaveText(`$${precioOriginal + Number(nuevoImporte)}`);
    await expect(controles.getByRole("button", { name: "Disminuir precio", exact: true })).toBeEnabled();
    await expect(precio).toBeEnabled();
    await operador.reload();
    await expect(precio).toHaveText(`$${precioOriginal + Number(nuevoImporte)}`);

    await controles.getByRole("button", { name: "Disminuir precio", exact: true }).click();
    await expect(precio).toHaveText(`$${precioOriginal}`);
    await expect(controles.getByRole("button", { name: "Aumentar precio", exact: true })).toBeEnabled();
    await expect(precio).toBeEnabled();
    await operador.reload();
    await expect(precios).toHaveText(preciosOriginales);
  } finally {
    try {
      if (precioModificado && precioOriginal !== undefined) {
        await test.step("Restaurar el precio aunque falle una comprobación", async () => {
          await operador.goto("/mi-mercado");
          const precio = operador.getByTitle("Editar precio", { exact: true }).nth(indicePrecio);
          await expect(precio).toBeEnabled();
          if ((await precio.innerText()).trim() !== `$${precioOriginal}`) {
            await precio.click();
            const entrada = operador.getByRole("textbox", { name: "Editar precio", exact: true });
            await entrada.fill(String(precioOriginal));
            await entrada.press("Enter");
            await expect(precio).toHaveText(`$${precioOriginal}`);
            await expect(precio).toBeEnabled();
          }
        });
      }
    } finally {
      try {
        await test.step("Restaurar el importe global", async () => {
          const respuesta = await page.request.patch(rutaIncremento, { data: { valor: importeOriginal } });
          expect(respuesta.ok()).toBe(true);
          const lectura = await page.request.get(rutaIncremento);
          expect(lectura.ok()).toBe(true);
          expect(await lectura.json()).toMatchObject({ valor: importeOriginal });
        });
      } finally {
        await operador.close();
      }
    }
  }
});
