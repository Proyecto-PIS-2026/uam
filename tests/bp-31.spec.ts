import "temporal-polyfill/full/global";
import "temporal-polyfill/types/global";
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import argon2 from "argon2";
import postgres from "@prisma/orm-postgres/runtime";
import { expect, test as base, type Locator, type Page } from "@playwright/test";
import type { Contract } from "../src/infraestructura/persistencia/prisma/contract";
import contractJson from "../src/infraestructura/persistencia/prisma/contract.json" with { type: "json" };

type Rol = "OPERADOR" | "PRODUCTOR";
type Cuenta = { id: number; usuarioId: number; username: string; nombre: string; contrasena: string };
type Opcion = { id: number; nombre: string };
type Catalogos = Record<"especies" | "envases" | "kilos" | "calibres", Opcion[]>;

function conectar() {
    if (!process.env.DATABASE_URL) throw new Error("BP-31 requiere DATABASE_URL apuntando a la misma base que la aplicación E2E.");
    return postgres<Contract>({ contractJson, url: process.env.DATABASE_URL });
}

type DatosPrueba = { db: ReturnType<typeof conectar>; cuentas: Record<Rol, Cuenta> };
const test = base.extend<{ datosBP31: DatosPrueba }>({
    datosBP31: async ({}, usar) => {
        const db = conectar();
        const cuentas: Partial<Record<Rol, Cuenta>> = {};
        const usuarios: { id: number; username: string }[] = [];
        try {
            const nave = await db.orm.public.Nave.select("id").first();
            if (!nave) throw new Error("BP-31 necesita el catálogo de naves de la seed.");
            const contrasena = randomBytes(24).toString("hex");
            const passwordHash = await argon2.hash(contrasena, { type: argon2.argon2id });
            for (const rol of ["OPERADOR", "PRODUCTOR"] as const) {
                const sufijo = randomUUID().replaceAll("-", "");
                const username = `e2e_bp31_${rol.toLowerCase()}_${sufijo}`;
                const nombre = `BP31 ${rol} ${sufijo.slice(0, 12)}`;
                const usuario = await db.orm.public.Usuario.create({ username, passwordHash, rol, twoFactorEnabled: false });
                usuarios.push({ id: usuario.id, username });
                const propietario = rol === "OPERADOR"
                    ? await db.orm.public.Operador.create({ usuarioId: usuario.id, nombreFantasia: nombre, whatsApp: "+59899123456", enLicencia: false })
                    : await db.orm.public.Productor.create({ usuarioId: usuario.id, nombreFantasia: nombre, whatsApp: "+59899123456" });
                cuentas[rol] = { id: propietario.id, usuarioId: usuario.id, username, nombre, contrasena };
                if (rol === "OPERADOR") {
                    await db.orm.public.Local.create({ operadorId: propietario.id, naveId: nave.id, numeroLocal: `9${randomInt(100000000, 1000000000)}`, finContrato: null });
                }
            }
            await usar({ db, cuentas: cuentas as Record<Rol, Cuenta> });
        } finally {
            try {
                for (const rol of ["OPERADOR", "PRODUCTOR"] as const) {
                    const cuenta = cuentas[rol];
                    if (!cuenta) continue;
                    const relaciones = rol === "OPERADOR"
                        ? await db.orm.public.PublicacionOperador.where({ operadorId: cuenta.id }).all()
                        : await db.orm.public.PublicacionProductor.where({ productorId: cuenta.id }).all();
                    for (const relacion of relaciones) await db.orm.public.Publicacion.where({ id: relacion.publicacionId }).delete();
                    if (rol === "OPERADOR") await db.orm.public.Local.where({ operadorId: cuenta.id }).delete();
                }
                for (const usuario of usuarios) {
                    await db.orm.public.EstadisticaPublicacion.where({ username: usuario.username }).delete();
                    await db.orm.public.Usuario.where({ id: usuario.id }).delete();
                }
            } finally { await db.close(); }
        }
    },
});

const api = (rol: Rol) => rol === "OPERADOR" ? "/api/publicaciones" : "/api/publicaciones/productor";
const consulta = (page: Page) => page.getByRole("dialog", { name: "Consulta de publicación", exact: true });
const edicion = (page: Page) => page.getByRole("dialog", { name: "Editar publicación", exact: true });
const tarjetasPropias = (page: Page) => page.getByRole("button", { name: /^Ver detalle de / });

async function ingresar(page: Page, cuenta: Cuenta) {
    await page.goto("/iniciar-sesion");
    await page.getByLabel("Correo electrónico o nombre de usuario").fill(cuenta.username);
    await page.getByLabel("Contraseña", { exact: true }).fill(cuenta.contrasena);
    await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Mi Mercado", exact: true })).toBeVisible({ timeout: 30_000 });
}

async function seleccionar(page: Page, contenedor: Locator, campo: string, opcion: string) {
    await contenedor.getByRole("combobox", { name: campo, exact: true }).click();
    await page.getByRole("option", { name: opcion, exact: true }).click();
}

async function comprobarDisposicion(contenedor: Locator, primero: string, segundo: string, ancho: number) {
    const primeroCampo = contenedor.getByRole("combobox", { name: primero, exact: true });
    const segundoCampo = contenedor.getByRole("combobox", { name: segundo, exact: true });
    await primeroCampo.scrollIntoViewIfNeeded();
    const a = await primeroCampo.boundingBox();
    const b = await segundoCampo.boundingBox();
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    for (const caja of [a!, b!]) {
        expect(caja.x).toBeGreaterThanOrEqual(0);
        expect(caja.x + caja.width).toBeLessThanOrEqual(ancho + 1);
    }
    expect(a!.x + a!.width <= b!.x + 1 || b!.x + b!.width <= a!.x + 1
        || a!.y + a!.height <= b!.y + 1 || b!.y + b!.height <= a!.y + 1).toBe(true);
}

async function catalogos(page: Page, rol: Rol) {
    const respuesta = await page.request.get(api(rol));
    expect(respuesta.status()).toBe(200);
    return await respuesta.json() as Catalogos;
}

function id(opciones: Opcion[], nombre: string) {
    const opcion = opciones.find((item) => item.nombre === nombre);
    expect(opcion, `Debe existir la opción ${nombre}`).toBeDefined();
    return opcion!.id;
}

async function editar(page: Page) {
    const cerrarAvisos = page.getByRole("button", { name: "Cerrar notificación", exact: true });
    while (await cerrarAvisos.count()) await cerrarAvisos.first().click();
    await consulta(page).getByRole("button", { name: "Editar", exact: true }).click();
    await expect(edicion(page)).toBeVisible();
    await expect(edicion(page).getByRole("combobox", { name: "Envase", exact: true })).toBeEnabled();
    return edicion(page);
}

async function guardar(page: Page, rol: Rol) {
    const pendiente = page.waitForResponse((respuesta) => respuesta.request().method() === "PATCH"
        && new URL(respuesta.url()).pathname.startsWith(`${api(rol)}/`));
    await edicion(page).getByRole("button", { name: rol === "OPERADOR" ? "Guardar" : "Confirmar", exact: true }).click();
    const respuesta = await pendiente;
    expect(respuesta.status(), await respuesta.text()).toBe(200);
    await expect(consulta(page)).toBeVisible();
}

async function relacion(datos: DatosPrueba, rol: Rol, publicacionId: number) {
    const resultado = rol === "OPERADOR"
        ? await datos.db.orm.public.PublicacionOperador.where({ publicacionId, operadorId: datos.cuentas[rol].id }).first()
        : await datos.db.orm.public.PublicacionProductor.where({ publicacionId, productorId: datos.cuentas[rol].id }).first();
    expect(resultado).not.toBeNull();
    return resultado!.id;
}

test.use({ viewport: { width: 1366, height: 768 }, actionTimeout: 15_000, trace: "retain-on-failure" });

test.describe("BP-31: envase y kilos independientes", () => {
    test.describe.configure({ mode: "parallel" });
    test.setTimeout(180_000);

    for (const rol of ["OPERADOR", "PRODUCTOR"] as const) {
      for (const [dispositivo, viewport] of [
        ["web", { width: 1366, height: 768 }],
        ["mobile", { width: 390, height: 844 }],
      ] as const) {
        test(`${rol} ${dispositivo}: crea solo con especie y modifica ambos atributos sin variedad`, async ({ page, datosBP31 }) => {
            await page.setViewportSize(viewport);
            await ingresar(page, datosBP31.cuentas[rol]);
            const opciones = await catalogos(page, rol);
            expect(opciones.envases.map((opcion) => opcion.nombre)).toEqual(["Plancha", "Cajon", "Cajita", "Bolsa", "Descartable", "Bing", "Bins"]);
            expect(opciones.kilos.map((opcion) => opcion.nombre)).toEqual(["2", "4", "8", "10", "18", "20", "22", "25", "250", "400", "10-12", "18-24"]);
            expect(opciones.calibres.map((opcion) => opcion.nombre)).toEqual(expect.arrayContaining(["Primera", "Segunda", "Tercera", "Cuarta", "Quinta", "Sexta", "0", "00", "Especial"]));
            await page.getByRole("button", { name: "Nueva publicación", exact: true }).click();
            const alta = page.getByRole("dialog", { name: rol === "OPERADOR" ? "Nueva publicación" : "Nueva publicación de Productor", exact: true });
            await expect(alta.getByRole("combobox", { name: "Envase", exact: true })).toBeEnabled();
            await expect(alta.getByRole("combobox", { name: "Kilos del empaquetado", exact: true })).toBeEnabled();
            await seleccionar(page, alta, "Especie", "Papa");
            const creadaPendiente = page.waitForResponse((respuesta) => respuesta.request().method() === "POST" && new URL(respuesta.url()).pathname === api(rol));
            await alta.getByRole("button", { name: "Confirmar", exact: true }).click();
            const creada = await creadaPendiente;
            expect(creada.status(), await creada.text()).toBe(201);
            const publicacionId = (await creada.json()).id as number;
            await expect(alta).not.toBeVisible();
            await expect(tarjetasPropias(page)).toHaveCount(rol === "OPERADOR" ? 2 : 1);
            const soloEspecie = { especieId: id(opciones.especies, "Papa"), variedadId: null, envaseId: null, kilosId: null, categoriaId: null, calibreId: null };
            expect(await datosBP31.db.orm.public.Publicacion.where({ id: publicacionId }).first()).toMatchObject({ ...soloEspecie, precio: null });
            const duplicada = await page.request.post(api(rol), { data: { ...soloEspecie, paisId: null } });
            expect(duplicada.status()).toBe(400);
            expect((await duplicada.json()).errores.join(" ")).toMatch(/misma especie.*envase.*kilos/);

            await tarjetasPropias(page).first().click();
            let formulario = await editar(page);
            await seleccionar(page, formulario, "Envase", "Cajon");
            await seleccionar(page, formulario, "Kilos del empaquetado", "20 kg");
            await seleccionar(page, formulario, "Calibre", "Especial");
            await comprobarDisposicion(formulario, "Envase", "Kilos del empaquetado", viewport.width);
            await test.info().attach("Edición con envase y kilos", { body: await page.screenshot(), contentType: "image/png" });
            await formulario.getByRole("textbox", { name: "Precio en pesos", exact: true }).fill("500");
            await guardar(page, rol);
            const conAmbos = await datosBP31.db.orm.public.Publicacion.where({ id: publicacionId }).first();
            expect(conAmbos).toMatchObject({ variedadId: null, envaseId: id(opciones.envases, "Cajon"), kilosId: id(opciones.kilos, "20"), calibreId: id(opciones.calibres, "Especial") });
            expect(Number(conAmbos!.precio)).toBe(500);

            formulario = await editar(page);
            await seleccionar(page, formulario, "Envase", "Sin especificar");
            await expect(formulario.getByRole("combobox", { name: "Kilos del empaquetado", exact: true })).toHaveText("20 kg");
            await guardar(page, rol);
            expect(await datosBP31.db.orm.public.Publicacion.where({ id: publicacionId }).first()).toMatchObject({ envaseId: null, kilosId: id(opciones.kilos, "20") });

            formulario = await editar(page);
            await seleccionar(page, formulario, "Envase", "Bolsa");
            await seleccionar(page, formulario, "Kilos del empaquetado", "Sin especificar");
            await guardar(page, rol);
            expect(await datosBP31.db.orm.public.Publicacion.where({ id: publicacionId }).first()).toMatchObject({ envaseId: id(opciones.envases, "Bolsa"), kilosId: null });

            formulario = await editar(page);
            await seleccionar(page, formulario, "Envase", "Sin especificar");
            await seleccionar(page, formulario, "Calibre", "Sin especificar");
            await formulario.getByRole("textbox", { name: "Precio en pesos", exact: true }).fill("");
            await guardar(page, rol);
            await page.reload();
            await tarjetasPropias(page).first().click();
            for (const campo of ["Variedad", "Envase", "Kilos del empaquetado", "Calibre"]) {
                await expect(consulta(page).getByRole("combobox", { name: campo, exact: true })).toHaveText("-");
            }
            expect(await datosBP31.db.orm.public.Publicacion.where({ id: publicacionId }).first()).toMatchObject({ ...soloEspecie, precio: null });
        });

        test(`${rol} ${dispositivo}: consulta precios, filtra por envase y kilos y rechaza combinaciones repetidas`, async ({ page, browser, datosBP31 }) => {
            await page.setViewportSize(viewport);
            await ingresar(page, datosBP31.cuentas[rol]);
            const opciones = await catalogos(page, rol);
            const baseProducto = { especieId: id(opciones.especies, "Papa"), variedadId: null, categoriaId: null, calibreId: null, paisId: null, disponibilidad: true };
            const variantes = [
                { envaseId: null, kilosId: null, precio: "501", texto: null },
                { envaseId: id(opciones.envases, "Cajon"), kilosId: null, precio: "502", texto: "por Cajon" },
                { envaseId: null, kilosId: id(opciones.kilos, "20"), precio: "503", texto: "por 20 kg" },
                { envaseId: id(opciones.envases, "Cajon"), kilosId: id(opciones.kilos, "20"), precio: "504", texto: "por Cajon (20 kg)" },
                { envaseId: null, kilosId: id(opciones.kilos, "10-12"), precio: "505", texto: "por 10-12 kg" },
            ];
            const publicaciones: number[] = [];
            for (const variante of variantes) {
                const creada = await page.request.post(api(rol), { data: { ...baseProducto, envaseId: variante.envaseId, kilosId: variante.kilosId, precio: variante.precio } });
                expect(creada.status(), await creada.text()).toBe(201);
                publicaciones.push((await creada.json()).id as number);
            }
            const repetida = await page.request.post(api(rol), { data: { ...baseProducto, envaseId: variantes[3].envaseId, kilosId: variantes[3].kilosId, precio: "999" } });
            expect(repetida.status()).toBe(400);
            expect((await repetida.json()).errores.join(" ")).toMatch(/misma especie.*envase.*kilos/);
            const publicacionRelacion = rol === "OPERADOR" ? publicaciones[1] : await relacion(datosBP31, rol, publicaciones[1]);
            const conflicto = await page.request.patch(`${api(rol)}/${publicacionRelacion}`, { multipart: { cambios: JSON.stringify({ ...baseProducto, envaseId: null, kilosId: null, precio: "502", disponible: true, version: 1, ubicaciones: [] }) } });
            expect([400, 409]).toContain(conflicto.status());
            expect((await conflicto.json()).errores.join(" ")).toMatch(/misma especie.*envase.*kilos/);
            expect(await datosBP31.db.orm.public.Publicacion.where({ id: publicaciones[1] }).first()).toMatchObject({ envaseId: variantes[1].envaseId, kilosId: null });

            const contexto = await browser.newContext({ baseURL: new URL(page.url()).origin, viewport });
            try {
                const comprador = await contexto.newPage();
                if (rol === "PRODUCTOR") await ingresar(comprador, datosBP31.cuentas.OPERADOR);
                await comprador.goto(rol === "OPERADOR" ? "/publicaciones" : "/publicaciones-productor");
                await comprador.getByRole("searchbox", { name: "Buscar publicaciones", exact: true }).fill(datosBP31.cuentas[rol].nombre);
                const tarjetas = comprador.getByRole("button", { name: /^Ver detalles de / });
                await expect(tarjetas).toHaveCount(5);
                for (const variante of variantes) {
                    const tarjeta = tarjetas.filter({ has: comprador.getByText(`$ ${variante.precio}`, { exact: true }) });
                    await expect(tarjeta).toHaveCount(1);
                    if (variante.texto) await expect(tarjeta.getByText(variante.texto, { exact: true })).toBeVisible();
                    else await expect(tarjeta.getByText(/^por /)).toHaveCount(0);
                }
                await expect(comprador.getByRole("combobox", { name: "Especie", exact: true })).toHaveText("Todas");
                if (dispositivo === "mobile") await comprador.getByRole("button", { name: "Más filtros", exact: true }).click();
                await seleccionar(comprador, comprador.locator("main"), "Envase", "Cajon");
                await comprobarDisposicion(comprador.locator("main"), "Envase", "Kilos", viewport.width);
                await test.info().attach("Filtros de envase y kilos", { body: await comprador.screenshot(), contentType: "image/png" });
                await expect(tarjetas).toHaveCount(2);
                await seleccionar(comprador, comprador.locator("main"), "Kilos", "20 kg");
                await expect(tarjetas).toHaveCount(1);
                await expect(tarjetas).toContainText("$ 504");
                await seleccionar(comprador, comprador.locator("main"), "Envase", "Todos");
                await expect(tarjetas).toHaveCount(2);
                await seleccionar(comprador, comprador.locator("main"), "Kilos", "10-12 kg");
                await expect(tarjetas).toHaveCount(1);
                await seleccionar(comprador, comprador.locator("main"), "Especie", "Papa");
                await expect(comprador.getByRole("combobox", { name: "Kilos", exact: true })).toHaveText("10-12 kg");
                await tarjetas.click();
                const detalle = comprador.getByRole("dialog", { name: "Detalle de publicación", exact: true });
                await expect(detalle.getByText("Envase", { exact: true }).locator("xpath=following-sibling::span")).toHaveText("-");
                await expect(detalle.getByText("Kilos", { exact: true }).locator("xpath=following-sibling::span")).toHaveText("10-12 kg");
                await expect.poll(() => detalle.evaluate((elemento) => elemento.scrollWidth - elemento.clientWidth)).toBeLessThanOrEqual(1);
            } finally { await contexto.close(); }
        });
      }
    }
});
