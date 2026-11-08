import { expect, type Page } from "@playwright/test";
import { iniciarSesionAdministrador } from "../autenticacion";
import { test, abrirSeccion, ingresar } from "./fixtures";

async function buscarUsuario(page: Page, username: string) {
    await page.getByRole("searchbox", { name: "Buscar usuarios", exact: true }).fill(username);
    const fila = page.getByRole("button", { name: username });
    await expect(fila).toHaveCount(1);
    return fila;
}

for (const [indice, rol] of ["OPERADOR", "PRODUCTOR"].entries()) {
    test(`CP-18.12-0${indice + 1}: deshabilitar y rehabilitar ${rol} controla acceso, perfil y publicaciones`, async ({ page, browser, catalogo, precargaOperadores: datos }) => {
        const cuenta = rol === "OPERADOR" ? datos.operadorA : catalogo.productor;
        const usuario = cuenta.credenciales.usuario;
        await iniciarSesionAdministrador(page, datos.administrador);
        await abrirSeccion(page, "Usuarios");
        const fila = await buscarUsuario(page, usuario);
        const propietario = await browser.newPage();
        const consulta = await browser.newPage();
        const login = await browser.newPage();
        try {
            await ingresar(propietario, cuenta.credenciales);
            if (rol === "PRODUCTOR") await ingresar(consulta, datos.operadorB.credenciales);
            const rutaPublicaciones = rol === "OPERADOR" ? "/publicaciones" : "/publicaciones-productor";
            const rutaListado = rol === "OPERADOR" ? "/operadores" : "/productores";
            async function comprobarListado(visible: boolean) {
                await consulta.goto(rutaListado);
                await consulta.getByRole("searchbox", { name: rol === "OPERADOR" ? "Buscar operadores" : "Buscar productores", exact: true }).fill(cuenta.nombre);
                const perfil = consulta.getByRole("link").filter({ has: consulta.getByText(cuenta.nombre, { exact: true }) });
                await expect(perfil).toHaveCount(visible ? 1 : 0);
                await consulta.goto(rutaPublicaciones);
                await consulta.getByRole("searchbox", { name: "Buscar publicaciones", exact: true }).fill(catalogo.prefijo);
                await expect(consulta.getByRole("button", { name: /^Ver detalles de BP18 / })).toHaveCount(visible ? 2 : 0);
            }
            await comprobarListado(true);
            await fila.getByRole("button", { name: "Deshabilitar usuario", exact: true }).click();
            const dialogo = page.getByRole("dialog", { name: "¿Deshabilitar usuario?", exact: true });
            await expect(dialogo).toContainText(`@${usuario}`);
            await dialogo.getByRole("button", { name: "Cancelar", exact: true }).click();
            await expect(dialogo).not.toBeVisible();
            await expect(fila.getByText("Habilitado", { exact: true })).toBeVisible();
            expect(await datos.db.orm.public.Usuario.where({ id: cuenta.usuarioId }).select("habilitado").first()).toMatchObject({ habilitado: true });

            await fila.getByRole("button", { name: "Deshabilitar usuario", exact: true }).click();
            await dialogo.getByRole("button", { name: "Deshabilitar", exact: true }).click();
            await expect(dialogo).not.toBeVisible();
            await expect(fila.getByText("Deshabilitado", { exact: true })).toBeVisible();
            expect(await datos.db.orm.public.Usuario.where({ id: cuenta.usuarioId }).select("habilitado").first()).toMatchObject({ habilitado: false });
            await page.reload();
            await abrirSeccion(page, "Usuarios");
            await buscarUsuario(page, usuario);
            await expect(fila.getByRole("button", { name: "Habilitar usuario", exact: true })).toBeEnabled();
            await comprobarListado(false);
            await propietario.reload();
            await expect(propietario).toHaveURL(/\/iniciar-sesion(?:\?|$)/);
            await login.goto("/iniciar-sesion");
            await login.getByLabel("Correo electrónico o nombre de usuario").fill(usuario);
            await login.getByLabel("Contraseña", { exact: true }).fill(cuenta.credenciales.contrasena);
            await login.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
            await expect(login.getByRole("alert").filter({ hasText: "La cuenta está deshabilitada." })).toHaveText("La cuenta está deshabilitada. Comunicate con un administrador.");

            await fila.getByRole("button", { name: "Habilitar usuario", exact: true }).click();
            const habilitar = page.getByRole("dialog", { name: "¿Habilitar usuario?", exact: true });
            await habilitar.getByRole("button", { name: "Habilitar", exact: true }).click();
            await expect(habilitar).not.toBeVisible();
            await expect(fila.getByText("Habilitado", { exact: true })).toBeVisible();
            expect(await datos.db.orm.public.Usuario.where({ id: cuenta.usuarioId }).select("habilitado").first()).toMatchObject({ habilitado: true });
            await comprobarListado(true);
            await ingresar(login, cuenta.credenciales);
        } finally {
            await propietario.close();
            await consulta.close();
            await login.close();
        }
    });
}

test("CP-18.12-03: el administrador no puede deshabilitar su propia cuenta", async ({ page, precargaOperadores: datos }) => {
    await iniciarSesionAdministrador(page, datos.administrador);
    await abrirSeccion(page, "Usuarios");
    const administrador = await datos.db.orm.public.Administrador.where({ email: datos.administrador.usuario })
        .include("usuario", (u) => u.select("username", "habilitado")).first();
    expect(administrador).not.toBeNull();
    const fila = await buscarUsuario(page, administrador!.usuario.username);
    await expect(fila.getByRole("button", { name: "Deshabilitar usuario", exact: true })).toBeDisabled();
    await expect(fila.getByTitle("No podés deshabilitarte a vos mismo", { exact: true })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Panel Administrativo", exact: true })).toBeVisible();
});
