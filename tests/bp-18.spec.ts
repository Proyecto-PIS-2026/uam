import { expect, type Locator, type Page } from "@playwright/test";
import { test as testBase } from "./usuarios-administrativos";
import { iniciarSesionAdministrador, iniciarSesionOperador, iniciarSesionProductor } from "./autenticacion";

type RegistrarLimpieza = (accion: () => Promise<void>) => void;

async function ejecutarCambioPrecio(page: Page, tarjeta: Locator, accion: () => Promise<void>) {
    const [respuesta] = await Promise.all([
        page.waitForResponse((respuesta) =>
            respuesta.request().method() === "POST" &&
            respuesta.request().headers()["next-action"] !== undefined,
            { timeout: 30_000 }
        ),
        accion(),
    ]);

    expect(respuesta.ok(), "La acción de cambio de precio debe responder correctamente").toBe(true);
    await expect(botonPrecio(tarjeta)).toBeEnabled({ timeout: 30_000 });
}

const test = testBase.extend<{ registrarLimpieza: RegistrarLimpieza }>({
    registrarLimpieza: [async ({ page }, usar) => {
        const acciones: Array<() => Promise<void>> = [];

        try {
            await usar((accion) => acciones.push(accion));
        } finally {
            const errores: unknown[] = [];

            for (const accion of acciones.reverse()) {
                try {
                    await accion();
                } catch (error) {
                    errores.push(error);
                }
            }

            if (errores.length > 0) {
                throw new AggregateError(errores, `Falló la restauración de datos. Página: ${page.url()}`);
            }
        }
    }, { timeout: 60_000 }],
});

const tituloImporte = "Importe de ajuste rápido de precios";
const confirmacionGuardado = "El importe de ajuste rápido de precios se guardó correctamente.";

const secciones = (page: Page) => page.getByRole("group", { name: "Secciones de configuración" });
const filasUsuarios = (page: Page) => page.getByRole("button").filter({ has: page.getByText(/^(Administrador|Operador|Productor)$/, { exact: true }) });
const tarjetaImporte = (page: Page) => page.getByText(tituloImporte, { exact: true }).locator("..");
const campoImporte = (page: Page) => tarjetaImporte(page).getByRole("textbox", { name: tituloImporte, exact: true });
const guardarImporte = (page: Page) => tarjetaImporte(page).getByRole("button", { name: "Guardar cambios", exact: true });

async function seleccionarRol(page: Page, rol: string) {
    await page.getByRole("combobox", { name: "Rol", exact: true }).click();
    await page.getByRole("option", { name: rol, exact: true }).click();
}

async function abrirGeneral(page: Page) {
    await secciones(page).getByRole("button", { name: "General", exact: true }).click();
    await expect(page).toHaveURL(/\/administracion#general$/);
    await expect(campoImporte(page)).toBeVisible();
}

async function abrirUsuarios(page: Page) {
    await secciones(page).getByRole("button", { name: "Usuarios", exact: true }).click();
    await expect(page).toHaveURL(/\/administracion#usuarios$/);
    await expect(page.getByRole("heading", { name: "Gestión de Usuarios" })).toBeVisible();
}

async function restaurarImporte(page: Page, original: string) {
    const ruta = "/api/configuracion/incremento_precio";
    const respuesta = await page.request.patch(ruta, { data: { valor: original }, timeout: 15_000 });
    expect(respuesta.ok(), "Debe restaurarse el importe original").toBe(true);

    const lectura = await page.request.get(ruta, { timeout: 15_000 });
    expect(lectura.ok()).toBe(true);
    expect(await lectura.json()).toMatchObject({ valor: original });
}

function tarjetaProducto(page: Page, nombre: string) {
    return page.getByTitle(nombre, { exact: true }).locator('xpath=ancestor::div[./button[starts-with(@aria-label, "Ver detalle de ")]][1]');
}

function botonPrecio(tarjeta: Locator) {
    return tarjeta.getByRole("button").and(tarjeta.getByTitle("Editar precio", { exact: true }));
}

async function buscarProductoConPrecio(page: Page) {
    const precios = page.getByRole("button").and(page.getByTitle("Editar precio", { exact: true }));
    await expect(precios.first()).toBeVisible();

    for (let indice = 0; indice < await precios.count(); indice++) {
        const precio = precios.nth(indice);
        const texto = (await precio.innerText()).trim();
        if (!/^\$[1-9]\d*$/.test(texto)) continue;

        const tarjeta = precio.locator('xpath=ancestor::div[./button[starts-with(@aria-label, "Ver detalle de ")] and .//div[@title]][1]');
        const nombreProducto = tarjeta.locator("div[title]");
        await expect(nombreProducto).toHaveCount(1);

        const nombre = await nombreProducto.getAttribute("title");
        if (!nombre || await page.getByTitle(nombre, { exact: true }).count() !== 1) continue;

        const valor = Number(texto.slice(1));
        if (!Number.isSafeInteger(valor) || valor + 37 > 9999999999) continue;

        return { nombre, precio: valor };
    }

    throw new Error("Se necesita una publicación con precio positivo y nombre único para probar el ajuste rápido.");
}

async function leerPrecios(page: Page) {
    const precios = page.getByRole("button").and(page.getByTitle("Editar precio", { exact: true }));
    return (await precios.allTextContents()).map((texto) => texto.trim()).sort();
}

test("BP-18.6: muestra los paneles en el orden configurado y abre General", async ({ page, usuariosAdministrativos }) => {
    test.slow();
    await iniciarSesionAdministrador(page, usuariosAdministrativos.administrador);

    await expect(secciones(page).getByRole("button")).toHaveText(["Estadísticas", "Usuarios", "General"]);
    await expect(secciones(page).getByRole("button", { name: "Estadísticas", exact: true })).toHaveAttribute("aria-pressed", "true");

    await abrirGeneral(page);
    await expect(page.getByText("Lista Inteligente", { exact: true })).toBeVisible();

    await abrirUsuarios(page);
});

test("BP-18.6: filtra usuarios por rol y combina el rol con la búsqueda", async ({ page, usuariosAdministrativos }) => {
    test.slow();
    await iniciarSesionAdministrador(page, usuariosAdministrativos.administrador);
    await abrirUsuarios(page);

    const filas = filasUsuarios(page);
    const busqueda = page.getByRole("searchbox", { name: "Buscar usuarios" });

    for (const rol of ["Administrador", "Operador", "Productor"]) {
        await seleccionarRol(page, rol);
        await expect(filas.first()).toBeVisible();
        await expect(filas.locator("span").filter({ hasText: new RegExp(`^${rol}$`) })).toHaveCount(await filas.count());

        for (const otro of ["Administrador", "Operador", "Productor"].filter((otro) => otro !== rol)) {
            await expect(filas.getByText(otro, { exact: true })).toHaveCount(0);
        }
    }

    await seleccionarRol(page, "Administrador");
    await expect(filas.getByText(usuariosAdministrativos.administrador.usuario, { exact: true })).toBeVisible();

    await seleccionarRol(page, "Operador");
    const columnas = filas.first().locator(":scope > span");
    const username = (await columnas.first().evaluate((columna) =>
        Array.from(columna.childNodes).filter((nodo) => nodo.nodeType === Node.TEXT_NODE).map((nodo) => nodo.textContent).join("")
    )).trim();
    const nombre = (await columnas.nth(1).innerText()).trim();
    expect(username).not.toBe("");
    expect(nombre).not.toBe("");

    await busqueda.fill(username);
    await expect(filas).toHaveCount(1);
    await expect(filas.getByText("Operador", { exact: true })).toBeVisible();
    await expect(filas.getByText(nombre, { exact: true })).toBeVisible();

    await seleccionarRol(page, "Productor");
    await expect(busqueda).toHaveValue("");
    await busqueda.fill(username);
    await expect(filas).toHaveCount(0);
    await expect(page.getByText("No se encontraron usuarios.", { exact: true })).toBeVisible();

    await seleccionarRol(page, "Operador");
    await busqueda.fill(username);
    await expect(filas).toHaveCount(1);
});

test("BP-18.6: consulta un operador, abre su edición y vuelve al listado", async ({ page, usuariosAdministrativos }) => {
    test.slow();
    await iniciarSesionAdministrador(page, usuariosAdministrativos.administrador);
    await abrirUsuarios(page);
    await seleccionarRol(page, "Operador");

    const filas = filasUsuarios(page);
    await expect(filas.first()).toBeVisible();
    const nombre = (await filas.first().locator(":scope > span").nth(1).innerText()).trim();

    await filas.first().click();
    await expect(page).toHaveURL(/\/gestion-operadores\/\d+$/, { timeout: 30_000 });
    const rutaPerfil = new URL(page.url()).pathname;
    await expect(page.getByRole("heading", { name: nombre, exact: true, level: 1 })).toBeVisible();

    await page.getByRole("link", { name: /Volver al listado de operadores/ }).click();
    await expect(page).toHaveURL(/\/administracion#usuarios$/);

    await seleccionarRol(page, "Operador");
    const fila = filasUsuarios(page).filter({ has: page.getByText(nombre, { exact: true }) });
    await expect(fila).toHaveCount(1);
    await fila.getByTitle("Editar perfil", { exact: true }).click();
    await expect(page).toHaveURL(`${rutaPerfil}/editar`, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Modificar operador", exact: true })).toBeVisible();

    await Promise.all([
        page.waitForURL((url) => url.pathname === rutaPerfil, { timeout: 30_000 }),
        page.getByRole("button", { name: "Volver al perfil", exact: true }).click(),
    ]);
    await expect(page.getByRole("heading", { name: nombre, exact: true, level: 1 })).toBeVisible();

    await page.getByRole("link", { name: /Volver al listado de operadores/ }).click();
    await expect(page).toHaveURL(/\/administracion#usuarios$/);
});

for (const rol of ["visitante", "operador", "productor"] as const) {
    test(`BP-18.9: rechaza el acceso administrativo del ${rol}`, async ({ page, usuariosAdministrativos }) => {
        test.slow();

        if (rol === "operador") await iniciarSesionOperador(page);
        if (rol === "productor") await iniciarSesionProductor(page, usuariosAdministrativos.productor);

        const destino = rol === "visitante"
            ? /^\/iniciar-sesion$/
            : rol === "productor"
                ? /^\/mi-mercado\/productor$/
                : /^\/mi-mercado(?:\/|$)/;

        for (const ruta of ["/administracion", "/gestion-operadores/999999", "/gestion-operadores/999999/editar"]) {
            await test.step(`Rechazar ${ruta}`, async () => {
                await page.goto(ruta);
                await expect(page).toHaveURL((url) => destino.test(url.pathname));
                await expect(page.getByRole("link", { name: "Administración", exact: true })).toHaveCount(0);
                await expect(page.getByRole("heading", { name: "Panel Administrativo" })).toHaveCount(0);
            });
        }
    });
}

test("BP-18.2: abandonar un cambio conserva el importe guardado", async ({ page, usuariosAdministrativos }) => {
    test.slow();
    await iniciarSesionAdministrador(page, usuariosAdministrativos.administrador);
    await abrirGeneral(page);

    const original = await campoImporte(page).inputValue();
    expect(original).toMatch(/^[1-9]\d*$/);
    await campoImporte(page).fill(original === "25" ? "37" : "25");
    await expect(guardarImporte(page)).toBeEnabled();

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(campoImporte(page)).toHaveValue(original);
    await expect(guardarImporte(page)).toBeDisabled();
});

test("BP-18.2: rechaza cero sin reemplazar el importe guardado", async ({ page, usuariosAdministrativos }) => {
    test.slow();
    await iniciarSesionAdministrador(page, usuariosAdministrativos.administrador);
    await abrirGeneral(page);

    const original = await campoImporte(page).inputValue();
    await campoImporte(page).fill("0");
    await guardarImporte(page).click();

    await expect(page.getByRole("alert").filter({ hasText: "El importe debe ser un número entero mayor que cero." })).toBeVisible();
    await expect(campoImporte(page)).toHaveValue("0");
    await expect(guardarImporte(page)).toBeEnabled();

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(campoImporte(page)).toHaveValue(original);
});

test("BP-18.2: guarda el importe y lo aplica al ajuste rápido del operador", async ({ page, browser, usuariosAdministrativos, registrarLimpieza }) => {
    test.setTimeout(180_000);
    await iniciarSesionAdministrador(page, usuariosAdministrativos.administrador);
    await abrirGeneral(page);

    const original = await campoImporte(page).inputValue();
    expect(original).toMatch(/^[1-9]\d*$/);
    const nuevo = original === "25" ? "37" : "25";

    const operador = await browser.newPage();
    registrarLimpieza(async () => {
        if (!operador.isClosed()) await operador.close();
    });

    await iniciarSesionOperador(operador);
    const producto = await buscarProductoConPrecio(operador);
    const tarjeta = tarjetaProducto(operador, producto.nombre);
    const precio = botonPrecio(tarjeta);
    const preciosOriginales = await leerPrecios(operador);
    let precioRestaurado = false;

    registrarLimpieza(() => restaurarImporte(page, original));

    await test.step("Guardar y comprobar persistencia", async () => {
        await campoImporte(page).fill(nuevo);
        await guardarImporte(page).click();
        await expect(page.getByRole("status").filter({ hasText: confirmacionGuardado })).toBeVisible({ timeout: 30_000 });
        await expect(guardarImporte(page)).toBeDisabled();

        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(campoImporte(page)).toHaveValue(nuevo);

        await operador.reload({ waitUntil: "domcontentloaded" });
        await expect.poll(() => leerPrecios(operador)).toEqual(preciosOriginales);
    });

    registrarLimpieza(async () => {
        if (precioRestaurado) return;
        await operador.goto("/mi-mercado", { waitUntil: "domcontentloaded" });
        const tarjeta = tarjetaProducto(operador, producto.nombre);
        const precio = botonPrecio(tarjeta);
        await expect(precio).toBeEnabled();

        if ((await precio.innerText()).trim() !== `$${producto.precio}`) {
            await precio.click();
            const entrada = tarjeta.getByRole("textbox", { name: "Editar precio", exact: true });
            await entrada.fill(String(producto.precio));
            await ejecutarCambioPrecio(operador, tarjeta, () => entrada.press("Enter"));
            await expect(precio).toHaveText(`$${producto.precio}`);
            await expect(precio).toBeEnabled();
        }
    });

    await test.step("Aumentar y comprobar persistencia", async () => {
        await ejecutarCambioPrecio(operador, tarjeta, () => tarjeta.getByRole("button", { name: "Aumentar precio", exact: true }).click());
        await expect(precio).toHaveText(`$${producto.precio + Number(nuevo)}`);
        await expect(precio).toBeEnabled();

        await operador.reload({ waitUntil: "domcontentloaded" });
        await expect(precio).toHaveText(`$${producto.precio + Number(nuevo)}`);
    });

    await test.step("Disminuir y comprobar persistencia", async () => {
        await ejecutarCambioPrecio(operador, tarjeta, () => tarjeta.getByRole("button", { name: "Disminuir precio", exact: true }).click());
        await expect(precio).toHaveText(`$${producto.precio}`);
        await expect(precio).toBeEnabled();

        await operador.reload({ waitUntil: "domcontentloaded" });
        await expect(precio).toHaveText(`$${producto.precio}`);
        await expect.poll(() => leerPrecios(operador)).toEqual(preciosOriginales);
        precioRestaurado = true;
    });
});