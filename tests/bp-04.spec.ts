import { createHmac, randomBytes, randomUUID } from "node:crypto";
import argon2 from "argon2";
import { config } from "dotenv";
import postgres from "@prisma/orm-postgres/runtime";
import { test as base, expect as baseExpect, type Page } from "@playwright/test";
import type { Contract } from "../src/infraestructura/persistencia/prisma/contract";
import contractJson from "../src/infraestructura/persistencia/prisma/contract.json" with { type: "json" };
import { iniciarSesionAdministrador, iniciarSesionProductor } from "./autenticacion";
import { conRestablecimientoHabilitado } from "./restablecimiento-contrasena-db";

// BP-04 es la historia integradora de autenticación: el detalle de cada parte vive en
// bp-04-1 (Operador/Productor), bp-04-2 (Administrador), bp-04-3 (2FA), bp-04-4
// (autorización por rol) y bp-04-5 (cierre de sesión). Aquí se recorre el circuito
// completo por rol con cuentas propias, sin depender de las cuentas de la seed.

// Los ingresos hacen argon2 (y TOTP para el Administrador): bajo carga superan los 5 s por defecto.
const expect = baseExpect.configure({ timeout: 15_000 });

type Rol = "OPERADOR" | "PRODUCTOR" | "ADMINISTRADOR";
type Cuenta = {
  id: number;
  rol: Rol;
  /** Identificador de ingreso: username para Operador/Productor, correo para Administrador. */
  usuario: string;
  username: string;
  contrasena: string;
  /** Nombre visible en el perfil. */
  nombre: string;
};
type Fixtures = {
  db: ReturnType<typeof postgres<Contract>>;
  crearCuenta: (rol: Rol, opciones?: { habilitado?: boolean }) => Promise<Cuenta>;
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
      await usar(async (rol, { habilitado = true } = {}) => {
        const sufijo = randomUUID().slice(0, 8);
        const username = `e2e_bp04_${sufijo}`;
        const contrasena = randomBytes(16).toString("hex");
        const usuario = await db.orm.public.Usuario.create({
          username,
          passwordHash: await argon2.hash(contrasena, { type: argon2.argon2id }),
          rol,
          habilitado,
          twoFactorEnabled: false,
        });
        usuarios.push(usuario.id);
        if (rol === "ADMINISTRADOR") {
          const email = `${username}@example.com`;
          await db.orm.public.Administrador.create({ usuarioId: usuario.id, email });
          return { id: usuario.id, rol, usuario: email, username, contrasena, nombre: username };
        }
        const nombre = `${rol === "OPERADOR" ? "Operador" : "Productor"} BP-04 ${sufijo}`;
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

const COOKIE_SESION = "uam_sesion";
/** Igual a `duracionSesionEnSegundos` de sesiones.ts (no se importa: depende de next/headers). */
const DURACION_SESION = 8 * 60 * 60;
const urlSinSesion = /\/(iniciar-sesion|sesion-finalizada)(?:\?|$)/;
const credencialesIncorrectas = "Las credenciales ingresadas no son correctas.";
const cuentaDeshabilitada = "La cuenta está deshabilitada. Comunicate con un administrador.";

const perfil = (cuenta: Cuenta) => cuenta.rol === "PRODUCTOR" ? "/mi-perfil/productor" : "/mi-perfil";

/** Rutas de otros roles: el servidor debe redirigir sin cerrar la sesión. */
const rutasAjenas: Record<Rol, string[]> = {
  OPERADOR: ["/administracion", "/mi-mercado/productor"],
  PRODUCTOR: ["/administracion", "/mi-mercado"],
  ADMINISTRADOR: ["/mi-mercado", "/mi-mercado/productor"],
};

async function cookieSesion(page: Page) {
  return (await page.context().cookies()).find((cookie) => cookie.name === COOKIE_SESION);
}

async function estadoSesion(page: Page) {
  return (await page.request.get("/api/sesion")).status();
}

async function enviarCredenciales(page: Page, usuario: string, contrasena: string) {
  await page.goto("/iniciar-sesion");
  await page.getByLabel("Correo electrónico o nombre de usuario").fill(usuario);
  await page.getByLabel("Contraseña", { exact: true }).fill(contrasena);
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
}

async function esperarIngresoRechazado(page: Page, mensaje: string) {
  await expect(page.getByRole("region", { name: "Notificaciones", exact: true }).getByRole("alert")).toHaveText(mensaje);
  await expect(page).toHaveURL(/\/iniciar-sesion$/);
  expect(await cookieSesion(page)).toBeUndefined();
}

/** CA-1 y CA-4: ingresa con el identificador del rol y llega a su vista principal. */
async function ingresar(page: Page, cuenta: Cuenta) {
  if (cuenta.rol === "ADMINISTRADOR") {
    // Completa el segundo factor y verifica /inicio y el panel administrativo.
    await iniciarSesionAdministrador(page, { usuario: cuenta.usuario, contrasena: cuenta.contrasena });
    await page.goto("/inicio");
    await expect(page.getByRole("navigation", { name: "Navegación principal" })
      .getByRole("link", { name: "Administración", exact: true })).toBeVisible();
  } else if (cuenta.rol === "PRODUCTOR") {
    await iniciarSesionProductor(page, { usuario: cuenta.usuario, contrasena: cuenta.contrasena });
  } else {
    await enviarCredenciales(page, cuenta.usuario, cuenta.contrasena);
    // El mercado del Operador se identifica por su nombre de fantasía.
    await expect(page).toHaveURL((url) => url.pathname === `/mi-mercado/${encodeURIComponent(cuenta.nombre)}`);
    await expect(page.getByRole("heading", { name: "Mi Mercado", exact: true })).toBeVisible();
  }
}

/**
 * Abre una ruta protegida y espera quedar fuera de la sesión. Mi Mercado consulta
 * /api/sesion y redirige por su cuenta al recibir 401, lo que puede abortar el goto.
 */
async function esperarSinSesion(page: Page, ruta: string) {
  await expect(async () => {
    if (!urlSinSesion.test(page.url())) await page.goto(ruta);
    await expect(page).toHaveURL(urlSinSesion, { timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
}

async function cerrarSesion(page: Page) {
  await page.getByRole("button", { name: "Abrir menú de usuario", exact: true }).click();
  await page.getByRole("menuitem", { name: "Cerrar sesión", exact: true }).click();
  await expect(page).toHaveURL(/\/inicio$/);
  await expect.poll(() => estadoSesion(page)).toBe(401);
}

test.describe("BP-04: Autenticación y autorización", () => {
  // Cada recorrido hace un ingreso completo y varias navegaciones.
  test.describe.configure({ timeout: 90_000 });

  for (const [indice, rol] of (["OPERADOR", "PRODUCTOR", "ADMINISTRADOR"] as const).entries()) {
    test(`CP-0${indice + 1} [CA-1, CA-4, CA-5, CA-7] recorrido completo de la sesión (${rol})`, async ({ page, crearCuenta }) => {
      const cuenta = await crearCuenta(rol);

      await test.step("CA-1, CA-4: ingresa y llega a su vista principal", async () => {
        await ingresar(page, cuenta);
        expect(await estadoSesion(page)).toBe(204);
      });

      await test.step("CA-4: el perfil muestra su identidad", async () => {
        await page.getByRole("button", { name: "Abrir menú de usuario", exact: true }).click();
        await page.getByRole("menuitem", { name: "Mi perfil", exact: true }).click();
        await expect(page).toHaveURL((url) => url.pathname === perfil(cuenta));
        await expect(page.getByRole("heading", { level: 1, name: cuenta.nombre, exact: true })).toBeVisible();
        await expect(page.getByText(cuenta.usuario, { exact: true })).toBeVisible();
      });

      await test.step("CA-4: no accede a funciones de otros roles", async () => {
        for (const ruta of rutasAjenas[rol]) {
          await page.goto(ruta);
          await expect(page, `${rol} no debe quedarse en ${ruta}`).not.toHaveURL((url) => url.pathname === ruta);
        }
        expect(await estadoSesion(page), "La redirección no cierra la sesión").toBe(204);
      });

      await test.step("CA-5: la sesión dura 8 horas y se mantiene al navegar y recargar", async () => {
        const cookie = await cookieSesion(page);
        expect(cookie, "Debe existir la cookie de sesión").toBeDefined();
        expect(cookie!.httpOnly).toBe(true);
        const restante = cookie!.expires - Date.now() / 1000;
        expect(restante).toBeGreaterThan(DURACION_SESION - 5 * 60);
        expect(restante).toBeLessThanOrEqual(DURACION_SESION + 5);
        await page.goto("/precios-referencia");
        await page.goto(perfil(cuenta));
        await page.reload();
        await expect(page).toHaveURL((url) => url.pathname === perfil(cuenta));
        await expect(page.getByRole("heading", { level: 1, name: cuenta.nombre, exact: true })).toBeVisible();
      });

      await test.step("CA-7: cierra sesión desde una pantalla secundaria", async () => {
        const anterior = (await cookieSesion(page))!;
        await page.goto("/precios-referencia");
        await cerrarSesion(page);
        expect(await cookieSesion(page)).toBeUndefined();

        await page.goBack();
        await esperarSinSesion(page, perfil(cuenta));
        await page.context().addCookies([anterior]);
        expect(await estadoSesion(page), "La cookie anterior quedó revocada").toBe(401);
      });
    });
  }

  test("CP-04 [CA-2] el Administrador no obtiene sesión sin completar el segundo factor", async ({ page, crearCuenta }) => {
    const administrador = await crearCuenta("ADMINISTRADOR");
    await enviarCredenciales(page, administrador.usuario, administrador.contrasena);
    await expect(page).toHaveURL(/\/iniciar-sesion\/segundo-factor$/);
    expect(await estadoSesion(page)).toBe(401);
    expect(await cookieSesion(page)).toBeUndefined();
    await page.goto("/administracion");
    await expect(page).toHaveURL(urlSinSesion);
  });

  test("CP-05 [CA-1, CA-3] credenciales incorrectas no inician sesión", async ({ page, crearCuenta }) => {
    const operador = await crearCuenta("OPERADOR");
    const administrador = await crearCuenta("ADMINISTRADOR");

    await test.step("Contraseña incorrecta", async () => {
      await enviarCredenciales(page, operador.usuario, "Incorrecta_123");
      await esperarIngresoRechazado(page, credencialesIncorrectas);
    });
    await test.step("Usuario inexistente", async () => {
      await enviarCredenciales(page, `e2e_bp04_inexistente_${randomUUID()}`, "Incorrecta_123");
      await esperarIngresoRechazado(page, credencialesIncorrectas);
    });
    await test.step("CA-1: el Administrador ingresa con correo, no con nombre de usuario", async () => {
      await enviarCredenciales(page, administrador.username, administrador.contrasena);
      await esperarIngresoRechazado(page, credencialesIncorrectas);
    });
  });

  test("CP-06 [CA-3] cuentas dadas de baja no inician sesión", async ({ page, crearCuenta }) => {
    for (const rol of ["OPERADOR", "PRODUCTOR", "ADMINISTRADOR"] as const) {
      await test.step(rol, async () => {
        const cuenta = await crearCuenta(rol, { habilitado: false });
        await enviarCredenciales(page, cuenta.usuario, cuenta.contrasena);
        await esperarIngresoRechazado(page, cuentaDeshabilitada);
      });
    }
  });

  test("CP-07 [CA-3, CA-5] dar de baja una cuenta con la sesión abierta corta el acceso", async ({ page, db, crearCuenta }) => {
    const operador = await crearCuenta("OPERADOR");
    await ingresar(page, operador);
    await db.orm.public.Usuario.where({ id: operador.id }).update({ habilitado: false });
    expect(await estadoSesion(page)).toBe(401);
    await esperarSinSesion(page, perfil(operador));
  });

  test("CP-08 [CA-5] sin una cookie válida no se mantiene la sesión", async ({ page, crearCuenta }) => {
    const secreto = process.env.SESSION_SECRET;
    if (!secreto) throw new Error("Configure SESSION_SECRET igual que en el servidor E2E.");
    const firmar = (contenido: string) => createHmac("sha256", secreto).update(contenido).digest("base64url");

    const operador = await crearCuenta("OPERADOR");
    await ingresar(page, operador);
    const original = (await cookieSesion(page))!;
    const [contenido, firma] = original.value.split(".");
    const datos = JSON.parse(Buffer.from(contenido, "base64url").toString("utf8"));

    async function probar(valor: string | null) {
      await page.context().clearCookies({ name: COOKIE_SESION });
      if (valor) await page.context().addCookies([{ ...original, value: valor }]);
      expect(await estadoSesion(page)).toBe(401);
      await esperarSinSesion(page, perfil(operador));
      await expect(page.getByRole("button", { name: "Abrir menú de usuario" })).toHaveCount(0);
    }

    await test.step("Cookie eliminada", () => probar(null));
    await test.step("Cookie firmada pero vencida", async () => {
      const vencida = Buffer.from(JSON.stringify({ ...datos, expiraEn: Math.floor(Date.now() / 1000) - 60 })).toString("base64url");
      await probar(`${vencida}.${firmar(vencida)}`);
    });
    await test.step("Cookie con el vencimiento extendido y la firma original", async () => {
      const extendida = Buffer.from(JSON.stringify({ ...datos, expiraEn: datos.expiraEn + 86_400 })).toString("base64url");
      await probar(`${extendida}.${firma}`);
    });
  });

  test("CP-09 [CA-6] desde el inicio de sesión se puede pedir la recuperación de la contraseña", async ({ page }) => {
    // La opción depende de la configuración global: se fija habilitada con el bloqueo compartido.
    await conRestablecimientoHabilitado(async () => {
      await page.goto("/iniciar-sesion");
      await page.getByRole("button", { name: "Solicitar recuperación de contraseña", exact: true }).click();
      const dialogo = page.getByRole("dialog", { name: "Solicitar recuperación de contraseña", exact: true });
      await expect(dialogo.getByRole("textbox", { name: "Nombre de usuario", exact: true })).toBeVisible();
      await dialogo.getByRole("button", { name: "Cancelar", exact: true }).click();
      await expect(dialogo).toHaveCount(0);
    });
  });
});
