import { randomUUID } from "node:crypto";
import { expect as baseExpect, type Locator, type Page } from "@playwright/test";
import { test as base } from "../precarga-operadores";
import type { Credenciales } from "../autenticacion";

export const expect = baseExpect.configure({ timeout: 15_000 });

type Especie = { id: number; nombre: string };
type Catalogo = {
    prefijo: string;
    especies: Especie[];
    productor: { id: number; usuarioId: number; nombre: string; credenciales: Credenciales };
};

const clavesOrdenamiento = [
    "ordenamiento_habilitado", "orden_landing_page_default",
    "orden_mercado_virtual_default", "orden_mercado_produccion_default",
];

export const test = base.extend<{ catalogo: Catalogo; ordenamiento: void }>({
    catalogo: async ({ precargaOperadores: datos }, usar) => {
        const { db } = datos;
        const prefijo = `BP18 ${randomUUID().slice(0, 8)}`;
        const especies: Especie[] = [];
        const publicaciones: { operador: number[]; productor: number[] } = { operador: [], productor: [] };
        try {
            const productor = await db.orm.public.Productor
                .where((p) => p.usuario.some((u) => u.username.eq(datos.productor.usuario)))
                .select("id", "usuarioId", "nombreFantasia").first();
            if (!productor) throw new Error("No se creó el productor de la fixture E2E.");
            for (const letra of ["A", "Z"]) {
                const especie = await db.orm.public.Especie.create({ nombreEspecie: `${prefijo} ${letra}`, especieActiva: true });
                especies.push({ id: especie.id, nombre: especie.nombreEspecie });
                for (const tipoPublicacion of ["OPERADOR", "PRODUCTOR"] as const) {
                    type Precio = Parameters<typeof db.orm.public.Publicacion.create>[0]["precio"];
                    const publicacion = await db.orm.public.Publicacion.create({
                        especieId: especie.id, tipoPublicacion, precio: "100" as Precio,
                        publicacionActiva: true, publicacionDisponible: true,
                    });
                    if (tipoPublicacion === "OPERADOR") {
                        publicaciones.operador.push(publicacion.id);
                        await db.orm.public.PublicacionOperador.create({ publicacionId: publicacion.id, operadorId: datos.operadorA.id });
                    } else {
                        publicaciones.productor.push(publicacion.id);
                        await db.orm.public.PublicacionProductor.create({ publicacionId: publicacion.id, productorId: productor.id });
                    }
                }
            }
            await usar({ prefijo, especies, productor: {
                id: productor.id, usuarioId: productor.usuarioId, nombre: productor.nombreFantasia, credenciales: datos.productor,
            } });
        } finally {
            // Sólo se eliminan publicaciones y especies creadas por este caso.
            await db.transaction(async (tx) => {
                for (const id of [...publicaciones.operador, ...publicaciones.productor]) {
                    await tx.orm.public.Publicacion.where({ id }).delete();
                }
                for (const especie of especies) {
                    await tx.orm.public.Especie.where({ id: especie.id }).delete();
                }
            });
        }
    },
    ordenamiento: async ({ precargaOperadores: { db } }, usar) => {
        const originales = await db.orm.public.Configuracion
            .where((c) => c.nombreConfiguracion.in(clavesOrdenamiento))
            .select("nombreConfiguracion", "valorConfiguracion").all();
        expect(originales, "BP-18.1 necesita las cuatro configuraciones de ordenamiento de la seed.").toHaveLength(clavesOrdenamiento.length);
        try {
            await db.transaction(async (tx) => {
                for (const nombreConfiguracion of clavesOrdenamiento) {
                    await tx.orm.public.Configuracion.where({ nombreConfiguracion })
                        .update({ valorConfiguracion: nombreConfiguracion === "ordenamiento_habilitado" ? "true" : "nombre_asc" });
                }
            });
            await usar(undefined);
        } finally {
            await db.transaction(async (tx) => {
                for (const original of originales) {
                    await tx.orm.public.Configuracion.where({ nombreConfiguracion: original.nombreConfiguracion })
                        .update({ valorConfiguracion: original.valorConfiguracion });
                }
            });
        }
    },
});

export async function abrirSeccion(page: Page, nombre: "General" | "Usuarios") {
    await page.getByRole("group", { name: "Secciones de configuración" }).getByRole("button", { name: nombre, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/administracion#${nombre.toLowerCase()}$`));
}

export async function ingresar(page: Page, credenciales: Credenciales) {
    await page.goto("/iniciar-sesion");
    await page.getByLabel("Correo electrónico o nombre de usuario").fill(credenciales.usuario);
    await page.getByLabel("Contraseña", { exact: true }).fill(credenciales.contrasena);
    await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Mi Mercado", exact: true })).toBeVisible({ timeout: 30_000 });
}

export async function seleccionar(page: Page, contenedor: Locator, campo: string, valor: string) {
    await contenedor.getByRole("combobox", { name: campo, exact: true }).click();
    await page.getByRole("option", { name: valor, exact: true }).click();
}
