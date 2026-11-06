import { expect, type Locator, type Page } from "@playwright/test";
import { test } from "./usuarios-administrativos";
import { test as testPrecarga } from "./precarga-operadores";
import { iniciarSesionAdministrador, iniciarSesionOperador, iniciarSesionProductor } from "./autenticacion";

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

function botonPrecio(tarjeta: Locator) {
    return tarjeta.getByRole("button").and(tarjeta.getByTitle("Editar precio", { exact: true }));
}

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
    await busqueda.fill(usuariosAdministrativos.administrador.usuario);
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

    const notificaciones = page.getByRole("region", { name: "Notificaciones", exact: true });
    await expect(notificaciones.getByRole("alert")).toBeVisible();
    await expect(campoImporte(page)).toHaveValue("0");
    await expect(guardarImporte(page)).toBeEnabled();

    const respuesta = await page.request.get("/api/configuracion/incremento_precio");
    expect(respuesta.ok()).toBe(true);
    expect(await respuesta.json()).toMatchObject({ valor: original });

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(campoImporte(page)).toHaveValue(original);
});

testPrecarga("BP-18.2: guarda el importe y lo aplica al ajuste rápido del operador", async ({ page, browser, precargaOperadores }) => {
    testPrecarga.setTimeout(180_000);

    const { db, operadorA } = precargaOperadores;
    const precioInicial = 100;
    const especie = await db.orm.public.Especie.select("id").first();
    expect(especie).not.toBeNull();
    if (!especie) throw new Error("No hay especies para preparar la publicación.");

    type Precio = Parameters<typeof db.orm.public.Publicacion.create>[0]["precio"];

    const publicacion = await db.transaction(async (tx) => {
        const creada = await tx.orm.public.Publicacion.create({
            especieId: especie.id,
            tipoPublicacion: "OPERADOR",
            precio: String(precioInicial) as Precio,
            publicacionActiva: true,
            publicacionDisponible: true,
        });

        await tx.orm.public.PublicacionOperador.create({ publicacionId: creada.id, operadorId: operadorA.id });
        return creada;
    });

    await iniciarSesionAdministrador(page, precargaOperadores.administrador);
    await abrirGeneral(page);

    const original = await campoImporte(page).inputValue();
    expect(original).toMatch(/^[1-9]\d*$/);
    const nuevo = original === "25" ? "37" : "25";
    const operador = await browser.newPage();

    async function comprobarPrecioGuardado(esperado: number) {
        await expect.poll(async () => {
            const guardada = await db.orm.public.Publicacion.where({ id: publicacion.id }).select("precio").first();
            return guardada?.precio == null ? null : Number(guardada.precio);
        }, { timeout: 30_000 }).toBe(esperado);
    }

    try {
        await operador.goto("/iniciar-sesion");
        await operador.getByLabel("Correo electrónico o nombre de usuario").fill(operadorA.credenciales.usuario);
        await operador.getByLabel("Contraseña", { exact: true }).fill(operadorA.credenciales.contrasena);
        await operador.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
        await expect(operador).toHaveURL((url) => decodeURIComponent(url.pathname) === `/mi-mercado/${operadorA.nombre}`, { timeout: 30_000 });
        await expect(operador.getByRole("heading", { name: "Mi Mercado", exact: true })).toBeVisible({ timeout: 30_000 });

        const tarjeta = operador.getByRole("main");
        const precio = botonPrecio(tarjeta);
        const aumentar = tarjeta.getByRole("button", { name: "Aumentar precio", exact: true });
        const disminuir = tarjeta.getByRole("button", { name: "Disminuir precio", exact: true });

        await expect(precio).toHaveCount(1);
        await expect(precio).toHaveText(`$${precioInicial}`);

        await testPrecarga.step("Guardar el importe y comprobar persistencia", async () => {
            await campoImporte(page).fill(nuevo);
            await guardarImporte(page).click();
            await expect(page.getByRole("status").filter({ hasText: confirmacionGuardado })).toBeVisible({ timeout: 30_000 });
            await expect(guardarImporte(page)).toBeDisabled();

            await page.reload({ waitUntil: "domcontentloaded" });
            await expect(campoImporte(page)).toHaveValue(nuevo);
            await comprobarPrecioGuardado(precioInicial);

            await operador.reload({ waitUntil: "domcontentloaded" });
            await expect(precio).toHaveText(`$${precioInicial}`);
        });

        await testPrecarga.step("Aumentar y comprobar persistencia", async () => {
            await ejecutarCambioPrecio(operador, tarjeta, () => aumentar.click());
            await expect(precio).toHaveText(`$${precioInicial + Number(nuevo)}`);
            await comprobarPrecioGuardado(precioInicial + Number(nuevo));

            await operador.reload({ waitUntil: "domcontentloaded" });
            await expect(precio).toHaveText(`$${precioInicial + Number(nuevo)}`);
        });

        await testPrecarga.step("Disminuir y comprobar persistencia", async () => {
            await ejecutarCambioPrecio(operador, tarjeta, () => disminuir.click());
            await expect(precio).toHaveText(`$${precioInicial}`);
            await comprobarPrecioGuardado(precioInicial);

            await operador.reload({ waitUntil: "domcontentloaded" });
            await expect(precio).toHaveText(`$${precioInicial}`);
        });
    } finally {
        try {
            await restaurarImporte(page, original);
        } finally {
            await operador.close();
        }
    }
});
