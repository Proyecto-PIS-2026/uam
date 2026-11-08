import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { iniciarSesionAdministrador } from "../autenticacion";
import { test, expect, abrirSeccion, imagenPrueba, comprobarImagen } from "./fixtures";

test.setTimeout(120_000);

const tarjeta = (page: Page) => page.getByText("Fotos de especies", { exact: true }).locator("..");
const guardar = (page: Page) => tarjeta(page).getByRole("button", { name: "Guardar cambios", exact: true });

async function buscarEspecie(page: Page, nombre: string) {
    await tarjeta(page).getByRole("combobox", { name: "Especie", exact: true }).fill(nombre);
    await page.getByRole("option", { name: nombre, exact: true }).click();
}

test("CP-18.8-01: cargar, reemplazar y quitar la foto persiste y actualiza Inicio sin cambiar fotos propias", async ({ page, browser, catalogo, precargaOperadores: datos }) => {
    const especie = catalogo.especies[0];
    const publicacionId = catalogo.publicaciones.operador[0];
    const archivoPropio = `${randomUUID()}.png`;
    const fotoPropia = `/api/publicaciones/imagenes/${publicacionId}/${archivoPropio}`;
    await datos.db.orm.public.Imagen.create({ clave: `publicaciones/${publicacionId}/${archivoPropio}`, contenido: await imagenPrueba("blue") });
    await datos.db.orm.public.Publicacion.where({ id: publicacionId }).update({ foto: fotoPropia });
    await iniciarSesionAdministrador(page, datos.administrador);
    await abrirSeccion(page, "General");
    await buscarEspecie(page, especie.nombre);
    await expect(tarjeta(page).getByText("Sin foto", { exact: true })).toBeVisible();
    const publico = await browser.newPage();
    try {
        let anterior: string | null = null;
        for (const color of ["red", "green"]) {
            await tarjeta(page).locator('input[type="file"]').setInputFiles({ name: `${color}.png`, mimeType: "image/png", buffer: await imagenPrueba(color) });
            await expect(tarjeta(page).getByRole("img", { name: `Vista previa de ${especie.nombre}`, exact: true })).toHaveAttribute("src", /^blob:/);
            await guardar(page).click();
            await expect(page.getByRole("status").filter({ hasText: "La foto de la especie se actualizó correctamente." })).toBeVisible();
            await expect(tarjeta(page).getByRole("combobox", { name: "Especie", exact: true })).toBeEnabled();
            await expect(guardar(page)).toBeDisabled();
            await expect.poll(async () => (await datos.db.orm.public.Especie.where({ id: especie.id }).select("fotoEspecie").first())?.fotoEspecie).not.toBe(anterior);
            const foto = (await datos.db.orm.public.Especie.where({ id: especie.id }).select("fotoEspecie").first())!.fotoEspecie!;
            expect(foto).toMatch(new RegExp(`^/api/imagenes/especies/${especie.id}/.+\\.webp$`));
            await page.reload();
            await abrirSeccion(page, "General");
            await buscarEspecie(page, especie.nombre);
            await comprobarImagen(tarjeta(page).getByRole("img", { name: `Foto de ${especie.nombre}`, exact: true }), foto);
            await publico.goto("/inicio");
            await publico.getByRole("searchbox", { name: "Buscar especies", exact: true }).fill(especie.nombre);
            await comprobarImagen(publico.getByRole("img", { name: especie.nombre, exact: true }), foto);
            await publico.goto(`/publicaciones?especie=${encodeURIComponent(especie.nombre)}`);
            await comprobarImagen(publico.getByRole("img", { name: `Foto de ${especie.nombre}`, exact: true }), fotoPropia);
            anterior = foto;
        }
        await tarjeta(page).getByRole("button", { name: "Quitar foto", exact: true }).click();
        await guardar(page).click();
        await expect(tarjeta(page).getByRole("combobox", { name: "Especie", exact: true })).toBeEnabled();
        await expect(guardar(page)).toBeDisabled();
        await page.reload();
        await abrirSeccion(page, "General");
        await buscarEspecie(page, especie.nombre);
        await expect(tarjeta(page).getByText("Sin foto", { exact: true })).toBeVisible();
        expect(await datos.db.orm.public.Especie.where({ id: especie.id }).select("fotoEspecie").first()).toMatchObject({ fotoEspecie: null });
        await publico.goto("/inicio");
        await publico.getByRole("searchbox", { name: "Buscar especies", exact: true }).fill(especie.nombre);
        await expect(publico.getByRole("heading", { name: especie.nombre, exact: true })).toBeVisible();
        await expect(publico.getByRole("img", { name: especie.nombre, exact: true })).toHaveCount(0);
        await publico.goto(`/publicaciones?especie=${encodeURIComponent(especie.nombre)}`);
        await comprobarImagen(publico.getByRole("img", { name: `Foto de ${especie.nombre}`, exact: true }), fotoPropia);
    } finally {
        await publico.close();
    }
});

test("CP-18.8-02: abandonar una foto pendiente no la guarda ni la aplica a otra especie", async ({ page, catalogo, precargaOperadores: datos }) => {
    await iniciarSesionAdministrador(page, datos.administrador);
    await abrirSeccion(page, "General");
    await buscarEspecie(page, catalogo.especies[0].nombre);
    await tarjeta(page).locator('input[type="file"]').setInputFiles({ name: "pendiente.png", mimeType: "image/png", buffer: await imagenPrueba("red") });
    await expect(guardar(page)).toBeEnabled();
    await buscarEspecie(page, catalogo.especies[1].nombre);
    await expect(guardar(page)).toBeDisabled();
    await expect(tarjeta(page).getByRole("img")).toHaveCount(0);
    await page.reload();
    await abrirSeccion(page, "General");
    await buscarEspecie(page, catalogo.especies[0].nombre);
    await expect(tarjeta(page).getByText("Sin foto", { exact: true })).toBeVisible();
    await expect(guardar(page)).toBeDisabled();
    for (const especie of catalogo.especies) {
        expect(await datos.db.orm.public.Especie.where({ id: especie.id }).select("fotoEspecie").first()).toMatchObject({ fotoEspecie: null });
    }
});

test("CP-18.8-03: rechaza un archivo que no es imagen sin modificar la especie", async ({ page, catalogo, precargaOperadores: datos }) => {
    await iniciarSesionAdministrador(page, datos.administrador);
    await abrirSeccion(page, "General");
    await buscarEspecie(page, catalogo.especies[0].nombre);
    await tarjeta(page).locator('input[type="file"]').setInputFiles({ name: "invalida.txt", mimeType: "text/plain", buffer: Buffer.from("Esto no es una imagen") });
    await expect(page.getByRole("alert").filter({ hasText: "La imagen debe ser JPEG, PNG o WebP." })).toBeVisible();
    await expect(guardar(page)).toBeDisabled();
    expect(await datos.db.orm.public.Especie.where({ id: catalogo.especies[0].id }).select("fotoEspecie").first()).toMatchObject({ fotoEspecie: null });
});
