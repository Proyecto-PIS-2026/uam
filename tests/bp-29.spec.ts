import { conRestablecimientoHabilitado } from "./restablecimiento-contrasena-db";

import { randomUUID } from "node:crypto";
import { expect, mergeTests, type Locator, type Page } from "@playwright/test";
import { test as operadores } from "./precarga-operadores";
import { test as base } from "./usuarios-administrativos";
import { iniciarSesionAdministrador, iniciarSesionProductor, type Credenciales } from "./autenticacion";
import type { DestinatariosNotificacion } from "../src/modulos/notificaciones/notificaciones";
import type { NotificacionesUsuario } from "../src/modulos/notificaciones/tipos";

type Backend = {
    db: typeof import("../src/infraestructura/persistencia/prisma/db").db;
    enviarNotificacion: typeof import("../src/modulos/notificaciones/notificaciones").enviarNotificacion;
};
type AvisoPrueba = { texto: string; enviadas: number; filas: { id: number; usuarioId: number }[] };
type Avisos = {
    administradorId: number;
    productorId: number;
    enviar: (etiqueta: string, destino?: Omit<DestinatariosNotificacion, "texto">) => Promise<AvisoPrueba>;
};

const test = base.extend<{ avisos: Avisos }, { backendNotificaciones: Backend }>({
    backendNotificaciones: [async ({}, ejecutar) => {
        if (!process.env.DATABASE_URL) throw new Error("Configure DATABASE_URL con la base utilizada por el servidor E2E.");
        const { db } = await import("../src/infraestructura/persistencia/prisma/db");
        try {
            const { enviarNotificacion } = await import("../src/modulos/notificaciones/notificaciones");
            await ejecutar({ db, enviarNotificacion });
        } finally {
            await db.close();
        }
    }, { scope: "worker" }],
    avisos: async ({ usuariosAdministrativos, backendNotificaciones }, ejecutar) => {
        const { db, enviarNotificacion } = backendNotificaciones;
        const administrador = await db.orm.public.Administrador.where({ email: usuariosAdministrativos.administrador.usuario }).select("usuarioId").first();
        const productor = await db.orm.public.Usuario.where({ username: usuariosAdministrativos.productor.usuario }).select("id").first();
        if (!administrador || !productor) throw new Error("No se encontraron las cuentas propias de la fixture administrativa.");
        const textos = new Set<string>();
        try {
            await ejecutar({
                administradorId: administrador.usuarioId,
                productorId: productor.id,
                enviar: async (etiqueta, destino = { usuarios: [productor.id] }) => {
                    const texto = `BP-29 ${etiqueta} ${randomUUID()}`;
                    textos.add(texto);
                    const { enviadas } = await enviarNotificacion({ ...destino, texto });
                    const filas = await db.orm.public.Notificacion.where({ descripcion: texto }).select("id", "usuarioId").all();
                    return { texto, enviadas, filas };
                },
            });
        } finally {
            for (const descripcion of textos) {
                await db.orm.public.Notificacion.where({ descripcion }).deleteAndCount();
            }
        }
    },
});

test.describe.configure({ mode: "default" });
test.use({ viewport: { width: 1280, height: 900 } });

function fila(page: Page, texto: string): Locator {
    return page.getByRole("list", { name: "Notificaciones recibidas" }).getByRole("listitem").filter({ hasText: texto });
}

function botonCuenta(page: Page) {
    return page.getByRole("button", { name: "Abrir menú de usuario", exact: true });
}

async function esperarContador(boton: Locator, cantidad: number) {
    const menuAbierto = await boton.getAttribute("aria-expanded") === "true";
    const pagina = boton.page();
    const elementoContador = menuAbierto
        ? pagina.getByRole("menuitem", { name: "Notificaciones", exact: true })
        : boton;
    const distintivo = elementoContador.locator(".MuiBadge-badge");

    if (cantidad === 0) {
        await expect(distintivo).toHaveCount(0);
        await expect(elementoContador).not.toHaveAttribute("aria-describedby", /.+/);
    } else {
        await expect(distintivo).toHaveText(cantidad > 9 ? "9+" : String(cantidad));
        await expect(elementoContador).toHaveAccessibleDescription(`${cantidad} ${cantidad === 1 ? "notificación sin leer" : "notificaciones sin leer"}`);
    }
}

async function consultar(page: Page): Promise<NotificacionesUsuario> {
    const respuesta = await page.request.get("/api/notificaciones");
    expect(respuesta.status()).toBe(200);
    return respuesta.json();
}

test("BP-29.1: el visitante es redirigido y todas las APIs exigen sesión", async ({ page, request }) => {
    await page.goto("/notificaciones");
    await expect(page).toHaveURL(/\/iniciar-sesion$/);
    await expect(page.getByRole("heading", { name: "Notificaciones", exact: true })).toHaveCount(0);
    for (const [metodo, ruta] of [
        ["GET", "/api/notificaciones"], ["GET", "/api/notificaciones/resumen"],
        ["PATCH", "/api/notificaciones"], ["DELETE", "/api/notificaciones"],
        ["PATCH", "/api/notificaciones/1"], ["DELETE", "/api/notificaciones/1"],
    ]) {
        const respuesta = await request.fetch(ruta, { method: metodo });
        expect(respuesta.status(), `${metodo} ${ruta}`).toBe(401);
    }
});

test("BP-29.2: el envío por roles y usuarios guarda una copia por destinatario", async ({ page, usuariosAdministrativos, avisos }) => {
    const porRol = await avisos.enviar("Sólo administradores", { roles: ["ADMINISTRADOR"] });
    const combinado = await avisos.enviar("Unión de destinatarios", {
        usuarios: [avisos.administradorId, avisos.productorId, avisos.productorId],
        roles: ["ADMINISTRADOR", "ADMINISTRADOR"],
    });
    expect(porRol.filas.filter(({ usuarioId }) => usuarioId === avisos.administradorId)).toHaveLength(1);
    expect(porRol.filas.some(({ usuarioId }) => usuarioId === avisos.productorId)).toBe(false);
    expect(combinado.enviadas).toBeGreaterThanOrEqual(2);
    expect(new Set(combinado.filas.map(({ usuarioId }) => usuarioId)).size).toBe(combinado.filas.length);
    expect(combinado.filas.filter(({ usuarioId }) => usuarioId === avisos.administradorId)).toHaveLength(1);
    expect(combinado.filas.filter(({ usuarioId }) => usuarioId === avisos.productorId)).toHaveLength(1);

    await iniciarSesionAdministrador(page, usuariosAdministrativos.administrador);
    await page.goto("/notificaciones");
    await expect(fila(page, porRol.texto)).toBeVisible();
    await expect(fila(page, combinado.texto)).toBeVisible();
    await esperarContador(botonCuenta(page), 2);
    const recibidas = await consultar(page);
    expect(recibidas.notificaciones.map(({ texto }) => texto).sort()).toEqual([porRol.texto, combinado.texto].sort());
    expect(recibidas.notificaciones.every(({ leida, url, fecha }) => !leida && url === null && Number.isFinite(Date.parse(fecha)))).toBe(true);
});

test("BP-29.3: leer y borrar avisos individuales persiste y actualiza el contador de escritorio", async ({ page, usuariosAdministrativos, avisos }) => {
    const primero = await avisos.enviar("Aviso para leer");
    const segundo = await avisos.enviar("Aviso para borrar");
    await iniciarSesionProductor(page, usuariosAdministrativos.productor);
    await esperarContador(botonCuenta(page), 2);
    await botonCuenta(page).click();
    const enlace = page.getByRole("menuitem", { name: "Notificaciones", exact: true });
    await expect(enlace).toHaveAccessibleDescription("2 notificaciones sin leer");
    await enlace.click();
    await expect(page).toHaveURL(/\/notificaciones$/);
    await expect(botonCuenta(page)).toHaveAttribute("aria-expanded", "false");

    await fila(page, primero.texto).getByRole("button", { name: "Marcar como leída", exact: true }).click();
    await expect(fila(page, primero.texto)).toHaveAttribute("data-leida", "true");
    await esperarContador(botonCuenta(page), 1);
    await page.reload();
    await expect(fila(page, primero.texto).getByRole("button", { name: "Notificación leída", exact: true })).toBeDisabled();
    await expect(fila(page, segundo.texto)).toHaveAttribute("data-leida", "false");
    await fila(page, segundo.texto).getByRole("button", { name: "Borrar notificación", exact: true }).click();
    await expect(fila(page, segundo.texto)).toHaveCount(0);
    await esperarContador(botonCuenta(page), 0);
    await page.reload();
    const guardadas = await consultar(page);
    expect(guardadas.noLeidas).toBe(0);
    expect(guardadas.notificaciones).toHaveLength(1);
    expect(guardadas.notificaciones[0]).toMatchObject({ texto: primero.texto, leida: true });
});

test("BP-29.4: leer todo y borrar todo funcionan con confirmación y sobreviven a una recarga", async ({ page, usuariosAdministrativos, avisos }) => {
    for (const etiqueta of ["Primero", "Segundo", "Tercero"]) await avisos.enviar(etiqueta, { usuarios: [avisos.administradorId] });
    await iniciarSesionAdministrador(page, usuariosAdministrativos.administrador);
    await page.goto("/notificaciones");
    await expect(page.getByRole("list", { name: "Notificaciones recibidas" }).getByRole("listitem")).toHaveCount(3);
    await page.getByRole("button", { name: "Leer todo", exact: true }).click();
    await expect(page.getByRole("button", { name: "Notificación leída", exact: true })).toHaveCount(3);
    await esperarContador(botonCuenta(page), 0);
    await page.reload();
    await expect(page.getByRole("button", { name: "Leer todo", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "Borrar todo", exact: true }).click();
    const confirmacion = page.getByRole("alertdialog", { name: "Borrar todas las notificaciones" });
    await confirmacion.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(confirmacion).not.toBeVisible();
    expect((await consultar(page)).notificaciones).toHaveLength(3);
    await page.getByRole("button", { name: "Borrar todo", exact: true }).click();
    await confirmacion.getByRole("button", { name: "Sí, borrar todas", exact: true }).click();
    await expect(page.getByRole("heading", { name: "No tenés notificaciones", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Borrar todo", exact: true })).toBeDisabled();
    await page.reload();
    await expect(page.getByRole("heading", { name: "No tenés notificaciones", exact: true })).toBeVisible();
    expect(await consultar(page)).toEqual({ notificaciones: [], noLeidas: 0 });
});

test("BP-29.5: incluso el administrador sólo consulta y modifica sus propios avisos", async ({ page, browser, usuariosAdministrativos, avisos }) => {
    const privado = await avisos.enviar("Privado del productor");
    const propio = await avisos.enviar("Propio del administrador", { usuarios: [avisos.administradorId] });
    await iniciarSesionAdministrador(page, usuariosAdministrativos.administrador);
    const respuesta = await page.request.get(`/api/notificaciones?usuarioId=${avisos.productorId}`);
    expect(respuesta.status()).toBe(200);
    expect((await respuesta.json() as NotificacionesUsuario).notificaciones.map(({ texto }) => texto)).toEqual([propio.texto]);
    const idAjeno = privado.filas.find(({ usuarioId }) => usuarioId === avisos.productorId)!.id;
    expect((await page.request.patch(`/api/notificaciones/${idAjeno}`)).status()).toBe(404);
    expect((await page.request.delete(`/api/notificaciones/${idAjeno}`)).status()).toBe(404);
    expect((await page.request.patch("/api/notificaciones/0")).status()).toBe(400);
    expect((await page.request.delete("/api/notificaciones/1e2")).status()).toBe(400);
    expect((await page.request.delete("/api/notificaciones")).status()).toBe(200);
    expect(await consultar(page)).toEqual({ notificaciones: [], noLeidas: 0 });

    const otroContexto = await browser.newContext({ baseURL: new URL(page.url()).origin });
    try {
        const paginaProductor = await otroContexto.newPage();
        await iniciarSesionProductor(paginaProductor, usuariosAdministrativos.productor);
        await paginaProductor.goto("/notificaciones");
        await expect(fila(paginaProductor, privado.texto)).toHaveAttribute("data-leida", "false");
        expect((await consultar(paginaProductor)).notificaciones).toMatchObject([{ id: idAjeno, texto: privado.texto, leida: false }]);
        await esperarContador(botonCuenta(paginaProductor), 1);
    } finally {
        await otroContexto.close();
    }
});

test("BP-29.6: el contador móvil se actualiza, el menú se cierra y abrir un enlace marca leído", async ({ page, usuariosAdministrativos, avisos }) => {
    const aviso = await avisos.enviar("Abrir mi mercado", { usuarios: [avisos.productorId], url: "/mi-mercado/productor" });
    await iniciarSesionProductor(page, usuariosAdministrativos.productor);
    await page.setViewportSize({ width: 390, height: 844 });
    let abrirMenu = page.getByRole("button", { name: "Abrir menú", exact: true });
    await esperarContador(abrirMenu, 1);
    await abrirMenu.click();
    const menu = page.getByRole("navigation", { name: "Navegación móvil", exact: true });
    const enlace = menu.getByRole("link", { name: "Notificaciones", exact: true });
    await expect(enlace).toHaveAccessibleDescription("1 notificación sin leer");
    await enlace.click();
    await expect(page).toHaveURL(/\/notificaciones$/);
    abrirMenu = page.getByRole("button", { name: "Abrir menú", exact: true });
    await expect(abrirMenu).toHaveAttribute("aria-expanded", "false");
    await expect(menu).not.toBeVisible();
    await fila(page, aviso.texto).getByRole("link", { name: aviso.texto, exact: true }).click();
    await expect(page).toHaveURL(/\/mi-mercado\/productor$/);
    const leida = await consultar(page);
    expect(leida).toMatchObject({ noLeidas: 0, notificaciones: [{ texto: aviso.texto, leida: true }] });
    await esperarContador(abrirMenu, 0);
    await abrirMenu.click();
    await menu.getByRole("link", { name: "Notificaciones", exact: true }).click();
    await expect(page).toHaveURL(/\/notificaciones$/);
    await expect(fila(page, aviso.texto)).toHaveAttribute("data-leida", "true");
    await expect(fila(page, aviso.texto).getByRole("button", { name: "Notificación leída", exact: true })).toBeDisabled();
    await esperarContador(abrirMenu, 0);
    await page.reload();
    await expect(fila(page, aviso.texto)).toHaveAttribute("data-leida", "true");
    await esperarContador(abrirMenu, 0);
    expect(await consultar(page)).toMatchObject({ noLeidas: 0, notificaciones: [{ texto: aviso.texto, leida: true }] });
});

test("BP-29.7: abrir el menú trae avisos nuevos y leer desde otra pestaña actualiza el contador", async ({ page, context, usuariosAdministrativos, avisos }) => {
    await iniciarSesionProductor(page, usuariosAdministrativos.productor);
    await esperarContador(botonCuenta(page), 0);
    const aviso = await avisos.enviar("Aviso recibido con la sesión abierta");
    await botonCuenta(page).click();
    await esperarContador(botonCuenta(page), 1);
    await expect(page.getByRole("menuitem", { name: "Notificaciones", exact: true })).toHaveAccessibleDescription("1 notificación sin leer");
    const otraPestana = await context.newPage();
    try {
        await otraPestana.goto("/notificaciones");
        await fila(otraPestana, aviso.texto).getByRole("button", { name: "Marcar como leída", exact: true }).click();
        await expect(fila(otraPestana, aviso.texto)).toHaveAttribute("data-leida", "true");
        await esperarContador(botonCuenta(page), 0);
        expect((await consultar(page)).noLeidas).toBe(0);
    } finally {
        await otraPestana.close();
    }
});

//
const nuevos = mergeTests(test, operadores).extend<{
    fotoPropia: { id: number; clave: string; url: string; especie: string; contenido: Buffer };
}>({
    fotoPropia: async ({ precargaOperadores: { db, operadorA } }, usar) => {
        const especie = await db.orm.public.Especie.create({ nombreEspecie: `BP29 ${randomUUID()}` });
        let id: number | undefined;
        let clave: string | undefined;
        try {
            const publicacion = await db.orm.public.Publicacion.create({ especieId: especie.id, tipoPublicacion: "OPERADOR", cantidadUnidades: 12, publicacionActiva: true, publicacionDisponible: true });
            id = publicacion.id;
            await db.orm.public.PublicacionOperador.create({ publicacionId: id, operadorId: operadorA.id });
            const archivo = `${randomUUID()}.webp`;
            clave = `publicaciones/${id}/${archivo}`;
            const url = `/api/publicaciones/imagenes/${id}/${archivo}`;
            const sharp = (await import("sharp")).default;
            const contenido = await sharp({ create: { width: 8, height: 8, channels: 3, background: "green" } }).webp().toBuffer();
            await db.orm.public.Imagen.create({ clave, contenido, cargadaEn: Temporal.Now.instant() });
            await db.orm.public.Publicacion.where({ id }).update({ foto: url });
            await usar({ id, clave, url, especie: especie.nombreEspecie, contenido });
        } finally {
            if (id !== undefined) await db.orm.public.Publicacion.where({ id }).delete();
            if (clave !== undefined) await db.orm.public.Imagen.where({ clave }).deleteAndCount();
            await db.orm.public.Especie.where({ id: especie.id }).delete();
        }
    },
});

async function ingresarOperadorBP29(page: Page, credenciales: Credenciales) {
    await page.goto("/iniciar-sesion", { waitUntil: "domcontentloaded" });
    await page.getByLabel("Correo electrónico o nombre de usuario").fill(credenciales.usuario);
    await page.getByLabel("Contraseña", { exact: true }).fill(credenciales.contrasena);
    await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
    await expect(page).toHaveURL(/\/mi-mercado(?:\/[^?#]*)?(?:[?#].*)?$/, { timeout: 30_000 });
    await expect(botonCuenta(page)).toBeVisible({ timeout: 30_000 });
}

async function salirBP29(page: Page) {
    await botonCuenta(page).click();
    await page.getByRole("menuitem", { name: "Cerrar sesión", exact: true }).click();
    await expect(page).toHaveURL(/\/inicio$/, { timeout: 30_000 });
    expect((await page.request.get("/api/notificaciones")).status()).toBe(401);
}

async function cargarBP29(page: Page, recargar = false) {
    const [respuesta] = await Promise.all([
        page.waitForResponse((r) => r.request().method() === "GET" && new URL(r.url()).pathname === "/api/notificaciones", { timeout: 30_000 }),
        recargar ? page.reload() : page.goto("/notificaciones"),
    ]);
    expect(respuesta.status()).toBe(200);
    await expect(page.getByRole("region", { name: "Tus notificaciones", exact: true })).toHaveAttribute("aria-busy", "false", { timeout: 30_000 });
}

nuevos.describe(() => {
    nuevos.beforeEach(() => nuevos.setTimeout(180_000));

    nuevos("CP-29-02: cambiar de usuario después de salir no conserva avisos ajenos", async ({ page, precargaOperadores: datos, backendNotificaciones }) => {
        const textoA = `Privado A ${randomUUID()}`;
        const textoB = `Privado B ${randomUUID()}`;
        for (const [texto, usuarioId] of [[textoA, datos.operadorA.usuarioId], [textoB, datos.operadorB.usuarioId]] as const) {
            await backendNotificaciones.enviarNotificacion({ texto, usuarios: [usuarioId] });
        }
        await ingresarOperadorBP29(page, datos.operadorA.credenciales);
        await cargarBP29(page);
        await expect(fila(page, textoA)).toBeVisible();
        await expect(fila(page, textoB)).toHaveCount(0);
        await salirBP29(page);
        await ingresarOperadorBP29(page, datos.operadorB.credenciales);
        await cargarBP29(page);
        expect((await consultar(page)).notificaciones.map(({ texto }) => texto)).toEqual([textoB]);
        await expect(fila(page, textoB)).toBeVisible();
        await expect(fila(page, textoA)).toHaveCount(0);
    });

    nuevos("CP-29-03: el operador lee y borra avisos y persiste tras otro ingreso", async ({ page, precargaOperadores: datos, fotoPropia, backendNotificaciones }) => {
        expect(fotoPropia.id).toBeGreaterThan(0);
        const leer = `Leer ${randomUUID()}`;
        const borrar = `Borrar ${randomUUID()}`;
        for (const texto of [leer, borrar]) await backendNotificaciones.enviarNotificacion({ texto, usuarios: [datos.operadorA.usuarioId] });
        await ingresarOperadorBP29(page, datos.operadorA.credenciales);
        await esperarContador(botonCuenta(page), 2);
        await cargarBP29(page);
        await fila(page, leer).getByRole("button", { name: "Marcar como leída", exact: true }).click();
        await expect(fila(page, leer)).toHaveAttribute("data-leida", "true", { timeout: 30_000 });
        await esperarContador(botonCuenta(page), 1);
        await fila(page, borrar).getByRole("button", { name: "Borrar notificación", exact: true }).click();
        await expect(fila(page, borrar)).toHaveCount(0, { timeout: 30_000 });
        await esperarContador(botonCuenta(page), 0);
        await salirBP29(page);
        await ingresarOperadorBP29(page, datos.operadorA.credenciales);
        await cargarBP29(page);
        const guardadas = await consultar(page);
        expect(guardadas.noLeidas).toBe(0);
        expect(guardadas.notificaciones).toHaveLength(1);
        expect(guardadas.notificaciones[0]).toMatchObject({ texto: leer, leida: true });
        await expect(fila(page, leer)).toHaveAttribute("data-leida", "true");
    });

    nuevos("CP-29-04: el operador accede desde el menú a sus notificaciones", async ({ page, precargaOperadores: datos, backendNotificaciones }) => {
        const texto = `Acceso operador ${randomUUID()}`;
        await backendNotificaciones.enviarNotificacion({ texto, usuarios: [datos.operadorA.usuarioId] });
        await ingresarOperadorBP29(page, datos.operadorA.credenciales);
        await esperarContador(botonCuenta(page), 1);
        await botonCuenta(page).click();
        await page.getByRole("menuitem", { name: "Notificaciones", exact: true }).click();
        await expect(page).toHaveURL(/\/notificaciones$/, { timeout: 30_000 });
        await expect(fila(page, texto)).toHaveAttribute("data-leida", "false", { timeout: 30_000 });
        expect((await consultar(page)).notificaciones).toHaveLength(1);
    });

    nuevos("CP-29-12: falla de lectura o borrado informa el error sin modificar datos", async ({ page, precargaOperadores: datos, fotoPropia, backendNotificaciones }) => {
        expect(fotoPropia.id).toBeGreaterThan(0);
        const texto = `Error ${randomUUID()}`;
        await backendNotificaciones.enviarNotificacion({ texto, usuarios: [datos.operadorA.usuarioId] });
        await ingresarOperadorBP29(page, datos.operadorA.credenciales);
        await cargarBP29(page);
        const antes = await consultar(page);
        const ruta = `**/api/notificaciones/${antes.notificaciones[0].id}`;
        for (const [metodo, boton] of [["PATCH", "Marcar como leída"], ["DELETE", "Borrar notificación"]]) {
            await nuevos.step(metodo, async () => {
                let interceptadas = 0;
                const mensaje = `No se pudo completar ${metodo}. Intentá nuevamente.`;
                await page.route(ruta, async (route) => {
                    if (route.request().method() !== metodo) return route.continue();
                    interceptadas++;
                    await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ errores: [mensaje] }) });
                });
                try {
                    const [respuesta] = await Promise.all([
                        page.waitForResponse((r) => r.request().method() === metodo && new URL(r.url()).pathname === `/api/notificaciones/${antes.notificaciones[0].id}`, { timeout: 30_000 }),
                        fila(page, texto).getByRole("button", { name: boton, exact: true }).click(),
                    ]);
                    expect(respuesta.status()).toBe(500);
                    await expect(page.getByRole("region", { name: "Notificaciones", exact: true }).getByRole("alert")).toContainText(mensaje);
                    await expect(page.getByRole("region", { name: "Tus notificaciones", exact: true })).toHaveAttribute("aria-busy", "false");
                    expect(interceptadas).toBe(1);
                    await expect(fila(page, texto)).toHaveAttribute("data-leida", "false");
                    await esperarContador(botonCuenta(page), 1);
                    expect(await consultar(page)).toEqual(antes);
                } finally { await page.unroute(ruta); }
                await cargarBP29(page, true);
                await expect(fila(page, texto)).toHaveAttribute("data-leida", "false");
            });
        }
    });

    for (const caso of ["07", "08"] as const) {
        nuevos(`CP-29-${caso}: ${caso === "07" ? "los administradores reciben el aviso de recuperación preparado" : "sólo los administradores reciben el aviso de recuperación preparado"}`, async ({ page, browser, precargaOperadores: datos, fotoPropia, backendNotificaciones }) => {
            nuevos.info().annotations.push({ type: "alcance", description: "Aviso preparado por el test mediante enviarNotificacion; no verifica el disparador automático de recuperación." });
            expect(fotoPropia.id).toBeGreaterThan(0);
            const admin = await datos.db.orm.public.Administrador.where({ email: datos.administrador.usuario }).first();
            if (!admin) throw new Error("Falta el administrador propio.");
            const cuenta = await datos.db.orm.public.Usuario.where({ id: admin.usuarioId }).first();
            if (!cuenta) throw new Error("Falta la cuenta administrativa propia.");
            const segundo = await datos.db.orm.public.Usuario.create({ username: `bp29_admin_${randomUUID()}`, passwordHash: cuenta.passwordHash, rol: "ADMINISTRADOR" });
            const texto = `Solicitud de recuperación de contraseña de ${datos.operadorA.credenciales.usuario}. ${randomUUID()}`;
            try {
                await datos.db.orm.public.Administrador.create({ usuarioId: segundo.id, email: `bp29_${randomUUID()}@example.com` });
                await conRestablecimientoHabilitado(async () => {
                    await page.goto("/iniciar-sesion");
                    await page.getByRole("button", { name: "Solicitar recuperación de contraseña", exact: true }).click();
                    const dialogo = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Solicitar recuperación de contraseña", exact: true }) });
                    await dialogo.getByLabel("Nombre de usuario", { exact: true }).fill(datos.operadorA.credenciales.usuario);
                    await dialogo.getByRole("button", { name: "Aceptar", exact: true }).click();
                    await expect(page.getByText("La solicitud de recuperación fue realizada correctamente.", { exact: true })).toBeVisible({ timeout: 30_000 });
                });
                expect(await datos.db.orm.public.Usuario.where({ id: datos.operadorA.usuarioId }).select("solicitoRestablecimiento").first()).toEqual({ solicitoRestablecimiento: true });
                await backendNotificaciones.enviarNotificacion({ texto, roles: ["ADMINISTRADOR"] });
                for (const usuarioId of [admin.usuarioId, segundo.id]) {
                    const avisos = await datos.db.orm.public.Notificacion.where({ usuarioId, descripcion: texto }).all();
                    expect(avisos, "El administrador debe recibir una copia del aviso preparado").toHaveLength(1);
                    expect(avisos[0].vista).toBe(false);
                }
                if (caso === "08") for (const credenciales of [datos.operadorA.credenciales, datos.operadorB.credenciales, datos.productor]) {
                    const contexto = await browser.newContext({ baseURL: new URL(page.url()).origin });
                    try {
                        const otra = await contexto.newPage();
                        if (credenciales === datos.productor) await iniciarSesionProductor(otra, credenciales);
                        else await ingresarOperadorBP29(otra, credenciales);
                        await cargarBP29(otra);
                        expect(await consultar(otra)).toEqual({ notificaciones: [], noLeidas: 0 });
                        await expect(otra.getByRole("heading", { name: "No tenés notificaciones", exact: true })).toBeVisible();
                    } finally { await contexto.close(); }
                }
            } finally {
                await datos.db.orm.public.Notificacion.where({ descripcion: texto }).deleteAndCount();
                await datos.db.orm.public.Usuario.where({ id: segundo.id }).delete();
            }
        });
    }

    nuevos("CP-29-06: aging sólo genera el aviso cuando está habilitado", async ({ page, precargaOperadores: datos, fotoPropia, backendNotificaciones }) => {
        const { procesarVencimientosFotos } = await import("../src/modulos/publicaciones/procesar-vencimientos-fotos");
        const { db } = backendNotificaciones;
        const configuracionActiva = {
            habilitado: true,
            avisosHabilitados: true,
            diasVigencia: 3,
            diasAnticipacionAviso: 1,
        } as const;
        async function procesar(habilitado: boolean) {
            return db.transaction(async (tx) => {
                await tx.execute(db.raw.sql`LOCK TABLE imagen, publicacion IN SHARE ROW EXCLUSIVE MODE`.affectedCount().build());
                const ajenas = await tx.query(db.raw.sql`SELECT clave FROM imagen WHERE clave <> ${fotoPropia.clave} AND "cargadaEn" <= '1900-02-01T15:00:00Z'::timestamptz`.returnsRow({ clave: "pg/text@1" }).build());
                if (ajenas.length) throw new Error("Hay fotos históricas ajenas al test; se revierte el aging.");
                const anteriores = await tx.orm.public.Imagen.where({ cargadaEn: null }).select("clave").all();
                const resultado = await procesarVencimientosFotos({ tx, limite: "1900-02-01T15:00:00Z", fecha: "1900-02-01" }, habilitado ? configuracionActiva : { habilitado: false });
                for (const { clave } of anteriores) await tx.orm.public.Imagen.where({ clave }).update({ cargadaEn: null });
                return resultado;
            });
        }
        await datos.db.orm.public.Imagen.where({ clave: fotoPropia.clave }).update({ cargadaEn: Temporal.Instant.from("1900-01-01T15:00:00Z") });
        expect(await procesar(true)).toBe(1);
        await ingresarOperadorBP29(page, datos.operadorA.credenciales);
        await cargarBP29(page);
        const antes = await consultar(page);
        expect(antes.noLeidas).toBe(1);
        expect(antes.notificaciones).toHaveLength(1);
        expect(antes.notificaciones[0].texto).toContain(fotoPropia.especie);
        await expect(fila(page, antes.notificaciones[0].texto)).toBeVisible();
        expect(await datos.db.orm.public.Publicacion.where({ id: fotoPropia.id }).select("foto").first()).toEqual({ foto: null });
        await datos.db.orm.public.Imagen.create({ clave: fotoPropia.clave, contenido: fotoPropia.contenido, cargadaEn: Temporal.Instant.from("1900-01-02T15:00:00Z") });
        await datos.db.orm.public.Publicacion.where({ id: fotoPropia.id }).update({ foto: fotoPropia.url, fotoEliminadaPorVencimientoEn: null });
        expect(await procesar(false)).toBe(0);
        await cargarBP29(page, true);
        expect(await consultar(page)).toEqual(antes);
        expect(await datos.db.orm.public.Publicacion.where({ id: fotoPropia.id }).select("foto").first()).toEqual({ foto: fotoPropia.url });
    });

    for (const escenario of [
        { caso: "09", dias: 7, estado: "próximo a vencer" },
        { caso: "10", dias: -1, estado: "vencido" },
    ] as const) {
        nuevos(`CP-29-${escenario.caso}: el administrador recibe el aviso preparado de contrato ${escenario.estado}`, async ({ page, precargaOperadores: datos, backendNotificaciones }) => {
            nuevos.info().annotations.push({
                type: "alcance",
                description: "Contrato y aviso preparados por el test. No verifica el proceso automático ni define su umbral de anticipación.",
            });
            const local = await datos.db.orm.public.Local.where({ operadorId: datos.operadorA.id }).first();
            if (!local) throw new Error("Falta el local propio para preparar el contrato ficticio.");
            const finContrato = Temporal.Now.zonedDateTimeISO("America/Montevideo").add({ days: escenario.dias }).toInstant().round({ smallestUnit: "millisecond", roundingMode: "trunc" });
            const fecha = finContrato.toZonedDateTimeISO("America/Montevideo").toPlainDate();
            const fechaTexto = `${String(fecha.day).padStart(2, "0")}/${String(fecha.month).padStart(2, "0")}/${fecha.year}`;
            const texto = `El contrato del operador ${datos.operadorA.nombre}, local ${local.numeroLocal}, está ${escenario.estado}. Fecha de vencimiento: ${fechaTexto}. ${randomUUID()}`;
            try {
                await datos.db.orm.public.Local.where({ id: local.id }).update({ finContrato });
                const contratoGuardado = await datos.db.orm.public.Local.where({ id: local.id }).first();
                expect(contratoGuardado?.finContrato?.toString()).toBe(finContrato.toString());

                const envio = await backendNotificaciones.enviarNotificacion({ texto, roles: ["ADMINISTRADOR"] });
                expect(envio.enviadas).toBeGreaterThanOrEqual(1);
                const admin = await datos.db.orm.public.Administrador.where({ email: datos.administrador.usuario }).first();
                if (!admin) throw new Error("Falta el administrador propio destinatario del aviso.");
                const copia = await datos.db.orm.public.Notificacion.where({ usuarioId: admin.usuarioId, descripcion: texto }).all();
                expect(copia).toHaveLength(1);
                expect(copia[0].vista).toBe(false);

                await iniciarSesionAdministrador(page, datos.administrador);
                await cargarBP29(page);
                await expect(fila(page, texto)).toBeVisible();
                await expect(fila(page, texto)).toHaveAttribute("data-leida", "false");
                const recibidas = await consultar(page);
                expect(recibidas.notificaciones.find(({ id }) => id === copia[0].id)).toMatchObject({ texto, leida: false });
                expect(recibidas.noLeidas).toBeGreaterThanOrEqual(1);
            } finally {
                await datos.db.orm.public.Notificacion.where({ descripcion: texto }).deleteAndCount();
                await datos.db.orm.public.Local.where({ id: local.id }).update({ finContrato: local.finContrato });
            }
        });
    }
});
