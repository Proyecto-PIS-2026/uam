import { randomBytes, randomUUID } from "node:crypto";
import argon2 from "argon2";
import { config } from "dotenv";
import { Secret, TOTP } from "otpauth";
import postgres from "@prisma/orm-postgres/runtime";
import { test as base, expect, type Page } from "@playwright/test";
import type { Contract } from "../src/infraestructura/persistencia/prisma/contract";
import contractJson from "../src/infraestructura/persistencia/prisma/contract.json" with { type: "json" };
import { cifrarSecreto, generarSecreto } from "../src/modulos/identidad-acceso/autenticacion/segundo-factor-criptografia";
import { iniciarSesionAdministrador } from "./autenticacion";

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
    await usar(db);
    await db.close();
  },
  crearAdministrador: async ({ db }, usar) => {
    const creados: number[] = [];
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
    // La relación Administrador se elimina por cascada.
    for (const id of creados) await db.orm.public.Usuario.where({ id }).delete();
  },
});

const urlLogin = /\/(iniciar-sesion|sesion-finalizada)/;
const urlSegundoFactor = /\/iniciar-sesion\/segundo-factor$/;

function codigoValido(secreto: string) {
  return new TOTP({ secret: Secret.fromBase32(secreto), digits: 6, period: 30, algorithm: "SHA1" }).generate();
}

function codigoIncorrecto(secreto: string) {
  const totp = new TOTP({ secret: Secret.fromBase32(secreto), digits: 6, period: 30, algorithm: "SHA1" });
  const validos = [totp.generate(), totp.generate({ timestamp: Date.now() - 30_000 })];
  return ["000000", "111111", "222222"].find((codigo) => !validos.includes(codigo))!;
}

async function ingresarCredenciales(page: Page, admin: Administrador) {
  await page.goto("/iniciar-sesion");
  await page.getByLabel("Correo electrónico o nombre de usuario").fill(admin.usuario);
  await page.getByLabel("Contraseña", { exact: true }).fill(admin.contrasena);
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await expect(page).toHaveURL(urlSegundoFactor, { timeout: 30_000 });
}

async function esperarSinAccesoAdministrativo(page: Page) {
  for (const ruta of ["/administracion", "/alta-usuario"]) {
    await page.goto(ruta);
    await expect(page).toHaveURL(urlLogin);
  }
}

test("CP-01 y CP-04: administrador sin 2FA debe configurarlo antes de acceder (CA-3, CA-4, CA-7)", async ({ page, db, crearAdministrador }) => {
  const admin = await crearAdministrador(false);

  // CP-01: se pide configurar el segundo factor y no hay acceso a pantallas protegidas.
  await ingresarCredenciales(page, admin);
  await expect(page.getByRole("heading", { name: "Configurá la verificación en dos pasos" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Código QR/ })).toBeVisible();
  await expect(page.getByText("Abrí Google Authenticator u otra aplicación compatible.")).toBeVisible();
  await esperarSinAccesoAdministrativo(page);

  // CP-04: con un código válido de la app se completa la configuración y se accede.
  await iniciarSesionAdministrador(page, admin);
  const usuario = await db.orm.public.Usuario.where({ id: admin.usuarioId }).first();
  expect(usuario?.twoFactorEnabled).toBe(true);
  expect(usuario?.twoFactorSecret).toBeTruthy();
});

test("CP-05, CP-07, CP-10 y CP-06: administrador con 2FA necesita un código válido (CA-1, CA-6, CA-8)", async ({ page, crearAdministrador }) => {
  const admin = await crearAdministrador(true);

  // CP-05: después de usuario y contraseña se pide el segundo factor (sin mostrar QR).
  await ingresarCredenciales(page, admin);
  await expect(page.getByRole("heading", { name: "Verificá tu identidad" })).toBeVisible();
  await expect(page.getByTestId("clave-segundo-factor")).toHaveCount(0);

  // CP-07: código incorrecto muestra mensaje y no da acceso.
  await page.getByLabel("Código de verificación").fill(codigoIncorrecto(admin.secreto!));
  await page.getByRole("button", { name: "Verificar e ingresar" }).click();
  await expect(page.getByText("El código es incorrecto, venció o ya fue utilizado.")).toBeVisible();
  await expect(page).toHaveURL(urlSegundoFactor);

  // CP-10: antes de verificar no se puede entrar a rutas administrativas.
  await esperarSinAccesoAdministrativo(page);

  // CP-06: con un código válido se accede.
  await ingresarCredenciales(page, admin);
  await page.getByLabel("Código de verificación").fill(codigoValido(admin.secreto!));
  await page.getByRole("button", { name: "Verificar e ingresar" }).click();
  await expect(page).toHaveURL(/\/inicio$/, { timeout: 30_000 });
  const respuesta = await page.goto("/administracion");
  expect(respuesta?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Panel Administrativo", exact: true, level: 1 })).toBeVisible();
});

test("CP-09: cancelar la verificación vuelve al login sin sesión (CA-9)", async ({ page, crearAdministrador }) => {
  const admin = await crearAdministrador(true);

  await ingresarCredenciales(page, admin);
  await page.getByRole("button", { name: "Cancelar y volver al inicio de sesión" }).click();
  await expect(page).toHaveURL(/\/iniciar-sesion\?segundoFactor=cancelado$/);
  await expect(page.getByRole("status")).toHaveText("Cancelaste la verificación en dos pasos. No se inició sesión.");

  await page.goto("/publicaciones");
  await expect(page.getByRole("link", { name: "Iniciar sesión", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Administración", exact: true })).toHaveCount(0);
  await esperarSinAccesoAdministrativo(page);
});

test("CP-11: un administrador restablece el 2FA de otro y este debe volver a configurarlo (CA-2, CA-3, CA-7)", async ({ page, browser, db, crearAdministrador }) => {
  const admin = await crearAdministrador(true);
  const otro = await crearAdministrador(true);

  await iniciarSesionAdministrador(page, { usuario: admin.usuario, contrasena: admin.contrasena, secretoSegundoFactor: admin.secreto });
  await page.goto(`/gestion-administradores/${otro.administradorId}`);
  await expect(page.getByText("Activado", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Restablecer segundo factor" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Restablecer", exact: true }).click();
  await expect(page.getByText("No configurado", { exact: true })).toBeVisible();

  const usuario = await db.orm.public.Usuario.where({ id: otro.usuarioId }).first();
  expect(usuario?.twoFactorEnabled).toBe(false);
  expect(usuario?.twoFactorSecret).toBeNull();

  // El administrador restablecido debe vincular de nuevo y no accede hasta hacerlo.
  const contexto = await browser.newContext();
  const paginaOtro = await contexto.newPage();
  await ingresarCredenciales(paginaOtro, otro);
  await expect(paginaOtro.getByRole("heading", { name: "Configurá la verificación en dos pasos" })).toBeVisible();
  await expect(paginaOtro.getByTestId("clave-segundo-factor")).toBeAttached();
  await esperarSinAccesoAdministrativo(paginaOtro);
  await contexto.close();
});
