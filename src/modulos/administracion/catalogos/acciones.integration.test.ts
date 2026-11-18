import { randomUUID } from "node:crypto";
import { Temporal } from "temporal-polyfill";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { TIPOS_CATALOGO, type DatosCatalogo, type TipoCatalogo } from "./tipos";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => ({
    exigirAdministrador: vi.fn(async () => ({ usuarioId: 1, rol: "ADMINISTRADOR" })),
}));
vi.mock("@/modulos/identidad-acceso/autorizacion/control-acciones", () => ({ controlarSesionEnAccion: (control: () => Promise<unknown>) => control() }));

type BaseDatos = typeof import("@/infraestructura/persistencia/prisma/db").db;
type Acciones = typeof import("./acciones");
type Escenario = { especieId: number; ids: Record<TipoCatalogo, number>; publicaciones: number[] };
let db: BaseDatos;
let acciones: Acciones;
let escenario: Escenario | undefined;
const envasesAdicionales: number[] = [];
const fechaPublicaciones = Temporal.Instant.from("2020-01-02T15:00:00Z");

async function consultarEstadisticasModificaciones() {
    return (await db.orm.public.EstadisticaPublicacion.select("id", "fecha", "username", "cantidad").all())
        .map((fila) => ({ ...fila, fecha: fila.fecha.toString() }))
        .sort((a, b) => a.id - b.id);
}

describe.sequential("ABM real de catálogos administrativos", { timeout: 15000 }, () => {
    beforeAll(async () => {
        if (!process.env.DATABASE_URL_TEST || process.env.DATABASE_URL !== process.env.DATABASE_URL_TEST) {
            throw new Error("Estas pruebas requieren DATABASE_URL_TEST como base activa.");
        }
        ({ db } = await import("@/infraestructura/persistencia/prisma/db"));
        acciones = await import("./acciones");
    });

    beforeEach(async () => {
        const identificador = randomUUID();
        escenario = await db.transaction(async (tx) => {
            const especie = await tx.orm.public.Especie.create({ nombreEspecie: `Catálogo ${identificador}` });
            const envase = await tx.orm.public.Envase.create({ nombreEnvase: `Envase ${identificador}` });
            const kilos = await tx.orm.public.KilosEmpaquetado.create({ valor: `${Date.now()}0` });
            const calibre = await tx.orm.public.Calibre.create({ codigoCalibre: identificador, nombreCalibre: `Calibre ${identificador}` });
            const categoria = await tx.orm.public.Categoria.create({ nombreCategoria: `Categoría ${identificador}`, especieId: null });
            const publicaciones: number[] = [];
            for (const tipoPublicacion of ["OPERADOR", "PRODUCTOR"] as const) {
                const publicacion = await tx.orm.public.Publicacion.create({
                    fecha: fechaPublicaciones, version: 7, especieId: especie.id, tipoPublicacion,
                    publicacionActiva: tipoPublicacion === "OPERADOR", publicacionDisponible: tipoPublicacion === "OPERADOR",
                    envaseId: envase.id, kilosId: kilos.id, calibreId: calibre.id, categoriaId: categoria.id,
                });
                publicaciones.push(publicacion.id);
            }
            return { especieId: especie.id, ids: { empaquetados: envase.id, kilos: kilos.id, calibres: calibre.id, categorias: categoria.id }, publicaciones };
        });
    });

    afterEach(async () => {
        if (!escenario) return;
        for (const id of escenario.publicaciones) await db.orm.public.Publicacion.where({ id }).deleteAll();
        await db.orm.public.Envase.where({ id: escenario.ids.empaquetados }).deleteAll();
        await db.orm.public.KilosEmpaquetado.where({ id: escenario.ids.kilos }).deleteAll();
        await db.orm.public.Calibre.where({ id: escenario.ids.calibres }).deleteAll();
        await db.orm.public.Categoria.where({ id: escenario.ids.categorias }).deleteAll();
        await db.orm.public.Especie.where({ id: escenario.especieId }).deleteAll();
        for (const id of envasesAdicionales.splice(0)) await db.orm.public.Envase.where({ id }).deleteAll();
        escenario = undefined;
    });

    it("refleja los cuatro catálogos sin cambiar fechas, versiones ni estadísticas de publicaciones", async () => {
        const datos = escenario!;
        const estadisticasAntes = await consultarEstadisticasModificaciones();
        const sufijo = randomUUID();
        const valores: Record<TipoCatalogo, DatosCatalogo> = {
            empaquetados: { nombre: `Envase editado ${sufijo}` },
            kilos: { nombre: `${Date.now()}5` },
            calibres: { nombre: `Calibre editado ${sufijo}`, codigo: sufijo },
            categorias: { nombre: `Categoría editada ${sufijo}` },
        };
        for (const tipo of TIPOS_CATALOGO) {
            expect(await acciones.guardarElementoCatalogo(tipo, valores[tipo], datos.ids[tipo])).toEqual({ ok: true });
            expect(await consultarEstadisticasModificaciones()).toEqual(estadisticasAntes);
            for (const id of datos.publicaciones) {
                const publicacion = await db.orm.public.Publicacion.where({ id }).select("fecha", "version").first();
                expect(publicacion?.fecha.toString()).toBe(fechaPublicaciones.toString());
                expect(publicacion?.version).toBe(7);
            }
        }
        for (const id of datos.publicaciones) {
            const publicacion = await db.orm.public.Publicacion.where({ id }).include("envase").include("kilos").include("calibre").include("categoria").first();
            expect(publicacion).toMatchObject({
                id, envaseId: datos.ids.empaquetados, kilosId: datos.ids.kilos, calibreId: datos.ids.calibres, categoriaId: datos.ids.categorias,
                envase: { nombreEnvase: valores.empaquetados.nombre }, kilos: { valor: valores.kilos.nombre },
                calibre: { nombreCalibre: valores.calibres.nombre, codigoCalibre: valores.calibres.codigo },
                categoria: { nombreCategoria: valores.categorias.nombre, especieId: null },
            });
        }
    });

    it("bloquea el borrado sin desvincular publicaciones activas ni inactivas y lo permite al quedar sin referencias", async () => {
        const datos = escenario!;
        for (const tipo of TIPOS_CATALOGO) {
            expect(await acciones.eliminarElementoCatalogo(tipo, datos.ids[tipo])).toMatchObject({ ok: false, mensaje: expect.stringContaining("publicaciones asociadas") });
        }
        for (const id of datos.publicaciones) {
            expect(await db.orm.public.Publicacion.where({ id }).first()).toMatchObject({
                envaseId: datos.ids.empaquetados, kilosId: datos.ids.kilos, calibreId: datos.ids.calibres, categoriaId: datos.ids.categorias,
            });
        }
        for (const id of datos.publicaciones.splice(0)) await db.orm.public.Publicacion.where({ id }).delete();
        for (const tipo of TIPOS_CATALOGO) {
            expect(await acciones.eliminarElementoCatalogo(tipo, datos.ids[tipo])).toEqual({ ok: true });
            expect((await acciones.listarCatalogo(tipo)).some(({ id }) => id === datos.ids[tipo])).toBe(false);
        }
    });

    it("serializa altas concurrentes para impedir duplicados con distinto uso de mayúsculas", async () => {
        const nombre = `Envase concurrente ${randomUUID()}`;
        const resultados = await Promise.all([
            acciones.guardarElementoCatalogo("empaquetados", { nombre }),
            acciones.guardarElementoCatalogo("empaquetados", { nombre: `  ${nombre.toUpperCase()}  ` }),
        ]);
        const encontrados = (await acciones.listarCatalogo("empaquetados"))
            .filter((elemento) => elemento.nombre.toLowerCase() === nombre.toLowerCase());
        envasesAdicionales.push(...encontrados.map(({ id }) => id));
        expect(resultados.filter(({ ok }) => ok)).toHaveLength(1);
        expect(resultados.filter(({ ok }) => !ok)).toHaveLength(1);
        expect(encontrados).toHaveLength(1);
    });
});
