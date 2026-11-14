import { createHmac, randomBytes, randomUUID } from "node:crypto";
import argon2 from "argon2";
import { config } from "dotenv";
import postgres from "@prisma/orm-postgres/runtime";
import { expect, type Page } from "@playwright/test";
import type { Contract } from "../src/infraestructura/persistencia/prisma/contract";
import contractJson from "../src/infraestructura/persistencia/prisma/contract.json" with { type: "json" };
import { test } from "./usuarios-administrativos";
import { iniciarSesionAdministrador, iniciarSesionOperador, iniciarSesionProductor, type Credenciales } from "./autenticacion";

const COOKIE_SESION = "uam_sesion";
const DURACION_SESION = 8 * 60 * 60;
const urlSinSesion = /\/(iniciar-sesion|sesion-finalizada)(?:\?|$)/;

type Rol = "Operador" | "Productor" | "Administrador";

type Escenario = {
  iniciar: (page: Page) => Promise<void>;
  /** Pantallas permitidas para navegar con la sesión activa. */
  permitidas: { ruta: string; titulo: string | RegExp }[];
  /** Pantalla protegida para recargar y borrar cookies. */
  protegida: string;
  /** Identidad que se debe ver en Mi perfil. */
  identidad: (page: Page) => Promise<void>;
  /** Acción permitida que se resuelve en el servidor con la sesión. */
  accion: (page: Page) => Promise<void>;
};

function credencialesSeed(rol: "OPERADOR" | "PRODUCTOR"): Credenciales {
  const usuario = process.env[`E2E_${rol}_USU`];
  const contrasena = process.env[`E2E_${rol}_PASS`];
  if (!usuario || !contrasena) throw new Error(`Configure E2E_${rol}_USU con la cuenta de la seed.`);
  return { usuario, contrasena };
}

function escenarios(administrador: Credenciales): Record<Rol, Escenario> {
  const operador = credencialesSeed("OPERADOR");
  const productor = credencialesSeed("PRODUCTOR");
  return {
    Operador: {
      iniciar: (page) => iniciarSesionOperador(page),
      permitidas: [
        { ruta: "/mi-perfil", titulo: /.+/ },
        { ruta: "/precios-referencia", titulo: "Precios de referencia" },
      ],
      protegida: "/mi-perfil",
      identidad: async (page) => {
        await expect(page.getByText(operador.usuario, { exact: true })).toBeVisible();
      },
      accion: async (page) => {
        // Con sesión de Operador el servidor devuelve solo su propio catálogo.
        const respuesta = await page.request.get("/api/publicaciones");
        expect(respuesta.status()).toBe(200);
        const { operadores } = await respuesta.json();
        expect(operadores).toHaveLength(1);
        await page.goto("/publicaciones/nueva");
        await expect(page.getByRole("dialog", { name: "Nueva publicación" })).toBeVisible();
      },
    },
    Productor: {
      iniciar: (page) => iniciarSesionProductor(page, productor),
      permitidas: [
        { ruta: "/mi-perfil/productor", titulo: /.+/ },
        { ruta: "/precios-referencia", titulo: "Precios de referencia" },
        { ruta: "/mi-mercado/productor", titulo: "Mi Mercado" },
      ],
      protegida: "/mi-perfil/productor",
      identidad: async (page) => {
        await expect(page.getByText(productor.usuario, { exact: true })).toBeVisible();
      },
      accion: async (page) => {
        await page.goto("/mi-perfil/productor/editar");
        await expect(page).toHaveURL(/\/mi-perfil\/productor\/editar$/);
        await expect(page.getByRole("button", { name: /Guardar/ })).toBeVisible();
      },
    },
    Administrador: {
      iniciar: (page) => iniciarSesionAdministrador(page, administrador),
      permitidas: [
        { ruta: "/inicio", titulo: "Mercado de hoy" },
        { ruta: "/alta-usuario", titulo: "Alta de usuario" },
        { ruta: "/mi-perfil", titulo: /^e2e_admin_/ },
      ],
      protegida: "/administracion",
      identidad: async (page) => {
        await expect(page.getByRole("heading", { level: 1, name: /^e2e_admin_/ })).toBeVisible();
        await expect(page.getByText(administrador.usuario, { exact: true })).toBeVisible();
      },
      accion: async (page) => {
        await page.goto("/alta-usuario");
        await expect(page.getByRole("heading", { name: "Alta de usuario", exact: true })).toBeVisible();
      },
    },
  };
}

async function cookieSesion(page: Page) {
  return (await page.context().cookies()).find((cookie) => cookie.name === COOKIE_SESION);
}

async function abrirMiPerfil(page: Page) {
  await page.getByRole("button", { name: "Abrir menú de usuario" }).click();
  await page.getByRole("menuitem", { name: "Mi perfil" }).click();
  await expect(page).toHaveURL(/\/mi-perfil(\/productor)?$/);
}

const roles: Rol[] = ["Operador", "Productor", "Administrador"];

for (const rol of roles) {
  test(`BP-04 CA-5 CP-01: la sesión de ${rol} se mantiene al navegar y recargar`, async ({ page, usuariosAdministrativos }) => {
    test.slow();
    const escenario = escenarios(usuariosAdministrativos.administrador)[rol];

    await test.step("Iniciar sesión", async () => {
      await escenario.iniciar(page);
      const cookie = await cookieSesion(page);
      expect(cookie, "debe existir la cookie de sesión").toBeDefined();
      expect(cookie!.httpOnly).toBe(true);
      // La sesión dura un tiempo determinado (8 horas).
      const restante = cookie!.expires - Date.now() / 1000;
      expect(restante).toBeGreaterThan(DURACION_SESION - 5 * 60);
      expect(restante).toBeLessThanOrEqual(DURACION_SESION + 5);
    });

    await test.step("Navegar entre pantallas permitidas", async () => {
      for (const { ruta, titulo } of escenario.permitidas) {
        await page.goto(ruta);
        await expect(page).toHaveURL((url) => url.pathname === ruta);
        await expect(page.getByRole("heading", { level: 1, name: titulo }).first()).toBeVisible();
      }
    });

    await test.step("Recargar una pantalla protegida y verificar la identidad", async () => {
      await page.goto(escenario.protegida);
      await page.reload();
      await expect(page).toHaveURL((url) => url.pathname === escenario.protegida);
      await abrirMiPerfil(page);
      await page.reload();
      await escenario.identidad(page);
      expect((await page.request.get("/api/sesion")).status()).toBe(204);
    });

    await test.step("Realizar una acción permitida sin volver a autenticarse", async () => {
      await escenario.accion(page);
      await expect(page).not.toHaveURL(urlSinSesion);
    });
  });

  test(`BP-04 CA-5 CP-02: sin la cookie de sesión de ${rol} no se usan funciones protegidas`, async ({ page, usuariosAdministrativos }) => {
    test.slow();
    const escenario = escenarios(usuariosAdministrativos.administrador)[rol];
    await escenario.iniciar(page);
    await page.goto(escenario.protegida);
    await expect(page).toHaveURL((url) => url.pathname === escenario.protegida);

    await test.step("Eliminar la cookie de sesión", async () => {
      await page.context().clearCookies({ name: COOKIE_SESION });
      expect(await cookieSesion(page)).toBeUndefined();
    });

    await test.step("Recargar la pantalla protegida", async () => {
      await page.reload();
      await expect(page).toHaveURL(urlSinSesion);
      await expect(page.getByRole("button", { name: "Abrir menú de usuario" })).toHaveCount(0);
    });

    await test.step("Acceder directamente a las rutas protegidas", async () => {
      for (const ruta of [escenario.protegida, ...escenario.permitidas.map((p) => p.ruta)]) {
        if (["/inicio", "/precios-referencia"].includes(ruta)) continue; // son públicas
        await page.goto(ruta);
        await expect(page).toHaveURL(urlSinSesion);
      }
      expect((await page.request.get("/api/sesion")).status()).toBe(401);
    });
  });
}

test("BP-04 CA-4 CP-03: el Administrador llega a su vista principal y ve su identidad", async ({ page, usuariosAdministrativos }) => {
  test.slow();
  const administrador = usuariosAdministrativos.administrador;

  // iniciarSesionAdministrador completa el segundo factor y verifica la redirección a /inicio.
  await iniciarSesionAdministrador(page, administrador);
  await page.goto("/inicio");
  await expect(page).toHaveURL(/\/inicio$/);
  await expect(page.getByRole("navigation", { name: "Navegación principal" })
    .getByRole("link", { name: "Administración", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Abrir menú de usuario" })).toBeVisible();

  await abrirMiPerfil(page);
  await expect(page.getByRole("heading", { level: 1, name: /^e2e_admin_/ })).toBeVisible();
  await expect(page.getByText(administrador.usuario, { exact: true })).toBeVisible();
  await expect(page.getByText("Administrador", { exact: true })).toBeVisible();
});

// ---------------------------------------------------------------------------
// Casos propuestos (no están en la matriz): conectan BP-04 con lo que verifica el servidor.
// ---------------------------------------------------------------------------

function firmar(contenido: string) {
  const secreto = process.env.SESSION_SECRET;
  if (!secreto) throw new Error("Configure SESSION_SECRET igual que en el servidor E2E.");
  return createHmac("sha256", secreto).update(contenido).digest("base64url");
}

test("BP-04 CA-5 CP-04 (propuesto): una cookie vencida o alterada no mantiene la sesión", async ({ page }) => {
  await iniciarSesionOperador(page);
  const original = (await cookieSesion(page))!;
  const [contenido] = original.value.split(".");
  const datos = JSON.parse(Buffer.from(contenido, "base64url").toString("utf8"));

  async function probar(valor: string) {
    await page.context().clearCookies({ name: COOKIE_SESION });
    await page.context().addCookies([{ ...original, value: valor }]);
    expect((await page.request.get("/api/sesion")).status()).toBe(401);
    await page.goto("/mi-perfil");
    await expect(page).toHaveURL(urlSinSesion);
  }

  await test.step("Cookie firmada pero vencida", async () => {
    const vencida = Buffer.from(JSON.stringify({ ...datos, expiraEn: Math.floor(Date.now() / 1000) - 60 })).toString("base64url");
    await probar(`${vencida}.${firmar(vencida)}`);
  });

  await test.step("Cookie con el vencimiento extendido sin firma válida", async () => {
    const extendida = Buffer.from(JSON.stringify({ ...datos, expiraEn: datos.expiraEn + 86_400 })).toString("base64url");
    await probar(`${extendida}.${original.value.split(".")[1]}`);
  });
});

test.describe("BP-04 CA-3 CP-05 (propuesto): cuentas deshabilitadas", () => {
  let db: ReturnType<typeof postgres<Contract>>;
  const creados: number[] = [];

  test.beforeAll(() => {
    config({ path: [".env.local", ".env"], quiet: true });
    db = postgres<Contract>({ contractJson, url: process.env.DATABASE_URL! });
  });
  test.afterAll(async () => {
    for (const id of creados) await db.orm.public.Usuario.where({ id }).delete();
    await db.close();
  });

  async function crear(rol: "ADMINISTRADOR" | "PRODUCTOR") {
    const sufijo = randomUUID();
    const contrasena = randomBytes(16).toString("hex");
    const usuario = await db.orm.public.Usuario.create({
      username: `e2e_baja_${sufijo}`,
      passwordHash: await argon2.hash(contrasena, { type: argon2.argon2id }),
      rol,
      twoFactorEnabled: false,
    });
    creados.push(usuario.id);
    if (rol === "ADMINISTRADOR") {
      const email = `e2e_baja_${sufijo}@example.com`;
      await db.orm.public.Administrador.create({ usuarioId: usuario.id, email });
      return { id: usuario.id, usuario: email, contrasena };
    }
    await db.orm.public.Productor.create({ usuarioId: usuario.id, nombreFantasia: `Productor baja ${usuario.id}`, whatsApp: "+59890000000" });
    return { id: usuario.id, usuario: usuario.username, contrasena };
  }

  for (const rol of ["ADMINISTRADOR", "PRODUCTOR"] as const) {
    test(`${rol === "ADMINISTRADOR" ? "Administrador" : "Productor"} dado de baja no inicia sesión`, async ({ page }) => {
      const cuenta = await crear(rol);
      await db.orm.public.Usuario.where({ id: cuenta.id }).update({ habilitado: false });

      await page.goto("/iniciar-sesion");
      await page.getByLabel("Correo electrónico o nombre de usuario").fill(cuenta.usuario);
      await page.getByLabel("Contraseña", { exact: true }).fill(cuenta.contrasena);
      await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
      await expect(page.getByRole("region", { name: "Notificaciones", exact: true }).getByRole("alert"))
        .toHaveText("La cuenta está deshabilitada. Comunicate con un administrador.");
      await expect(page).toHaveURL(/\/iniciar-sesion$/);
      expect(await cookieSesion(page)).toBeUndefined();
    });
  }

  test("Productor dado de baja con la sesión abierta pierde el acceso", async ({ page }) => {
    const cuenta = await crear("PRODUCTOR");
    await iniciarSesionProductor(page, cuenta);
    await db.orm.public.Usuario.where({ id: cuenta.id }).update({ habilitado: false });
    await page.reload();
    await expect(page).toHaveURL(urlSinSesion);
    expect((await page.request.get("/api/sesion")).status()).toBe(401);
  });
});

for (const rol of ["Productor", "Administrador"] as const) {
  test(`BP-04 CA-7 CP-06 (propuesto): el ${rol} cierra sesión desde una pantalla secundaria`, async ({ page, usuariosAdministrativos }) => {
    test.slow();
    const escenario = escenarios(usuariosAdministrativos.administrador)[rol];
    await escenario.iniciar(page);
    const anterior = (await cookieSesion(page))!;
    await page.goto("/precios-referencia");

    await page.getByRole("button", { name: "Abrir menú de usuario" }).click();
    await page.getByRole("menuitem", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/inicio$/);
    expect(await cookieSesion(page)).toBeUndefined();

    // Volver atrás o reutilizar la cookie no recupera el acceso; lo público sigue disponible.
    await page.goBack();
    await page.goto(escenario.protegida);
    await expect(page).toHaveURL(urlSinSesion);
    await page.context().addCookies([anterior]);
    expect((await page.request.get("/api/sesion")).status()).toBe(401);
    const publica = await page.goto("/precios-referencia");
    expect(publica?.status()).toBe(200);
  });
}
