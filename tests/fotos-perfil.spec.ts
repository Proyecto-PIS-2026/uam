import { randomBytes, randomUUID } from "node:crypto";
import { Client } from "pg";
import sharp from "sharp";
import { expect, type Page } from "@playwright/test";
import { test } from "./usuarios-administrativos";
import { iniciarSesionAdministrador, iniciarSesionOperador } from "./autenticacion";

test.setTimeout(60_000);

async function esperarFoto(page: Page, nombre: string, url: string) {
    const foto = page.getByRole("img", { name: `Foto de ${nombre}`, exact: true });
    await expect.poll(async () => new URL((await foto.getAttribute("src")) ?? "", page.url()).pathname).toBe(url);
    await expect.poll(() => foto.evaluate((imagen: HTMLImageElement) => imagen.complete && imagen.naturalWidth > 0)).toBe(true);
}

for (const rol of ["operador", "productor"] as const) {
    test(`Fotos de ${rol}: alta, conservación, reemplazo, cancelación y eliminación`, async ({ page, browser, usuariosAdministrativos }) => {
        const cliente = new Client({ connectionString: process.env.DATABASE_URL });
        await cliente.connect();
        const username = `foto_${rol}_${randomUUID()}`;
        const nombre = `Foto ${rol} ${randomUUID().slice(0, 8)}`;
        const categoria = rol === "operador" ? "operadores" : "productores";
        const png = await sharp(randomBytes(700 * 700 * 3), { raw: { width: 700, height: 700, channels: 3 } }).png().toBuffer();
        const jpeg = await sharp({ create: { width: 240, height: 180, channels: 3, background: "#008332" } }).jpeg().toBuffer();
        expect(png.length).toBeGreaterThan(1024 * 1024);
        const primera = { name: "perfil.png", mimeType: "image/png", buffer: png };
        const segunda = { name: "reemplazo.jpg", mimeType: "image/jpeg", buffer: jpeg };
        const consultar = async () => {
            const resultado = await cliente.query<{ id: number; fotoPerfil: string | null }>(
                `SELECT p.id, p."fotoPerfil" FROM public.${rol} p JOIN public.usuario u ON u.id=p."usuarioId" WHERE u.username=$1`, [username],
            );
            return resultado.rows[0];
        };
        try {
            await iniciarSesionAdministrador(page, usuariosAdministrativos.administrador);
            await page.goto(`/alta-usuario?rol=${rol}`);
            await page.locator("#nombreUsuario").fill(username);
            await page.locator('[id="contraseña"]').fill("FotoPrueba123!");
            await page.locator('[id="confirmacionContraseña"]').fill("FotoPrueba123!");
            await page.locator("#nombre").fill(nombre);
            await page.locator("#numero").fill("99123456");
            if (rol === "operador") {
                await page.getByPlaceholder("Número de local").fill(BigInt(`0x${randomUUID().replaceAll("-", "")}`).toString());
                await page.getByRole("combobox", { name: /^Nave/ }).click();
                await page.getByRole("listbox").getByRole("option").filter({ hasNotText: "Seleccionar nave" }).first().click();
            }
            await page.getByLabel("Seleccionar foto de perfil").setInputFiles(primera);
            await expect(page.getByRole("img", { name: "Vista previa de la foto de perfil" })).toBeVisible();
            await page.getByRole("button", { name: "Registrar usuario", exact: true }).click();
            await expect(page.getByRole("heading", { name: new RegExp(`${rol} creado satisfactoriamente`, "i") })).toBeVisible();
            await page.getByRole("button", { name: "Ahora no" }).click();
            await expect(page.getByRole("img", { name: "Vista previa de la foto de perfil" })).toHaveCount(0);
            const perfil = await consultar();
            expect(perfil.fotoPerfil).toMatch(new RegExp(`^/api/imagenes/${categoria}/${perfil.id}/.+\\.webp$`));
            const fotoInicial = perfil.fotoPerfil!;
            const ruta = `/gestion-${categoria}/${perfil.id}`;
            await page.goto(ruta);
            await esperarFoto(page, nombre, fotoInicial);

            await page.goto(`${ruta}/editar`);
            await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
            await expect(page).toHaveURL(new RegExp(`${ruta}$`));
            expect((await consultar()).fotoPerfil).toBe(fotoInicial);

            await page.goto(`${ruta}/editar`);
            await page.getByLabel("Seleccionar foto de perfil").setInputFiles(segunda);
            await page.goto(ruta);
            expect((await consultar()).fotoPerfil).toBe(fotoInicial);
            await esperarFoto(page, nombre, fotoInicial);

            await page.goto(`${ruta}/editar`);
            await page.getByLabel("Seleccionar foto de perfil").setInputFiles(segunda);
            await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
            await expect(page).toHaveURL(new RegExp(`${ruta}$`));
            const fotoNueva = (await consultar()).fotoPerfil!;
            expect(fotoNueva).not.toBe(fotoInicial);
            await esperarFoto(page, nombre, fotoNueva);
            expect((await page.request.get(fotoInicial)).status()).toBe(404);

            const visitante = await browser.newContext({ baseURL: new URL(page.url()).origin });
            try {
                const respuesta = await visitante.request.get(new URL(fotoNueva, page.url()).href);
                expect(respuesta.status()).toBe(rol === "productor" ? 404 : 200);
                const consulta = await visitante.newPage();
                if (rol === "productor") await iniciarSesionOperador(consulta);
                await consulta.goto(`/${categoria}/${encodeURIComponent(nombre)}`);
                await esperarFoto(consulta, nombre, fotoNueva);
            } finally { await visitante.close(); }

            await page.goto(`${ruta}/editar`);
            await page.getByRole("button", { name: "Quitar foto", exact: true }).click();
            expect((await consultar()).fotoPerfil).toBe(fotoNueva);
            await page.getByRole("button", { name: "Deshacer cambio", exact: true }).click();
            await expect.poll(async () => new URL((await page.getByRole("img", { name: "Vista previa de la foto de perfil" }).getAttribute("src")) ?? "", page.url()).pathname).toBe(fotoNueva);
            await page.getByRole("button", { name: "Quitar foto", exact: true }).click();
            await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
            await expect(page).toHaveURL(new RegExp(`${ruta}$`));
            await page.reload();
            expect((await consultar()).fotoPerfil).toBeNull();
            await expect(page.getByRole("img", { name: `Foto de ${nombre}`, exact: true })).toHaveCount(0);
            expect((await page.request.get(fotoNueva)).status()).toBe(404);

            await page.goto(`${ruta}/editar`);
            await page.getByLabel("Seleccionar foto de perfil").setInputFiles(segunda);
            await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
            await expect(page).toHaveURL(new RegExp(`${ruta}$`));
            await esperarFoto(page, nombre, (await consultar()).fotoPerfil!);
        } finally {
            try {
                const perfil = await consultar();
                await cliente.query("BEGIN");
                if (perfil) {
                    await cliente.query('DELETE FROM public.imagen WHERE clave LIKE $1', [`${categoria}/${perfil.id}/%`]);
                    if (rol === "operador") await cliente.query('DELETE FROM public.local WHERE "operadorId"=$1', [perfil.id]);
                }
                await cliente.query("DELETE FROM public.usuario WHERE username=$1", [username]);
                await cliente.query("COMMIT");
            } finally { await cliente.end(); }
        }
    });
}
