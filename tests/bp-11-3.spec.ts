// El ORM decodifica las fechas de `imagen` con Temporal, que Node todavía no trae.
import "temporal-polyfill/full/global";
import { randomBytes, randomUUID } from "node:crypto";
import argon2 from "argon2";
import sharp from "sharp";
import { config } from "dotenv";
import postgres from "@prisma/orm-postgres/runtime";
import { test as base, expect as baseExpect, type Page } from "@playwright/test";
import type { Contract } from "../src/infraestructura/persistencia/prisma/contract";
import contractJson from "../src/infraestructura/persistencia/prisma/contract.json" with { type: "json" };
import { iniciarSesionProductor } from "./autenticacion";

// Guardar hace argon2/transacciones en el servidor: bajo carga supera los 5 s por defecto.
const expect = baseExpect.configure({ timeout: 15_000 });

type Productor = { id: number; usuarioId: number; username: string; contrasena: string; nombre: string };
type Fixtures = {
  db: ReturnType<typeof postgres<Contract>>;
  crearProductor: () => Promise<Productor>;
  /** Productor con sesión iniciada en `page`. */
  productor: Productor;
};

const TELEFONO_INICIAL = "90000000";

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
  crearProductor: async ({ db }, usar) => {
    const creados: Productor[] = [];
    try {
      await usar(async () => {
        const sufijo = randomUUID().slice(0, 8);
        const username = `e2e_bp113_${sufijo}`;
        const contrasena = randomBytes(16).toString("hex");
        const usuario = await db.orm.public.Usuario.create({
          username,
          passwordHash: await argon2.hash(contrasena, { type: argon2.argon2id }),
          rol: "PRODUCTOR",
          twoFactorEnabled: false,
        });
        const nombre = `Productor BP-11.3 ${sufijo}`;
        const productor = await db.orm.public.Productor.create({ usuarioId: usuario.id, nombreFantasia: nombre, whatsApp: `+598${TELEFONO_INICIAL}` });
        const creado = { id: productor.id, usuarioId: usuario.id, username, contrasena, nombre };
        creados.push(creado);
        return creado;
      });
    } finally {
      for (const { id, usuarioId } of creados) {
        try {
          const guardado = await db.orm.public.Productor.where({ id }).first();
          if (guardado?.fotoPerfil?.startsWith("/api/imagenes/")) {
            await db.orm.public.Imagen.where({ clave: guardado.fotoPerfil.slice("/api/imagenes/".length) }).deleteAll();
          }
        } finally {
          // El perfil de Productor se elimina por cascada, aunque falle el borrado de la imagen.
          await db.orm.public.Usuario.where({ id: usuarioId }).delete();
        }
      }
    }
  },
  productor: async ({ page, crearProductor }, usar) => {
    const productor = await crearProductor();
    await iniciarSesionProductor(page, { usuario: productor.username, contrasena: productor.contrasena });
    await usar(productor);
  },
});

const RUTA_PERFIL = "/mi-perfil/productor";
const RUTA_EDITAR = `${RUTA_PERFIL}/editar`;
const MENSAJE_EXITO = "Tu perfil se actualizó correctamente.";

const campoNombre = (page: Page) => page.getByRole("textbox", { name: "Nombre", exact: true });
const campoTelefono = (page: Page) => page.getByRole("textbox", { name: /Teléfono/ });
const selectorCodigo = (page: Page) => page.getByRole("combobox", { name: /Código de país/ });
const tarjetaPerfil = (page: Page, nombre: string) => page.getByRole("region", { name: nombre, exact: true });
const lineaTelefono = (page: Page, nombre: string) => tarjetaPerfil(page, nombre).getByText("Teléfono:", { exact: true }).locator("..");
const alerta = (page: Page, mensaje: string) => page.getByRole("alert").filter({ hasText: mensaje });

async function abrirEdicion(page: Page) {
  await page.goto(RUTA_PERFIL);
  await page.getByRole("link", { name: "Editar", exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === RUTA_EDITAR);
  await expect(page.getByRole("heading", { level: 1, name: "Editar mi perfil", exact: true })).toBeVisible();
}

async function guardar(page: Page) {
  await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
}

async function guardarConExito(page: Page) {
  await guardar(page);
  await expect(page.getByText(MENSAJE_EXITO)).toBeVisible();
  await expect(page).toHaveURL((url) => url.pathname === RUTA_PERFIL);
}

async function elegirCodigo(page: Page, opcion: string) {
  await selectorCodigo(page).click();
  await page.getByRole("option", { name: opcion, exact: true }).click();
}

test.describe("BP-11.3: Modificación de mi perfil como Productor", () => {
  test("CP-01 [CA-1] el formulario muestra los datos actuales del perfil", async ({ page, productor }) => {
    await page.goto(RUTA_PERFIL);
    await expect(lineaTelefono(page, productor.nombre)).toContainText(`+598 ${TELEFONO_INICIAL}`);

    await abrirEdicion(page);
    await expect(campoNombre(page)).toHaveValue(productor.nombre);
    await expect(selectorCodigo(page)).toHaveText("+598 (Uruguay)");
    await expect(campoTelefono(page)).toHaveValue(TELEFONO_INICIAL);
    await expect(page.getByRole("button", { name: "Agregar foto" })).toBeVisible();
  });

  test("CP-02 [CA-2, CA-4] modificar nombre y contacto los reemplaza y persiste", async ({ page, db, productor }) => {
    const nuevoNombre = `${productor.nombre} editado`;
    await abrirEdicion(page);
    await campoNombre(page).fill(nuevoNombre);
    await elegirCodigo(page, "+54 (Argentina)");
    await campoTelefono(page).fill("1123456789");
    await guardarConExito(page);

    await test.step("CA-4: el perfil muestra los cambios después de recargar", async () => {
      await page.reload();
      await expect(page.getByRole("heading", { level: 1, name: nuevoNombre, exact: true })).toBeVisible();
      await expect(lineaTelefono(page, nuevoNombre)).toContainText("+54 1123456789");
    });

    await test.step("CA-4: los cambios quedan persistidos", async () => {
      const guardado = await db.orm.public.Productor.where({ id: productor.id }).first();
      expect(guardado?.nombreFantasia).toBe(nuevoNombre);
      expect(guardado?.whatsApp).toBe("+541123456789");
    });

    await test.step("CA-1: la edición muestra los valores nuevos", async () => {
      await abrirEdicion(page);
      await expect(campoNombre(page)).toHaveValue(nuevoNombre);
      await expect(selectorCodigo(page)).toHaveText("+54 (Argentina)");
      await expect(campoTelefono(page)).toHaveValue("1123456789");
    });
  });

  test("CP-03 [CA-2] el contacto es obligatorio: no se puede eliminar y se puede corregir", async ({ page, db, productor }) => {
    // Desvío acordado con el cliente: el backlog dice "eliminar", la app lo exige.
    await abrirEdicion(page);
    await expect(campoTelefono(page)).toHaveAttribute("required", "");
    await campoTelefono(page).clear();
    await guardar(page);
    await expect(alerta(page, "Faltan completar campos obligatorios.")).toBeVisible();
    await expect(campoTelefono(page)).toHaveAttribute("aria-invalid", "true");
    await expect(page).toHaveURL((url) => url.pathname === RUTA_EDITAR);
    expect((await db.orm.public.Productor.where({ id: productor.id }).first())?.whatsApp).toBe(`+598${TELEFONO_INICIAL}`);

    await campoTelefono(page).fill("98765432");
    await expect(campoTelefono(page)).not.toHaveAttribute("aria-invalid", "true");
    await guardarConExito(page);
    await expect(lineaTelefono(page, productor.nombre)).toContainText("+598 98765432");
    expect((await db.orm.public.Productor.where({ id: productor.id }).first())?.whatsApp).toBe("+59898765432");
  });

  test("CP-04 [CA-3] se validan los datos antes de guardar", async ({ page, db, crearProductor, productor }) => {
    const otro = await crearProductor();
    const rechazos = [
      { titulo: "teléfono uruguayo que no empieza con 9", codigo: "+598 (Uruguay)", nombre: productor.nombre, telefono: "12345678", error: "El teléfono no es válido." },
      { titulo: "teléfono argentino demasiado corto", codigo: "+54 (Argentina)", nombre: productor.nombre, telefono: "12345", error: "El teléfono no es válido." },
      { titulo: "nombre de otro productor", codigo: "+598 (Uruguay)", nombre: otro.nombre, telefono: TELEFONO_INICIAL, error: "Ya existe un productor con ese nombre." },
    ];
    for (const caso of rechazos) {
      await test.step(caso.titulo, async () => {
        await abrirEdicion(page);
        await campoNombre(page).fill(caso.nombre);
        await elegirCodigo(page, caso.codigo);
        await campoTelefono(page).fill(caso.telefono);
        await guardar(page);
        await expect(alerta(page, caso.error)).toBeVisible();
        await expect(page).toHaveURL((url) => url.pathname === RUTA_EDITAR);
      });
    }
    await test.step("El nombre vacío no se envía", async () => {
      await abrirEdicion(page);
      await campoNombre(page).clear();
      await guardar(page);
      await expect(alerta(page, "Faltan completar campos obligatorios.")).toBeVisible();
      await expect(campoNombre(page)).toHaveAttribute("aria-invalid", "true");
    });

    const guardado = await db.orm.public.Productor.where({ id: productor.id }).first();
    expect(guardado?.nombreFantasia, "Ningún rechazo modifica el perfil").toBe(productor.nombre);
    expect(guardado?.whatsApp).toBe(`+598${TELEFONO_INICIAL}`);
  });

  test("CP-05 [CA-4] cancelar descarta los cambios", async ({ page, db, productor }) => {
    await abrirEdicion(page);
    await campoNombre(page).fill(`${productor.nombre} sin guardar`);
    await campoTelefono(page).fill("91111111");
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === RUTA_PERFIL);
    await expect(page.getByRole("heading", { level: 1, name: productor.nombre, exact: true })).toBeVisible();
    await expect(lineaTelefono(page, productor.nombre)).toContainText(`+598 ${TELEFONO_INICIAL}`);
    const guardado = await db.orm.public.Productor.where({ id: productor.id }).first();
    expect(guardado?.nombreFantasia).toBe(productor.nombre);
    expect(guardado?.whatsApp).toBe(`+598${TELEFONO_INICIAL}`);
  });

  test("CP-06 [CA-4] la edición propia permite cargar la foto de perfil", async ({ page, db, productor }) => {
    // El ciclo completo de la foto (reemplazo, eliminación) se prueba en fotos-perfil.spec.ts.
    const foto = page.getByRole("img", { name: `Foto de ${productor.nombre}`, exact: true });
    await abrirEdicion(page);
    const imagen = await sharp({ create: { width: 80, height: 80, channels: 3, background: "#008332" } }).png().toBuffer();
    await page.getByLabel("Seleccionar foto de perfil").setInputFiles({ name: "perfil.png", mimeType: "image/png", buffer: imagen });
    await expect(page.getByRole("img", { name: "Vista previa de la foto de perfil" })).toBeVisible();
    await guardarConExito(page);

    await expect(foto).toHaveAttribute("src", new RegExp(`/api/imagenes/productores/${productor.id}/.+\\.webp$`));
    await page.reload();
    await expect.poll(() => foto.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    const guardado = await db.orm.public.Productor.where({ id: productor.id }).first();
    expect(guardado?.fotoPerfil).toMatch(new RegExp(`^/api/imagenes/productores/${productor.id}/`));
  });
});
