import { expect, type Page } from "@playwright/test";
import { test as base, type PrecargaOperadores as Datos } from "./precarga-operadores";
import { iniciarSesionAdministrador } from "./autenticacion";

const recomendacion = "Durante la licencia, consultar al puesto vecino.";
const fecha = (dias: number) => new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10);

const test = base.extend<{ publico: Page }>({
    publico: async ({ browser, baseURL }, usar) => {
        const contexto = await browser.newContext({ baseURL });
        try { await usar(await contexto.newPage()); }
        finally { await contexto.close(); }
    },
});

test.beforeEach(async ({ precargaOperadores: { db, operadorA } }) => {
    const especie = await db.orm.public.Especie.select("id").first();
    if (!especie) throw new Error("La base E2E necesita las especies de la seed.");
    const publicacion = await db.orm.public.Publicacion.create({
        especieId: especie.id, tipoPublicacion: "OPERADOR", publicacionActiva: true, publicacionDisponible: true,
    });
    // La fixture compartida elimina las publicaciones y cuentas propias al terminar.
    await db.orm.public.PublicacionOperador.create({ publicacionId: publicacion.id, operadorId: operadorA.id });
});

const rutaPublica = (datos: Datos) => `/operadores/${encodeURIComponent(datos.operadorA.nombre)}`;
const rutaAdmin = (datos: Datos) => `/gestion-operadores/${datos.operadorA.id}`;
const tarjetas = (page: Page) => page.getByRole("button", { name: /^Ver detalles de/ });
const seccionLicencia = (page: Page) => page.getByRole("region", { name: "Licencia", exact: true });

async function prepararLicencia(datos: Datos, comentario: string | null = recomendacion) {
    // Solo prepara las precondiciones; los cambios bajo prueba se realizan desde la UI.
    await datos.db.orm.public.Operador.where({ id: datos.operadorA.id }).update({ enLicencia: true, comentario });
}

async function abrirEdicion(page: Page, datos: Datos) {
    await page.goto(rutaAdmin(datos));
    await page.getByRole("link", { name: "Editar operador", exact: true }).click();
    await expect(page.getByRole("switch", { name: "En licencia", exact: true })).toBeVisible();
}

async function activarLicencia(page: Page, datos: Datos, comentario = recomendacion) {
    await abrirEdicion(page, datos);
    // El switch se activa después de aceptar el aviso, no en el primer clic.
    await page.getByRole("switch", { name: "En licencia", exact: true }).click();
    await page.getByRole("alertdialog", { name: "Aviso de licencia", exact: true })
        .getByRole("button", { name: "Aceptar", exact: true }).click();
    await page.getByLabel("Inicio de licencia", { exact: true }).fill(fecha(1));
    await page.getByLabel("Fin de licencia", { exact: true }).fill(fecha(8));
    await page.getByLabel("Mensaje de recomendación", { exact: true }).fill(comentario);
    await guardar(page, datos);
}

async function guardar(page: Page, datos: Datos) {
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
    await expect(page).toHaveURL(rutaAdmin(datos));
    await page.reload();
    await expect(page.getByRole("heading", { name: datos.operadorA.nombre, exact: true })).toBeVisible();
}

async function publicacionesPublicas(page: Page, datos: Datos, cantidad: number) {
    await page.goto("/publicaciones");
    const busqueda = page.getByRole("searchbox", { name: "Buscar publicaciones", exact: true });
    await busqueda.fill(datos.operadorA.nombre);
    if (cantidad === 0) {
        await expect(page.getByText("No hay publicaciones que coincidan con la búsqueda.", { exact: true })).toBeVisible();
    }
    await expect(tarjetas(page).filter({ hasText: datos.operadorA.nombre })).toHaveCount(cantidad);
}

async function ingresarOperador(page: Page, datos: Datos) {
    await page.goto("/iniciar-sesion");
    await page.getByLabel("Correo electrónico o nombre de usuario").fill(datos.operadorA.credenciales.usuario);
    await page.getByLabel("Contraseña", { exact: true }).fill(datos.operadorA.credenciales.contrasena);
    await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Mi Mercado", exact: true })).toBeVisible();
}

test.use({ actionTimeout: 15_000, trace: "retain-on-failure", screenshot: "only-on-failure" });

test.describe("BP-33 — vista de la licencia de un Operador", () => {
    test.setTimeout(90_000);

    test("CP-01 [CA-5] el administrador activa la licencia y guarda el comentario", async ({ page, precargaOperadores: datos }) => {
        await iniciarSesionAdministrador(page, datos.administrador);
        await activarLicencia(page, datos);
        await expect(seccionLicencia(page).getByText(recomendacion, { exact: true })).toBeVisible();
        expect(await datos.db.orm.public.Operador.where({ id: datos.operadorA.id }).first()).toMatchObject({
            enLicencia: true, comentario: `Licencia: ${fecha(1)} - ${fecha(8)}\n\n${recomendacion}`,
        });
        await abrirEdicion(page, datos);
        await expect(page.getByRole("switch", { name: "En licencia", exact: true })).toBeChecked();
        await expect(page.getByLabel("Mensaje de recomendación", { exact: true })).toHaveValue(recomendacion);
    });

    test("CP-02 [CA-6] activar la licencia oculta las publicaciones del listado público", async ({ page, publico, precargaOperadores: datos }) => {
        await publicacionesPublicas(publico, datos, 1);
        await iniciarSesionAdministrador(page, datos.administrador);
        await activarLicencia(page, datos);
        await publicacionesPublicas(publico, datos, 0);
    });

    test("CP-03 [CA-1, CA-6] el perfil público muestra la licencia con y sin comentario y oculta las publicaciones", async ({ publico, precargaOperadores: datos }) => {
        await publico.goto(rutaPublica(datos));
        await expect(tarjetas(publico)).toHaveCount(1);
        for (const comentario of [recomendacion, null]) {
            await test.step(comentario ? "Con comentario" : "Sin comentario", async () => {
                await prepararLicencia(datos, comentario);
                await publico.goto(rutaPublica(datos));
                await expect(publico.getByRole("heading", { name: datos.operadorA.nombre, exact: true })).toBeVisible();
                await expect(seccionLicencia(publico)).toBeVisible();
                await expect(seccionLicencia(publico).getByText(recomendacion, { exact: true })).toHaveCount(comentario ? 1 : 0);
                await expect(publico.getByText("Sin publicaciones, esta de licencia", { exact: true })).toBeVisible();
                await expect(tarjetas(publico)).toHaveCount(0);
            });
        }
    });

    test("CP-04 [CA-2] el operador de licencia permanece en los listados público y administrativo", async ({ page, publico, precargaOperadores: datos }) => {
        await prepararLicencia(datos);
        await publico.goto("/operadores");
        await publico.getByRole("searchbox", { name: "Buscar operadores", exact: true }).fill(datos.operadorA.nombre);
        await expect(publico.getByRole("link", { name: new RegExp(datos.operadorA.nombre) })).toBeVisible();
        await iniciarSesionAdministrador(page, datos.administrador);
        await page.getByRole("group", { name: "Secciones de configuración" })
            .getByRole("button", { name: "Usuarios", exact: true }).click();
        await page.getByRole("combobox", { name: "Rol", exact: true }).click();
        await page.getByRole("option", { name: "Operador", exact: true }).click();
        await page.getByRole("searchbox", { name: "Buscar usuarios", exact: true }).fill(datos.operadorA.nombre);
        const fila = page.getByRole("button").filter({ has: page.getByText(datos.operadorA.nombre, { exact: true }) });
        await expect(fila).toHaveCount(1);
        await fila.click();
        await expect(page).toHaveURL(rutaAdmin(datos));
    });

    test("CP-05 [CA-3] el propio mercado informa la licencia y los productos ocultos al público", async ({ page, precargaOperadores: datos }) => {
        await prepararLicencia(datos);
        await ingresarOperador(page, datos);
        await expect(page.getByRole("status").filter({ hasText: "Estas de licencia, productos ocultos al publico" })).toBeVisible();
    });

    test("CP-06 [CA-4] el administrador consulta la licencia con y sin comentario", async ({ page, precargaOperadores: datos }) => {
        await iniciarSesionAdministrador(page, datos.administrador);
        for (const comentario of [recomendacion, null]) {
            await test.step(comentario ? "Con comentario" : "Sin comentario", async () => {
                await prepararLicencia(datos, comentario);
                await page.goto(rutaAdmin(datos));
                await expect(seccionLicencia(page).getByText("Fecha: Fechas no especificadas", { exact: true })).toBeVisible();
                await expect(seccionLicencia(page).getByText(recomendacion, { exact: true })).toHaveCount(comentario ? 1 : 0);
                await expect(page.getByText("No hay licencia registrada.", { exact: true })).toHaveCount(0);
            });
        }
    });

    test("CP-07 [CA-7] el operador ve en su perfil la licencia activada por el administrador", async ({ page, precargaOperadores: datos }) => {
        await iniciarSesionAdministrador(page, datos.administrador);
        await activarLicencia(page, datos);
        await page.getByRole("button", { name: "Abrir menú de usuario", exact: true }).click();
        await page.getByRole("menuitem", { name: "Cerrar sesión", exact: true }).click();
        await expect(page).not.toHaveURL(rutaAdmin(datos));
        await page.goto("/mi-perfil");
        await expect(page).toHaveURL(/\/iniciar-sesion$/);
        await ingresarOperador(page, datos);
        await page.goto("/mi-perfil");
        await expect(seccionLicencia(page).getByText(recomendacion, { exact: true })).toBeVisible();
        await expect(page.getByText("No hay licencia registrada.", { exact: true })).toHaveCount(0);
    });

    test("CP-08 [CA-5] editar el comentario conserva la licencia activa", async ({ page, precargaOperadores: datos }) => {
        await prepararLicencia(datos, `Licencia: ${fecha(1)} - ${fecha(8)}\n\n${recomendacion}`);
        await iniciarSesionAdministrador(page, datos.administrador);
        await abrirEdicion(page, datos);
        const nuevo = "Consultar disponibilidad con el puesto de enfrente.";
        await page.getByLabel("Mensaje de recomendación", { exact: true }).fill(nuevo);
        await guardar(page, datos);
        await expect(seccionLicencia(page).getByText(nuevo, { exact: true })).toBeVisible();
        await expect(page.getByText(recomendacion, { exact: true })).toHaveCount(0);
        expect(await datos.db.orm.public.Operador.where({ id: datos.operadorA.id }).first()).toMatchObject({
            enLicencia: true, comentario: `Licencia: ${fecha(1)} - ${fecha(8)}\n\n${nuevo}`,
        });
    });

    test("CP-09 [CA-5] quitar la licencia elimina el comentario y vuelve a publicar los productos", async ({ page, publico, precargaOperadores: datos }) => {
        await prepararLicencia(datos);
        await publicacionesPublicas(publico, datos, 0);
        await publico.goto(rutaPublica(datos));
        await expect(seccionLicencia(publico).getByText(recomendacion, { exact: true })).toBeVisible();
        await expect(tarjetas(publico)).toHaveCount(0);
        await iniciarSesionAdministrador(page, datos.administrador);
        await abrirEdicion(page, datos);
        await page.getByRole("switch", { name: "En licencia", exact: true }).uncheck();
        await guardar(page, datos);
        await expect(page.getByText("No hay licencia registrada.", { exact: true })).toBeVisible();
        expect(await datos.db.orm.public.Operador.where({ id: datos.operadorA.id }).first()).toMatchObject({ enLicencia: false, comentario: null });
        await publico.goto(rutaPublica(datos));
        await expect(seccionLicencia(publico)).toHaveCount(0);
        await expect(publico.getByText(recomendacion, { exact: true })).toHaveCount(0);
        await expect(tarjetas(publico)).toHaveCount(1);
        await publicacionesPublicas(publico, datos, 1);
    });
});
