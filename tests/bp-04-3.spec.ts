import { randomBytes, randomUUID } from "node:crypto";
import argon2 from "argon2";
import { config } from "dotenv";
import { Secret, TOTP } from "otpauth";
import postgres from "@prisma/orm-postgres/runtime";
import { test as base, expect as baseExpect, type Page } from "@playwright/test";
import type { Contract } from "../src/infraestructura/persistencia/prisma/contract";
import contractJson from "../src/infraestructura/persistencia/prisma/contract.json" with { type: "json" };
import { cifrarSecreto, generarSecreto } from "../src/modulos/identidad-acceso/autenticacion/segundo-factor-criptografia";
import { iniciarSesionAdministrador } from "./autenticacion";

// Las acciones del servidor hacen argon2 y TOTP: bajo carga superan los 5 s por defecto
// (el proyecto de BP-16 usa el mismo margen).
const expect = baseExpect.configure({ timeout: 15_000 });

type Administrador = { usuario: string; contrasena: string; usuarioId: number; administradorId: number; secreto?: string };
type Fixtures = {
  db: ReturnType<typeof postgres<Contract>>;
  crearAdministrador: (conSegundoFactor: boolean) => Promise<Administrador>;
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
  crearAdministrador: async ({ db }, usar) => {
    const creados: number[] = [];
    try {
      await usar(async (conSegundoFactor) => {
        const sufijo = randomUUID();
        const contrasena = randomBytes(24).toString("hex");
        const usuario = await db.orm.public.Usuario.create({
          username: `e2e_admin_${sufijo}`,
          passwordHash: await argon2.hash(contrasena, { type: argon2.argon2id }),
          rol: "ADMINISTRADOR",
          twoFactorEnabled: false,
        });
        creados.push(usuario.id);
        const email = `e2e_admin_${sufijo}@example.com`;
        const administrador = await db.orm.public.Administrador.create({ usuarioId: usuario.id, email });
        let secreto: string | undefined;
        if (conSegundoFactor) {
          // Se guarda cifrado igual que lo hace la aplicación al confirmar la vinculación.
          secreto = generarSecreto();
          await db.orm.public.Usuario.where({ id: usuario.id }).update({ twoFactorSecret: cifrarSecreto(secreto, usuario.id), twoFactorEnabled: true });
        }
        return { usuario: email, contrasena, usuarioId: usuario.id, administradorId: administrador.id, secreto };
      });
    } finally {
      // La relación Administrador se elimina por cascada.
      for (const id of creados) await db.orm.public.Usuario.where({ id }).delete();
    }
  },
});

const urlLogin = /\/(iniciar-sesion|sesion-finalizada)/;
const urlSegundoFactor = /\/iniciar-sesion\/segundo-factor$/;
const tituloVinculacion = "Configurá la verificación en dos pasos";
const tituloVerificacion = "Verificá tu identidad";
const mensajeCodigoInvalido = "El código es incorrecto, venció o ya fue utilizado.";
const PERIODO = 30_000;

/** Código TOTP del paso actual desplazado `pasos` períodos de 30 s. */
function codigo(secreto: string, pasos = 0) {
  return new TOTP({ secret: Secret.fromBase32(secreto), digits: 6, period: 30, algorithm: "SHA1" })
    .generate({ timestamp: Date.now() + pasos * PERIODO });
}

/**
 * El servidor acepta el paso actual y el anterior. Se excluyen los pasos −1, 0 y +1
 * para que el código siga siendo inválido aunque cambie el período durante el envío.
 */
function codigoIncorrecto(secreto: string) {
  const vigentes = [-1, 0, 1].map((pasos) => codigo(secreto, pasos));
  return ["000000", "111111", "222222", "333333"].find((candidato) => !vigentes.includes(candidato))!;
}

/** Código que fue válido hace tres períodos (90 s): ya venció. */
function codigoVencido(secreto: string) {
  const vigentes = [-1, 0, 1].map((pasos) => codigo(secreto, pasos));
  return [-3, -4, -5].map((pasos) => codigo(secreto, pasos)).find((candidato) => !vigentes.includes(candidato))!;
}

async function ingresarCredenciales(page: Page, admin: Administrador) {
  await page.goto("/iniciar-sesion");
  await page.getByLabel("Correo electrónico o nombre de usuario").fill(admin.usuario);
  await page.getByLabel("Contraseña", { exact: true }).fill(admin.contrasena);
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await expect(page).toHaveURL(urlSegundoFactor, { timeout: 30_000 });
}

async function enviarCodigo(page: Page, valor: string) {
  await page.getByLabel("Código de verificación").fill(valor);
  await page.getByRole("button", { name: /^(Confirmar|Verificar) e ingresar$/ }).click();
}

const notificaciones = (page: Page) => page.getByRole("region", { name: "Notificaciones", exact: true });
const alertaCodigo = (page: Page) => notificaciones(page).getByRole("alert").filter({ hasText: mensajeCodigoInvalido });

async function esperarRechazo(page: Page) {
  await expect(alertaCodigo(page)).toBeVisible();
  await expect(page).toHaveURL(urlSegundoFactor);
}

async function esperarAccesoAdministrativo(page: Page) {
  await expect(page).toHaveURL(/\/inicio$/, { timeout: 30_000 });
  const respuesta = await page.goto("/administracion");
  expect(respuesta?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Panel Administrativo", exact: true, level: 1 })).toBeVisible();
}

async function esperarSinAccesoAdministrativo(page: Page) {
  for (const ruta of ["/administracion", "/alta-usuario"]) {
    await page.goto(ruta);
    await expect(page).toHaveURL(urlLogin);
  }
}

/** Vuelve a la pantalla de verificación con el desafío pendiente de la cookie. */
async function volverAVerificacion(page: Page, titulo: string) {
  await page.goto("/iniciar-sesion/segundo-factor");
  await expect(page.getByRole("heading", { name: titulo })).toBeVisible();
}

async function cerrarSesion(page: Page) {
  await page.getByRole("button", { name: "Abrir menú de usuario", exact: true }).click();
  await page.getByRole("menuitem", { name: "Cerrar sesión", exact: true }).click();
  // /inicio también es la portada pública: se espera a que el servidor dé la sesión por cerrada.
  await expect.poll(async () => (await page.request.get("/api/sesion")).status(), { timeout: 15_000 }).toBe(401);
}

test.describe("BP-04.3: Autenticación con 2FA para los Administradores", () => {
  // Cada caso hace uno o dos ingresos completos (argon2 + TOTP); 30 s no alcanzan en paralelo.
  test.describe.configure({ timeout: 90_000 });

  test("CP-01 [CA-3, CA-4, CA-7] administrador sin 2FA debe configurarlo con un código válido antes de acceder", async ({ page, db, crearAdministrador }) => {
    const admin = await crearAdministrador(false);
    await ingresarCredenciales(page, admin);

    await test.step("CA-3: se ofrece vincular una app compatible con Google Authenticator", async () => {
      await expect(page.getByRole("heading", { name: tituloVinculacion })).toBeVisible();
      await expect(page.getByRole("img", { name: /Código QR/ })).toBeVisible();
      await expect(page.getByText("Abrí Google Authenticator u otra aplicación compatible.")).toBeVisible();
      await expect(page.getByTestId("clave-segundo-factor")).toHaveText(/^[A-Z2-7]{32}$/);
    });

    await test.step("CA-7: sin configurarlo no accede a funciones administrativas", async () => {
      await esperarSinAccesoAdministrativo(page);
      await volverAVerificacion(page, tituloVinculacion);
    });

    const secreto = (await page.getByTestId("clave-segundo-factor").textContent())!;

    await test.step("CA-4: un código inválido no completa la configuración", async () => {
      await enviarCodigo(page, codigoIncorrecto(secreto));
      await esperarRechazo(page);
      await expect(page.getByRole("heading", { name: tituloVinculacion })).toBeVisible();
      const usuario = await db.orm.public.Usuario.where({ id: admin.usuarioId }).first();
      expect(usuario?.twoFactorEnabled).toBe(false);
      expect(usuario?.twoFactorSecret).toBeNull();
    });

    await test.step("CA-4: un código válido completa la configuración y habilita el acceso", async () => {
      await enviarCodigo(page, codigo(secreto));
      await esperarAccesoAdministrativo(page);
      const usuario = await db.orm.public.Usuario.where({ id: admin.usuarioId }).first();
      expect(usuario?.twoFactorEnabled).toBe(true);
      expect(usuario?.twoFactorSecret).toBeTruthy();
      expect(usuario?.twoFactorPendingSecret).toBeNull();
    });
  });

  test("CP-02 [CA-5] cancelar la configuración vuelve al inicio de sesión y descarta la clave", async ({ page, db, crearAdministrador }) => {
    const admin = await crearAdministrador(false);
    await ingresarCredenciales(page, admin);
    await expect(page.getByRole("heading", { name: tituloVinculacion })).toBeVisible();
    const clave = await page.getByTestId("clave-segundo-factor").textContent();

    await page.getByRole("button", { name: "Cancelar y volver al inicio de sesión" }).click();
    await expect(page).toHaveURL(/\/iniciar-sesion\?segundoFactor=cancelado$/);
    await expect(notificaciones(page).getByRole("status")).toHaveText("Cancelaste la verificación en dos pasos. No se inició sesión.");
    const usuario = await db.orm.public.Usuario.where({ id: admin.usuarioId }).first();
    expect(usuario?.twoFactorEnabled).toBe(false);
    expect(usuario?.twoFactorPendingSecret).toBeNull();
    expect(usuario?.twoFactorChallengeHash).toBeNull();
    await esperarSinAccesoAdministrativo(page);

    // Al volver a ingresar se genera una clave nueva; la cancelada ya no sirve.
    await ingresarCredenciales(page, admin);
    await expect(page.getByRole("heading", { name: tituloVinculacion })).toBeVisible();
    await expect(page.getByTestId("clave-segundo-factor")).not.toHaveText(clave!);
    await enviarCodigo(page, codigo(clave!));
    await esperarRechazo(page);
  });

  test("CP-03 [CA-1, CA-6] administrador con 2FA no accede hasta ingresar un código válido", async ({ page, crearAdministrador }) => {
    const admin = await crearAdministrador(true);

    await test.step("CA-1: después del correo y la contraseña se pide el segundo factor", async () => {
      await ingresarCredenciales(page, admin);
      await expect(page.getByRole("heading", { name: tituloVerificacion })).toBeVisible();
      await expect(page.getByLabel("Código de verificación")).toBeVisible();
      await expect(page.getByTestId("clave-segundo-factor")).toHaveCount(0);
    });

    await test.step("CA-6: sin el código no hay acceso a rutas administrativas", async () => {
      await esperarSinAccesoAdministrativo(page);
      await volverAVerificacion(page, tituloVerificacion);
    });

    await test.step("CA-6: con un código válido accede", async () => {
      await enviarCodigo(page, codigo(admin.secreto!));
      await esperarAccesoAdministrativo(page);
    });
  });

  test("CP-04 [CA-8] códigos incorrectos o vencidos muestran un mensaje y no dan acceso", async ({ page, db, crearAdministrador }) => {
    const admin = await crearAdministrador(true);
    await ingresarCredenciales(page, admin);

    await enviarCodigo(page, codigoIncorrecto(admin.secreto!));
    await esperarRechazo(page);
    await expect(alertaCodigo(page)).toContainText("Te quedan 4 intentos.");

    await enviarCodigo(page, codigoVencido(admin.secreto!));
    await esperarRechazo(page);
    await expect(alertaCodigo(page)).toContainText("Te quedan 3 intentos.");

    const usuario = await db.orm.public.Usuario.where({ id: admin.usuarioId }).first();
    expect(usuario?.twoFactorFailedAttempts).toBe(2);
    await esperarSinAccesoAdministrativo(page);
  });

  test("CP-05 [CA-8] un código ya utilizado no permite volver a ingresar", async ({ page, crearAdministrador }) => {
    const admin = await crearAdministrador(true);
    const utilizado = codigo(admin.secreto!);
    await ingresarCredenciales(page, admin);
    await enviarCodigo(page, utilizado);
    await esperarAccesoAdministrativo(page);
    await cerrarSesion(page);

    await ingresarCredenciales(page, admin);
    await enviarCodigo(page, utilizado);
    await esperarRechazo(page);
    await esperarSinAccesoAdministrativo(page);
  });

  test("CP-06 [CA-8] una verificación vencida obliga a iniciar sesión de nuevo", async ({ page, db, crearAdministrador }) => {
    const admin = await crearAdministrador(true);
    await ingresarCredenciales(page, admin);
    await expect(page.getByRole("heading", { name: tituloVerificacion })).toBeVisible();
    // Se vence el desafío en la base para no esperar los 10 minutos reales.
    await db.orm.public.Usuario.where({ id: admin.usuarioId }).update({ twoFactorExpiresAt: 1 });

    await enviarCodigo(page, codigo(admin.secreto!));
    await expect(page).toHaveURL(/\/iniciar-sesion\?segundoFactor=vencido$/);
    await expect(notificaciones(page).getByRole("alert"))
      .toHaveText("Se terminó el tiempo para completar la verificación en dos pasos. Iniciá sesión nuevamente para comenzar.");
    await esperarSinAccesoAdministrativo(page);
  });

  test("CP-07 [CA-9] cancelar la verificación vuelve al inicio de sesión sin funciones administrativas", async ({ page, db, crearAdministrador }) => {
    const admin = await crearAdministrador(true);
    await ingresarCredenciales(page, admin);
    await page.getByRole("button", { name: "Cancelar y volver al inicio de sesión" }).click();
    await expect(page).toHaveURL(/\/iniciar-sesion\?segundoFactor=cancelado$/);
    await expect(notificaciones(page).getByRole("status")).toHaveText("Cancelaste la verificación en dos pasos. No se inició sesión.");
    const usuario = await db.orm.public.Usuario.where({ id: admin.usuarioId }).first();
    expect(usuario?.twoFactorChallengeHash, "El desafío pendiente se descarta").toBeNull();
    expect(usuario?.twoFactorEnabled, "Cancelar no modifica la configuración").toBe(true);

    await page.goto("/publicaciones");
    await expect(page.getByRole("link", { name: "Iniciar sesión", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Administración", exact: true })).toHaveCount(0);
    await esperarSinAccesoAdministrativo(page);
  });

  test("CP-08 [CA-2, CA-3, CA-4] un administrador restablece el 2FA de otro, que debe volver a vincularlo", async ({
    page, browser, baseURL, db, crearAdministrador,
  }) => {
    const admin = await crearAdministrador(true);
    const otro = await crearAdministrador(true);
    const contexto = await browser.newContext({ baseURL });
    try {
      const paginaOtro = await contexto.newPage();
      await ingresarCredenciales(paginaOtro, otro);
      await enviarCodigo(paginaOtro, codigo(otro.secreto!));
      await esperarAccesoAdministrativo(paginaOtro);

      await test.step("CA-2: el administrador no puede restablecer su propio 2FA", async () => {
        await iniciarSesionAdministrador(page, { usuario: admin.usuario, contrasena: admin.contrasena, secretoSegundoFactor: admin.secreto });
        // La ficha propia redirige al perfil personal, que no ofrece restablecer.
        await page.goto(`/gestion-administradores/${admin.administradorId}`);
        await expect(page).toHaveURL(/\/mi-perfil$/);
        await expect(page.getByRole("link", { name: "Editar mi perfil", exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "Restablecer segundo factor" })).toHaveCount(0);
      });

      await test.step("CA-2: restablece el 2FA de otro administrador", async () => {
        await page.goto(`/gestion-administradores/${otro.administradorId}`);
        await expect(page.getByText("Activado", { exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Restablecer segundo factor" }).click();
        await page.getByRole("dialog").getByRole("button", { name: "Restablecer", exact: true }).click();
        await expect(page.getByText("Segundo factor restablecido. El administrador deberá vincular su aplicación al iniciar sesión.")).toBeVisible();
        await expect(page.getByText("No configurado", { exact: true })).toBeVisible();
        const usuario = await db.orm.public.Usuario.where({ id: otro.usuarioId }).first();
        expect(usuario?.twoFactorEnabled).toBe(false);
        expect(usuario?.twoFactorSecret).toBeNull();
      });

      await test.step("La sesión abierta del administrador restablecido deja de valer", async () => {
        await esperarSinAccesoAdministrativo(paginaOtro);
      });

      await test.step("CA-3, CA-4: debe vincular una clave nueva; la anterior no sirve", async () => {
        await ingresarCredenciales(paginaOtro, otro);
        await expect(paginaOtro.getByRole("heading", { name: tituloVinculacion })).toBeVisible();
        const nueva = (await paginaOtro.getByTestId("clave-segundo-factor").textContent())!;
        expect(nueva).not.toBe(otro.secreto);
        const codigoAnterior = codigo(otro.secreto!);
        // Solo se omite si, por azar, ambas claves generan el mismo código en este período.
        if (codigoAnterior !== codigo(nueva) && codigoAnterior !== codigo(nueva, -1)) {
          await enviarCodigo(paginaOtro, codigoAnterior);
          await esperarRechazo(paginaOtro);
        }
        await enviarCodigo(paginaOtro, codigo(nueva));
        await esperarAccesoAdministrativo(paginaOtro);
      });
    } finally {
      await contexto.close();
    }
  });
});
