import { randomBytes, randomUUID } from "node:crypto";
import argon2 from "argon2";
import { config } from "dotenv";
import postgres from "@prisma/orm-postgres/runtime";
import { test as base, expect as baseExpect, type Page, type TestInfo } from "@playwright/test";
import type { Contract } from "../src/infraestructura/persistencia/prisma/contract";
import contractJson from "../src/infraestructura/persistencia/prisma/contract.json" with { type: "json" };
import { iniciarSesionAdministrador, iniciarSesionProductor } from "./autenticacion";
import { conRestablecimientoHabilitado } from "./restablecimiento-contrasena-db";
import { esperarYCerrarNotificacion } from "./soporte/notificaciones";

// BP-11 es la historia integradora del perfil propio. Aquí se prueban los criterios comunes
// a los tres roles y el perfil del Administrador (BP-11.1 y BP-11.2). La edición de
// Productor y Operador se detalla en bp-11-3 y bp-11-5.

// Los ingresos hacen argon2 (y TOTP para el Administrador): bajo carga superan los 5 s por defecto.
const expect = baseExpect.configure({ timeout: 15_000 });

type Rol = "OPERADOR" | "PRODUCTOR" | "ADMINISTRADOR";
type Cuenta = { id: number; rol: Rol; usuario: string; username: string; contrasena: string; nombre: string };
type Fixtures = {
  db: ReturnType<typeof postgres<Contract>>;
  crearCuenta: (rol: Rol) => Promise<Cuenta>;
};

const test = base.extend<Fixtures>({
  db: async ({}, usar) => {
    config({ path: [".env.local", ".env"], quiet: true });
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("Configure DATABASE_URL con la base utilizada por el servidor E2E.");
    const db = postgres<Contract>({ contractJson, url });
    try {
      await usar(db);
    } finally {
      await db.close();
    }
  },
  crearCuenta: async ({ db }, usar) => {
    const usuarios: number[] = [];
    const operadores: number[] = [];
    try {
      await usar(async (rol) => {
        const sufijo = randomUUID().slice(0, 8);
        const username = `e2e_bp11_${sufijo}`;
        const contrasena = randomBytes(16).toString("hex");
        const usuario = await db.orm.public.Usuario.create({
          username,
          passwordHash: await argon2.hash(contrasena, { type: argon2.argon2id }),
          rol,
          twoFactorEnabled: false,
        });
        usuarios.push(usuario.id);
        if (rol === "ADMINISTRADOR") {
          const email = `${username}@example.com`;
          await db.orm.public.Administrador.create({ usuarioId: usuario.id, email });
          return { id: usuario.id, rol, usuario: email, username, contrasena, nombre: username };
        }
        const nombre = `${rol === "OPERADOR" ? "Operador" : "Productor"} BP-11 ${sufijo}`;
        if (rol === "PRODUCTOR") {
          await db.orm.public.Productor.create({ usuarioId: usuario.id, nombreFantasia: nombre, whatsApp: "+59890000000" });
        } else {
          const operador = await db.orm.public.Operador.create({ usuarioId: usuario.id, nombreFantasia: nombre, whatsApp: "+59890000000" });
          operadores.push(operador.id);
          // Sin un local con contrato vigente el Operador no puede iniciar sesión.
          const nave = await db.orm.public.Nave.first();
          if (!nave) throw new Error("La seed E2E debe incluir al menos una nave.");
          await db.orm.public.Local.create({ numeroLocal: username, operadorId: operador.id, naveId: nave.id });
        }
        return { id: usuario.id, rol, usuario: username, username, contrasena, nombre };
      });
    } finally {
      // Los locales no se eliminan en cascada; el resto cuelga del usuario.
      for (const operadorId of operadores) await db.orm.public.Local.where({ operadorId }).delete();
      for (const id of usuarios) await db.orm.public.Usuario.where({ id }).delete();
    }
  },
});

// Grabar el trace de cada caso (retain-on-failure) satura `next dev` con varios workers:
// se usa la configuración del proyecto (trace en el primer reintento).
test.use({
  channel: process.env.PW_USE_EDGE === "1" ? "msedge" : undefined,
  screenshot: "only-on-failure",
});

const urlSinSesion = /\/(?:sesion-finalizada|iniciar-sesion)(?:\?.*)?$/;
const MENSAJE_EXITO = "Perfil actualizado correctamente.";
const perfil = (cuenta: Cuenta) => cuenta.rol === "PRODUCTOR" ? "/mi-perfil/productor" : "/mi-perfil";

/** Campos que cada rol puede editar y campos que no le corresponden. */
const camposPorRol: Record<Rol, { presentes: RegExp[]; ausentes: RegExp[] }> = {
  ADMINISTRADOR: { presentes: [/^Nombre de usuario/], ausentes: [/^Teléfono/, /^En licencia/, /^Correo electrónico/] },
  PRODUCTOR: { presentes: [/^Nombre/, /^Teléfono/], ausentes: [/^En licencia/, /^Nombre de usuario/] },
  OPERADOR: { presentes: [/^Nombre/, /^Teléfono/, /^En licencia/], ausentes: [/^Nombre de usuario/] },
};

/** Perfiles de otros roles: el servidor debe redirigir fuera de ellos. */
const perfilesAjenos: Record<Rol, string[]> = {
  ADMINISTRADOR: ["/mi-perfil/productor", "/mi-perfil/productor/editar"],
  PRODUCTOR: ["/mi-perfil/editar"],
  OPERADOR: ["/mi-perfil/productor", "/mi-perfil/productor/editar", "/mi-perfil/editar"],
};

async function evidencia(page: Page, info: TestInfo, nombre: string) {
  await info.attach(nombre, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
}

async function ingresar(page: Page, cuenta: Cuenta) {
  if (cuenta.rol === "ADMINISTRADOR") {
    await iniciarSesionAdministrador(page, { usuario: cuenta.usuario, contrasena: cuenta.contrasena });
  } else if (cuenta.rol === "PRODUCTOR") {
    await iniciarSesionProductor(page, { usuario: cuenta.usuario, contrasena: cuenta.contrasena });
  } else {
    await page.goto("/iniciar-sesion");
    await page.getByLabel("Correo electrónico o nombre de usuario").fill(cuenta.usuario);
    await page.getByLabel("Contraseña", { exact: true }).fill(cuenta.contrasena);
    await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Mi Mercado", exact: true })).toBeVisible();
  }
}

async function abrirEdicion(page: Page, cuenta: Cuenta) {
  // El Operador edita en la misma página; Productor y Administrador navegan a /editar.
  if (cuenta.rol === "OPERADOR") await page.getByRole("button", { name: "Editar", exact: true }).click();
  else await page.getByRole("link", { name: cuenta.rol === "ADMINISTRADOR" ? "Editar mi perfil" : "Editar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Editar mi perfil", exact: true })).toBeVisible();
}

const datosCuenta = (page: Page) => page.getByRole("region", { name: "Datos de mi cuenta" });
const formularioAdmin = (page: Page) => page.getByRole("form", { name: "Editar mi perfil" });
const campoNombreAdmin = (page: Page) => formularioAdmin(page).getByLabel("Nombre de usuario");
const exito = (page: Page) => page.getByRole("region", { name: "Notificaciones", exact: true }).getByText(MENSAJE_EXITO);

async function username(db: Fixtures["db"], id: number) {
  return (await db.orm.public.Usuario.where({ id }).first())?.username;
}

test.describe("BP-11: Panel de administración de mi perfil", () => {
  // Cada caso hace un ingreso completo (con TOTP para el Administrador) y varias navegaciones.
  test.describe.configure({ timeout: 90_000 });

  test("CP-01 [CA-1] sin sesión no se accede a ningún perfil", async ({ page }) => {
    for (const ruta of ["/mi-perfil", "/mi-perfil/editar", "/mi-perfil/productor", "/mi-perfil/productor/editar"]) {
      await page.goto(ruta);
      await expect(page, `${ruta} exige sesión`).toHaveURL(urlSinSesion);
    }
  });

  for (const [indice, rol] of (["OPERADOR", "PRODUCTOR", "ADMINISTRADOR"] as const).entries()) {
    test(`CP-0${2 + indice} [CA-2, CA-3, CA-4, CA-5, CA-11] consulta y acceso a la edición del perfil propio (${rol})`, async ({ page, crearCuenta }, info) => {
      const cuenta = await crearCuenta(rol);
      await ingresar(page, cuenta);

      await test.step("CA-2: se muestra el perfil de la cuenta que inició sesión", async () => {
        // Abrirlo desde el menú de usuario se prueba en BP-04.
        await page.goto(perfil(cuenta));
        await expect(page).toHaveURL((url) => url.pathname === perfil(cuenta));
        await expect(page.getByRole("heading", { level: 1, name: cuenta.nombre, exact: true })).toBeVisible();
        await expect(page.getByText(cuenta.usuario, { exact: true })).toBeVisible();
      });

      await test.step("CA-3: no se muestran contraseñas ni datos del segundo factor", async () => {
        await expect(page.locator('input[type="password"]')).toHaveCount(0);
        const contenido = await page.content();
        expect(contenido).not.toContain(cuenta.contrasena);
        expect(contenido).not.toContain("$argon2");
        if (rol === "ADMINISTRADOR") await expect(datosCuenta(page)).not.toContainText(/segundo factor|2FA/i);
        await evidencia(page, info, `BP-11-consulta-${rol.toLowerCase()}`);
      });

      await test.step("CA-4, CA-5: desde la consulta se accede a los campos habilitados para el rol", async () => {
        await abrirEdicion(page, cuenta);
        for (const etiqueta of camposPorRol[rol].presentes) await expect(page.getByLabel(etiqueta).first()).toBeVisible();
        for (const etiqueta of camposPorRol[rol].ausentes) await expect(page.getByLabel(etiqueta)).toHaveCount(0);
        await expect(page.locator('input[type="password"]')).toHaveCount(0);
      });

      await test.step("CA-11: no accede a los perfiles de otros roles", async () => {
        for (const ruta of perfilesAjenos[rol]) {
          await page.goto(ruta);
          await expect(page, `${rol} no debe quedarse en ${ruta}`).not.toHaveURL((url) => url.pathname === ruta);
        }
      });
    });
  }

  test("CP-05 [11.1 CA-4, CA-6] el perfil del Administrador ofrece editar y cambiar la contraseña", async ({ page, crearCuenta }) => {
    const administrador = await crearCuenta("ADMINISTRADOR");
    await ingresar(page, administrador);
    // El acceso al cambio de contraseña depende de la configuración global: se fija con el bloqueo compartido.
    await conRestablecimientoHabilitado(async () => {
      await page.goto("/mi-perfil");
      await expect(page.getByRole("link", { name: "Editar mi perfil" })).toHaveAttribute("href", "/mi-perfil/editar");
      await page.getByRole("link", { name: "Cambiar contraseña", exact: true }).click();
      await expect(page).toHaveURL(/\/mi-perfil\/cambiar-contrasena$/);
      await expect(page.getByRole("form", { name: "Cambio de contraseña" }).getByLabel("Contraseña actual", { exact: true }))
        .toHaveAttribute("autocomplete", "current-password");
    });
  });

  test("CP-06 [11.1 CA-5] si no se puede cargar el perfil se informa el problema", async ({ page, db, crearCuenta }) => {
    const administrador = await crearCuenta("ADMINISTRADOR");
    await ingresar(page, administrador);
    // La sesión sigue siendo válida, pero ya no hay datos de Administrador para mostrar.
    await db.orm.public.Administrador.where({ usuarioId: administrador.id }).delete();
    await page.goto("/mi-perfil");
    await esperarYCerrarNotificacion(page, "No se pudieron encontrar los datos de tu perfil. Volvé a intentarlo más tarde.", { timeout: 15_000 });
    await expect(datosCuenta(page)).toHaveCount(0);
  });

  test("CP-07 [11.2 CA-1, CA-2, CA-3, CA-6, CA-7] guardar el nombre lo confirma, persiste y conserva el 2FA", async ({ page, db, crearCuenta }, info) => {
    const administrador = await crearCuenta("ADMINISTRADOR");
    const nombreNuevo = `e2e_bp11_nuevo_${randomUUID().slice(0, 8)}`;
    await ingresar(page, administrador);
    const antes = await db.orm.public.Usuario.where({ id: administrador.id }).first();
    expect(antes?.twoFactorEnabled).toBe(true);

    await test.step("11.2 CA-1: la edición muestra el valor actual", async () => {
      await page.goto("/mi-perfil");
      await abrirEdicion(page, administrador);
      await expect(campoNombreAdmin(page)).toHaveValue(administrador.nombre);
      await expect(formularioAdmin(page).getByLabel("Correo electrónico")).toHaveCount(0);
    });

    await test.step("CA-7: guardar informa la modificación", async () => {
      await campoNombreAdmin(page).fill(nombreNuevo);
      await formularioAdmin(page).getByRole("button", { name: "Guardar cambios", exact: true }).click();
      await expect(exito(page)).toBeVisible();
      await expect(page).toHaveURL(/\/mi-perfil$/);
    });

    await test.step("11.2 CA-2, CA-6: el cambio se ve en la consulta y persiste", async () => {
      await page.reload();
      await expect(datosCuenta(page).getByRole("heading", { level: 1, name: nombreNuevo, exact: true })).toBeVisible();
      await expect(datosCuenta(page)).toContainText(administrador.usuario);
      expect(await username(db, administrador.id)).toBe(nombreNuevo);
      await evidencia(page, info, "BP-11-cambios-persistidos");
    });

    await test.step("11.2 CA-3: editar el perfil no deshabilita el segundo factor", async () => {
      const despues = await db.orm.public.Usuario.where({ id: administrador.id }).first();
      expect(despues?.twoFactorEnabled).toBe(true);
      expect(despues?.twoFactorSecret).toBe(antes?.twoFactorSecret);
      expect(await (await page.request.get("/api/sesion")).status(), "La sesión sigue siendo válida").toBe(204);
    });
  });

  test("CP-08 [CA-8, CA-9, CA-10] errores y cancelación no confirman cambios", async ({ page, db, crearCuenta }, info) => {
    const administrador = await crearCuenta("ADMINISTRADOR");
    const otro = await crearCuenta("ADMINISTRADOR");
    await ingresar(page, administrador);
    await page.goto("/mi-perfil/editar");
    await expect(formularioAdmin(page)).toBeVisible();

    const rechazos = [
      { titulo: "CA-9: nombre demasiado corto", nombre: "ab", error: "El nombre de usuario debe tener al menos 3 caracteres." },
      { titulo: "CA-9: nombre de otra cuenta", nombre: otro.username, error: "Ya existe un usuario con ese nombre." },
    ];
    for (const caso of rechazos) {
      await test.step(caso.titulo, async () => {
        await campoNombreAdmin(page).fill(caso.nombre);
        await formularioAdmin(page).getByRole("button", { name: "Guardar cambios", exact: true }).click();
        await esperarYCerrarNotificacion(page, caso.error, { timeout: 15_000 });
        await expect(exito(page)).toHaveCount(0);
        await expect(page).toHaveURL(/\/mi-perfil\/editar$/);
      });
    }
    await evidencia(page, info, "BP-11-datos-invalidos");

    await test.step("CA-10: si falla el guardado se informa sin mensaje de éxito", async () => {
      // Se corta la petición de guardado (server action) para simular una falla de red o del servidor.
      await page.route("**/mi-perfil/editar", (route) =>
        route.request().method() === "POST" && route.request().headers()["next-action"] ? route.abort() : route.continue());
      await campoNombreAdmin(page).fill(`${administrador.nombre}_falla`);
      await formularioAdmin(page).getByRole("button", { name: "Guardar cambios", exact: true }).click();
      await esperarYCerrarNotificacion(page, "No se pudieron guardar los cambios. Intentá nuevamente.", { timeout: 15_000 });
      await expect(exito(page)).toHaveCount(0);
      await expect(page).toHaveURL(/\/mi-perfil\/editar$/);
      await page.unroute("**/mi-perfil/editar");
    });

    await test.step("CA-8: cancelar conserva los datos anteriores", async () => {
      await campoNombreAdmin(page).fill(`${administrador.nombre}_editado`);
      await formularioAdmin(page).getByRole("button", { name: "Cancelar", exact: true }).click();
      await expect(page).toHaveURL(/\/mi-perfil$/);
      await expect(datosCuenta(page).getByRole("heading", { level: 1, name: administrador.nombre, exact: true })).toBeVisible();
      await expect(datosCuenta(page)).toContainText(administrador.usuario);
      await evidencia(page, info, "BP-11-cancelacion");
    });

    expect(await username(db, administrador.id), "Ningún intento modificó el perfil").toBe(administrador.nombre);
    expect(await username(db, otro.id)).toBe(otro.username);
  });

  test("CP-09 [CA-11, 11.1 CA-1] la edición propia no modifica otra cuenta aunque se manipule la petición", async ({ page, db, crearCuenta }) => {
    const administrador = await crearCuenta("ADMINISTRADOR");
    const otro = await crearCuenta("ADMINISTRADOR");
    const nombreNuevo = `e2e_bp11_propio_${randomUUID().slice(0, 8)}`;
    await ingresar(page, administrador);
    await page.goto("/mi-perfil/editar");

    // La acción no recibe un destinatario: se inyectan los identificadores de la otra cuenta.
    let enviado: unknown;
    await page.route("**/mi-perfil/editar", async (route) => {
      const request = route.request();
      if (request.method() !== "POST" || !request.headers()["next-action"]) return route.continue();
      const datos = JSON.parse(request.postData()!);
      enviado = structuredClone(datos[0]);
      Object.assign(datos[0], { usuarioId: otro.id, id: otro.id, administradorId: otro.id, rol: "ADMINISTRADOR" });
      await route.continue({ postData: JSON.stringify(datos) });
    });
    await campoNombreAdmin(page).fill(nombreNuevo);
    await formularioAdmin(page).getByRole("button", { name: "Guardar cambios", exact: true }).click();
    await expect(exito(page)).toBeVisible();
    expect(enviado, "La petición interceptada debe ser la edición del perfil").toMatchObject({ nombre: nombreNuevo });

    expect(await username(db, otro.id), "La otra cuenta no cambia").toBe(otro.username);
    expect(await username(db, administrador.id), "El cambio se aplica a la cuenta de la sesión").toBe(nombreNuevo);
  });
});
