import { randomUUID } from "node:crypto";
import { Client, type Notification } from "pg";
import { Temporal } from "temporal-polyfill";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { obtenerDatabaseUrlTest } from "@/infraestructura/persistencia/configuracion-db-test";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { notificarCambioPublicacion } from "@/infraestructura/tiempo-real/publicaciones";
import { consultarPublicaciones } from "@/modulos/consulta-mercado/acciones/PublicacionesOperador";
import {
    actualizarPrecioPublicacion,
    ConflictoPublicacionError,
    incrementarPrecioPublicacion,
} from "./mi-mercado/consultas-mi-mercado";

type Precio = Parameters<typeof db.orm.public.Publicacion.create>[0]["precio"];

async function crearFixture() {
    const prefijo = `test-publicaciones-${randomUUID()}`;
    return db.transaction(async (tx) => {
        const usuario = await tx.orm.public.Usuario.create({ username: prefijo, passwordHash: "fixture", rol: "OPERADOR" });
        const operador = await tx.orm.public.Operador.create({ usuarioId: usuario.id, nombreFantasia: prefijo, whatsApp: "+59899123456" });
        const usuarioVencido = await tx.orm.public.Usuario.create({ username: `${prefijo}-vencido`, passwordHash: "fixture", rol: "OPERADOR" });
        const operadorVencido = await tx.orm.public.Operador.create({ usuarioId: usuarioVencido.id, nombreFantasia: `${prefijo}-vencido`, whatsApp: "+59899123456" });
        const usuarioProductor = await tx.orm.public.Usuario.create({ username: `${prefijo}-productor`, passwordHash: "fixture", rol: "PRODUCTOR" });
        const productor = await tx.orm.public.Productor.create({ usuarioId: usuarioProductor.id, nombreFantasia: `${prefijo}-productor`, whatsApp: "+59899123456" });
        const nave = await tx.orm.public.Nave.create({ nombreNave: prefijo });
        await tx.orm.public.Local.create({ operadorId: operador.id, naveId: nave.id, numeroLocal: "1", finContrato: null });
        await tx.orm.public.Local.create({ operadorId: operadorVencido.id, naveId: nave.id, numeroLocal: "2", finContrato: Temporal.Instant.from("2000-01-01T00:00:00Z") });
        const especie = await tx.orm.public.Especie.create({ nombreEspecie: `${prefijo} Limón` });
        const variedad = await tx.orm.public.Variedad.create({ especieId: especie.id, nombreVariedad: "Criollo" });
        const presentacion = await tx.orm.public.Presentacion.create({ variedadId: variedad.id, nombrePresentacion: "Caja" });
        const categoria = await tx.orm.public.Categoria.create({ especieId: especie.id, nombreCategoria: "Primera" });
        const calibre = await tx.orm.public.Calibre.create({ codigoCalibre: prefijo, nombreCalibre: "Mediano" });
        const pais = await tx.orm.public.Pais.create({ codigoPais: prefijo, nombrePais: prefijo });
        const publicacionIds: number[] = [];
        const visibles: number[] = [];

        for (let indice = 0; indice < 39; indice++) {
            const esProductor = indice === 38;
            const publicacion = await tx.orm.public.Publicacion.create({
                tipoPublicacion: esProductor ? "PRODUCTOR" : "OPERADOR",
                precio: String(100 + indice) as Precio,
                presentacionId: presentacion.id,
                categoriaId: categoria.id,
                calibreId: calibre.id,
                publicacionActiva: indice !== 35,
                publicacionDisponible: indice !== 36,
            });
            publicacionIds.push(publicacion.id);
            if (esProductor) {
                await tx.orm.public.PublicacionProductor.create({ publicacionId: publicacion.id, productorId: productor.id, paisId: pais.id });
            } else {
                await tx.orm.public.PublicacionOperador.create({ publicacionId: publicacion.id, operadorId: indice === 37 ? operadorVencido.id : operador.id, paisId: pais.id });
                if (indice < 35) visibles.push(publicacion.id);
            }
        }

        return { prefijo, usuarioId: usuario.id, operadorId: operador.id, usuarioVencidoId: usuarioVencido.id, operadorVencidoId: operadorVencido.id, usuarioProductorId: usuarioProductor.id, productorId: productor.id, naveId: nave.id, especieId: especie.id, nombreEspecie: especie.nombreEspecie, variedadId: variedad.id, presentacionId: presentacion.id, categoriaId: categoria.id, calibreId: calibre.id, paisId: pais.id, publicacionIds, visibles };
    });
}

type Fixture = Awaited<ReturnType<typeof crearFixture>>;

async function borrarFixture(fixture: Fixture) {
    await db.transaction(async (tx) => {
        // Todos los identificadores pertenecen a este fixture. No se vacían tablas compartidas.
        for (const id of fixture.publicacionIds) await tx.orm.public.Publicacion.where({ id }).delete();
        for (const operadorId of [fixture.operadorId, fixture.operadorVencidoId]) {
            await tx.orm.public.Local.where({ operadorId }).deleteAll();
            await tx.orm.public.Operador.where({ id: operadorId }).delete();
        }
        await tx.orm.public.Productor.where({ id: fixture.productorId }).delete();
        for (const id of [fixture.usuarioId, fixture.usuarioVencidoId, fixture.usuarioProductorId]) await tx.orm.public.Usuario.where({ id }).delete();
        await tx.orm.public.Presentacion.where({ id: fixture.presentacionId }).delete();
        await tx.orm.public.Variedad.where({ id: fixture.variedadId }).delete();
        await tx.orm.public.Categoria.where({ id: fixture.categoriaId }).delete();
        await tx.orm.public.Especie.where({ id: fixture.especieId }).delete();
        await tx.orm.public.Calibre.where({ id: fixture.calibreId }).delete();
        await tx.orm.public.Pais.where({ id: fixture.paisId }).delete();
        await tx.orm.public.Nave.where({ id: fixture.naveId }).delete();
    });
}

function ejecutarYEsperarNotificacion(cliente: Client, payload: string, ejecutar: () => Promise<unknown>): Promise<Notification> {
    return new Promise((resolve, reject) => {
        const finalizar = (error?: unknown, notificacion?: Notification) => {
            clearTimeout(limite);
            cliente.off("notification", recibir);
            cliente.off("error", fallar);
            if (error) reject(error);
            else resolve(notificacion!);
        };
        const fallar = (error: Error) => finalizar(error);
        const recibir = (notificacion: Notification) => {
            if (notificacion.channel === "uam_publicaciones" && notificacion.payload === payload) finalizar(undefined, notificacion);
        };
        // Es un límite de fallo, no una espera usada para decidir si llegó un evento.
        const limite = setTimeout(() => finalizar(new Error("No llegó la notificación confirmada de PostgreSQL.")), 5000);
        cliente.on("notification", recibir);
        cliente.on("error", fallar);
        void ejecutar().catch(finalizar);
    });
}

describe("publicaciones: consultas SQL, versiones y notificaciones con PostgreSQL real", () => {
    let fixture: Fixture | undefined;
    let cliente: Client | undefined;

    beforeAll(async () => {
        const urlTest = obtenerDatabaseUrlTest({ DATABASE_URL_TEST: process.env.DATABASE_URL_TEST });
        if (process.env.DATABASE_URL !== urlTest) throw new Error("La configuración de integración debe seleccionar DATABASE_URL_TEST antes de importar la base.");
        fixture = await crearFixture();
    }, 30000);

    beforeEach(async () => {
        await db.orm.public.Publicacion.where({ id: fixture!.visibles[0] }).update({ precio: "100.00" as Precio, version: 1 });
    });

    afterEach(async () => {
        await cliente?.end();
        cliente = undefined;
    });

    afterAll(async () => {
        if (fixture) await borrarFixture(fixture);
    }, 30000);

    async function escuchar() {
        cliente = new Client({ connectionString: process.env.DATABASE_URL_TEST, connectionTimeoutMillis: 5000 });
        await cliente.connect();
        await cliente.query("LISTEN uam_publicaciones");
        return cliente;
    }

    it("devuelve las 35 coincidencias sin recortes y excluye bajas, no disponibles, contratos vencidos y productores", async () => {
        const consulta = { especie: fixture!.nombreEspecie, orden: "precioAsc" as const };
        const resultado = await consultarPublicaciones(consulta);
        expect(resultado.total).toBe(35);
        expect(resultado.publicaciones).toHaveLength(35);
        expect(resultado.publicaciones.map((publicacion) => publicacion.id)).toEqual(fixture!.visibles);
        expect(resultado).not.toHaveProperty("pagina");
        expect(resultado).not.toHaveProperty("tamanoPagina");
        expect(resultado.totalCatalogo).toBeGreaterThanOrEqual(35);
        expect(resultado.publicaciones.every((publicacion) => publicacion.tipoPublicacion === "OPERADOR")).toBe(true);
        expect(resultado.opciones).toContainEqual({ especie: fixture!.nombreEspecie, variedad: "Criollo", presentacion: "Caja", categoria: "Primera", calibre: "Mediano" });
    });

    it("ejecuta búsqueda sin tildes, filtros numéricos y orden descendente en SQL real", async () => {
        const resultado = await consultarPublicaciones({ busqueda: `${fixture!.prefijo} limon`, precioMinimo: "110", precioMaximo: "112", orden: "precioDesc" });
        expect(resultado.total).toBe(3);
        expect(resultado.publicaciones.map((publicacion) => publicacion.precio)).toEqual([112, 111, 110]);
        expect(resultado.publicaciones.map((publicacion) => publicacion.id)).toEqual(fixture!.visibles.slice(10, 13).reverse());
    });

    it("acumula dos incrementos simultáneos sin perder escrituras y avanza dos versiones", async () => {
        const resultados = await Promise.all([
            incrementarPrecioPublicacion(fixture!.operadorId, fixture!.visibles[0], 10),
            incrementarPrecioPublicacion(fixture!.operadorId, fixture!.visibles[0], 20),
        ]);
        const guardada = await db.orm.public.Publicacion.where({ id: fixture!.visibles[0] }).first();
        expect(Number(guardada!.precio)).toBe(130);
        expect(guardada!.version).toBe(3);
        expect(resultados.map((resultado) => resultado.version).sort()).toEqual([2, 3]);
    });

    it("rechaza la revisión vieja sin reemplazar el precio confirmado", async () => {
        await actualizarPrecioPublicacion(fixture!.operadorId, fixture!.visibles[0], 150, 1);
        await expect(actualizarPrecioPublicacion(fixture!.operadorId, fixture!.visibles[0], 999, 1)).rejects.toBeInstanceOf(ConflictoPublicacionError);
        const guardada = await db.orm.public.Publicacion.where({ id: fixture!.visibles[0] }).first();
        expect(Number(guardada!.precio)).toBe(150);
        expect(guardada!.version).toBe(2);
    });

    it("publica el cambio de precio confirmado a un LISTEN real", async () => {
        const oyente = await escuchar();
        const payload = JSON.stringify({ operadorId: fixture!.operadorId, publicacionId: fixture!.visibles[0] });
        await ejecutarYEsperarNotificacion(oyente, payload, () => incrementarPrecioPublicacion(fixture!.operadorId, fixture!.visibles[0], 15));
        const guardada = await db.orm.public.Publicacion.where({ id: fixture!.visibles[0] }).first();
        expect(Number(guardada!.precio)).toBe(115);
        expect(guardada!.version).toBe(2);
    });

    it("descarta la notificación y el precio de una transacción revertida sin esperas arbitrarias", async () => {
        const oyente = await escuchar();
        const payload = JSON.stringify({ operadorId: fixture!.operadorId, publicacionId: fixture!.visibles[0] });
        const recibidos: string[] = [];
        oyente.on("notification", ({ payload: recibido }) => { if (recibido) recibidos.push(recibido); });
        await expect(db.transaction(async (tx) => {
            await tx.orm.public.Publicacion.where({ id: fixture!.visibles[0] }).update({ precio: "999.00" as Precio, version: 2 });
            await notificarCambioPublicacion(tx, { operadorId: fixture!.operadorId, publicacionId: fixture!.visibles[0] });
            throw new Error("Revertir fixture");
        })).rejects.toThrow("Revertir fixture");
        // NOTIFY se entrega en orden de commit. La barrera posterior confirma que el
        // oyente procesó la cola sin depender de dormir N milisegundos.
        const barrera = JSON.stringify({ barrera: randomUUID() });
        await ejecutarYEsperarNotificacion(oyente, barrera, () => oyente.query("SELECT pg_notify($1, $2)", ["uam_publicaciones", barrera]));
        expect(recibidos).not.toContain(payload);
        const guardada = await db.orm.public.Publicacion.where({ id: fixture!.visibles[0] }).first();
        expect(Number(guardada!.precio)).toBe(100);
        expect(guardada!.version).toBe(1);
    });
});
