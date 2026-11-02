import { randomUUID } from "node:crypto";
import { expect, type Locator, type Page } from "@playwright/test";
import { test as base } from "./usuarios-administrativos";
import { iniciarSesionAdministrador, iniciarSesionProductor } from "./autenticacion";
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
    const distintivo = boton.locator("span[aria-hidden='true']");
    if (cantidad === 0) {
        await expect(distintivo).toHaveCount(0);
        await expect(boton).not.toHaveAttribute("aria-describedby", /.+/);
    } else {
        await expect(distintivo).toHaveText(cantidad > 99 ? "99+" : String(cantidad));
        await expect(boton).toHaveAccessibleDescription(`${cantidad} ${cantidad === 1 ? "notificación sin leer" : "notificaciones sin leer"}`);
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

test("BP-29.6: el contador móvil se actualiza, el menú se cierra y abrir un enlace no marca leído", async ({ page, usuariosAdministrativos, avisos }) => {
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
    const sinLeer = await consultar(page);
    expect(sinLeer).toMatchObject({ noLeidas: 1, notificaciones: [{ texto: aviso.texto, leida: false }] });
    await esperarContador(abrirMenu, 1);
    await abrirMenu.click();
    await menu.getByRole("link", { name: "Notificaciones", exact: true }).click();
    await fila(page, aviso.texto).getByRole("button", { name: "Marcar como leída", exact: true }).click();
    await esperarContador(abrirMenu, 0);
    await page.reload();
    await expect(fila(page, aviso.texto)).toHaveAttribute("data-leida", "true");
    await esperarContador(abrirMenu, 0);
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
