import { randomUUID } from "node:crypto";
import { Client, type Notification } from "pg";
import { Temporal } from "temporal-polyfill";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerDatabaseUrlTest } from "@/infraestructura/persistencia/configuracion-db-test";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { notificarCambioPublicacion } from "@/infraestructura/tiempo-real/publicaciones";
import { consultarPublicaciones } from "@/modulos/consulta-mercado/acciones/PublicacionesOperador";
import { consultarPublicacionesProductores } from "@/modulos/consulta-mercado/acciones/PublicacionesProductor";
import { obtenerEspeciesConPublicacionesActivas } from "@/modulos/consulta-mercado/inicio/consultas-inicio";
import { obtenerPerfilPublicoOperador } from "@/modulos/usuarios/operadores/consultas-perfil-publico";
import { obtenerPerfilProductor } from "@/modulos/usuarios/productores/acciones/consultas-productores";
import { obtenerPerfilProductorPorOperador } from "@/modulos/usuarios/productores/acciones/consultas-perfil-por-operador";
import { obtenerPublicacionesMiMercadoProductor } from "./mi-mercado/consultas-mi-mercado-productor";
import { mapearPublicacionesMiMercado } from "./mi-mercado/mapear-publicaciones";
import type { DatosSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import {
    actualizarPrecioPublicacion,
    obtenerPublicacionesDeOperador,
    ConflictoPublicacionError,
    incrementarPrecioPublicacion,
} from "./mi-mercado/consultas-mi-mercado";

const sesionActual = vi.hoisted(() => vi.fn());
vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({ obtenerSesion: sesionActual }));

type Precio = Parameters<typeof db.orm.public.Publicacion.create>[0]["precio"];

async function crearFixture() {
    const prefijo = `test-publicaciones-${randomUUID()}`;
    return db.transaction(async (tx) => {
        const usuario = await tx.orm.public.Usuario.create({ username: prefijo, passwordHash: "fixture", rol: "OPERADOR" });
        const operador = await tx.orm.public.Operador.create({ usuarioId: usuario.id, nombreFantasia: prefijo, whatsApp: "+59899123456" });
        const usuarioVencido = await tx.orm.public.Usuario.create({ username: `${prefijo}-vencido`, passwordHash: "fixture", rol: "OPERADOR" });
        const operadorVencido = await tx.orm.public.Operador.create({ usuarioId: usuarioVencido.id, nombreFantasia: `${prefijo}-vencido`, whatsApp: "+59899123456" });
        const usuarioSoloB = await tx.orm.public.Usuario.create({ username: `${prefijo}-solo-b`, passwordHash: "fixture", rol: "OPERADOR" });
        const operadorSoloB = await tx.orm.public.Operador.create({ usuarioId: usuarioSoloB.id, nombreFantasia: `${prefijo}-solo-b`, whatsApp: "+59899123456" });
        const usuarioProductor = await tx.orm.public.Usuario.create({ username: `${prefijo}-productor`, passwordHash: "fixture", rol: "PRODUCTOR" });
        const productor = await tx.orm.public.Productor.create({ usuarioId: usuarioProductor.id, nombreFantasia: `${prefijo}-productor`, whatsApp: "+59899123456" });
        const naveA = await tx.orm.public.Nave.create({ nombreNave: `${prefijo} A` });
        const naveB = await tx.orm.public.Nave.create({ nombreNave: `${prefijo} B` });
        const naveVencida = await tx.orm.public.Nave.create({ nombreNave: `${prefijo} Vencida` });
        const naveHoy = await tx.orm.public.Nave.create({ nombreNave: `${prefijo} Hoy` });
        const naveSinPublicaciones = await tx.orm.public.Nave.create({ nombreNave: `${prefijo} Sin publicaciones` });
        await tx.orm.public.Local.create({ operadorId: operador.id, naveId: naveA.id, numeroLocal: "1", finContrato: null });
        await tx.orm.public.Local.create({ operadorId: operador.id, naveId: naveA.id, numeroLocal: "2", finContrato: null });
        await tx.orm.public.Local.create({ operadorId: operador.id, naveId: naveB.id, numeroLocal: "1", finContrato: null });
        await tx.orm.public.Local.create({ operadorId: operadorSoloB.id, naveId: naveB.id, numeroLocal: "2", finContrato: null });
        const vencido = Temporal.Instant.from("2000-01-01T00:00:00Z");
        await tx.orm.public.Local.create({ operadorId: operador.id, naveId: naveVencida.id, numeroLocal: "1", finContrato: vencido });
        await tx.orm.public.Local.create({ operadorId: operadorVencido.id, naveId: naveVencida.id, numeroLocal: "2", finContrato: vencido });
        const inicioHoy = Temporal.Now.plainDateISO("America/Montevideo").toZonedDateTime("America/Montevideo").toInstant();
        await tx.orm.public.Local.create({ operadorId: operador.id, naveId: naveHoy.id, numeroLocal: "1", finContrato: inicioHoy });
        const especie = await tx.orm.public.Especie.create({ nombreEspecie: `${prefijo} Limón` });
        const variedad = await tx.orm.public.Variedad.create({ especieId: especie.id, nombreVariedad: "Criollo" });
        const presentacion = await tx.orm.public.Presentacion.create({ variedadId: variedad.id, nombrePresentacion: "Caja" });
        const categoria = await tx.orm.public.Categoria.create({ especieId: especie.id, nombreCategoria: "Primera" });
        const otraEspecie = await tx.orm.public.Especie.create({ nombreEspecie: `${prefijo} Pera` });
        const otraVariedad = await tx.orm.public.Variedad.create({ especieId: otraEspecie.id, nombreVariedad: "Williams" });
        const otraPresentacion = await tx.orm.public.Presentacion.create({ variedadId: otraVariedad.id, nombrePresentacion: "Caja" });
        const otraCategoria = await tx.orm.public.Categoria.create({ especieId: otraEspecie.id, nombreCategoria: "Primera" });
        const calibre = await tx.orm.public.Calibre.create({ codigoCalibre: prefijo, nombreCalibre: "Mediano" });
        const pais = await tx.orm.public.Pais.create({ codigoPais: prefijo, nombrePais: prefijo });
        const publicacionIds: number[] = [];
        const visibles: number[] = [];

        for (let indice = 0; indice < 41; indice++) {
            const esProductor = indice === 38;
            const esSoloB = indice === 39;
            const esOtraEspecie = indice === 40;
            const publicacion = await tx.orm.public.Publicacion.create({
                tipoPublicacion: esProductor ? "PRODUCTOR" : "OPERADOR",
                precio: String(esSoloB ? 210 : esOtraEspecie ? 111 : 100 + indice) as Precio,
                especieId: esOtraEspecie ? otraEspecie.id : especie.id,
                variedadId: esOtraEspecie ? otraVariedad.id : variedad.id,
                presentacionId: esOtraEspecie ? otraPresentacion.id : presentacion.id,
                categoriaId: esOtraEspecie ? otraCategoria.id : categoria.id,
                calibreId: calibre.id,
                publicacionActiva: indice !== 35,
                publicacionDisponible: indice !== 36,
            });
            publicacionIds.push(publicacion.id);
            if (esProductor) {
                await tx.orm.public.PublicacionProductor.create({ publicacionId: publicacion.id, productorId: productor.id, paisId: pais.id });
            } else {
                await tx.orm.public.PublicacionOperador.create({ publicacionId: publicacion.id, operadorId: indice === 37 ? operadorVencido.id : esSoloB ? operadorSoloB.id : operador.id, paisId: pais.id });
                if (indice < 35) visibles.push(publicacion.id);
            }
        }

        return {
            prefijo, usuarioId: usuario.id, operadorId: operador.id, usuarioVencidoId: usuarioVencido.id, operadorVencidoId: operadorVencido.id,
            usuarioSoloBId: usuarioSoloB.id, operadorSoloBId: operadorSoloB.id, usuarioProductorId: usuarioProductor.id, productorId: productor.id,
            naveIds: [naveA.id, naveB.id, naveVencida.id, naveHoy.id, naveSinPublicaciones.id],
            naveA: naveA.nombreNave, naveB: naveB.nombreNave, naveVencida: naveVencida.nombreNave, naveHoy: naveHoy.nombreNave, naveSinPublicaciones: naveSinPublicaciones.nombreNave,
            especieId: especie.id, nombreEspecie: especie.nombreEspecie, variedadId: variedad.id, presentacionId: presentacion.id, categoriaId: categoria.id,
            otraEspecieId: otraEspecie.id, otraVariedadId: otraVariedad.id, otraPresentacionId: otraPresentacion.id, otraCategoriaId: otraCategoria.id,
            calibreId: calibre.id, paisId: pais.id, publicacionIds, visibles, publicacionSoloBId: publicacionIds[39], publicacionOtraEspecieId: publicacionIds[40],
        };
    });
}

type Fixture = Awaited<ReturnType<typeof crearFixture>>;

async function borrarFixture(fixture: Fixture) {
    await db.transaction(async (tx) => {
        for (const id of fixture.publicacionIds) await tx.orm.public.Publicacion.where({ id }).delete();
        for (const operadorId of [fixture.operadorId, fixture.operadorVencidoId, fixture.operadorSoloBId]) {
            await tx.orm.public.Local.where({ operadorId }).deleteAll();
            await tx.orm.public.Operador.where({ id: operadorId }).delete();
        }
        await tx.orm.public.Productor.where({ id: fixture.productorId }).delete();
        for (const id of [fixture.usuarioId, fixture.usuarioVencidoId, fixture.usuarioSoloBId, fixture.usuarioProductorId]) await tx.orm.public.Usuario.where({ id }).delete();
        await tx.orm.public.Presentacion.where({ id: fixture.presentacionId }).delete();
        await tx.orm.public.Variedad.where({ id: fixture.variedadId }).delete();
        await tx.orm.public.Categoria.where({ id: fixture.categoriaId }).delete();
        await tx.orm.public.Especie.where({ id: fixture.especieId }).delete();
        await tx.orm.public.Presentacion.where({ id: fixture.otraPresentacionId }).delete();
        await tx.orm.public.Variedad.where({ id: fixture.otraVariedadId }).delete();
        await tx.orm.public.Categoria.where({ id: fixture.otraCategoriaId }).delete();
        await tx.orm.public.Especie.where({ id: fixture.otraEspecieId }).delete();
        await tx.orm.public.Calibre.where({ id: fixture.calibreId }).delete();
        await tx.orm.public.Pais.where({ id: fixture.paisId }).delete();
        for (const id of fixture.naveIds) await tx.orm.public.Nave.where({ id }).delete();
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

    it("devuelve las 36 coincidencias sin recortes y excluye bajas, no disponibles, contratos vencidos y productores", async () => {
        const consulta = { especie: fixture!.nombreEspecie, orden: "precioAsc" as const };
        const resultado = await consultarPublicaciones(consulta);
        expect(resultado.total).toBe(36);
        expect(resultado.publicaciones).toHaveLength(36);
        expect(resultado.publicaciones.map((publicacion) => publicacion.id)).toEqual([...fixture!.visibles, fixture!.publicacionSoloBId]);
        expect(resultado).not.toHaveProperty("pagina");
        expect(resultado).not.toHaveProperty("tamanoPagina");
        expect(resultado.totalCatalogo).toBeGreaterThanOrEqual(37);
        expect(resultado.publicaciones.every((publicacion) => publicacion.tipoPublicacion === "OPERADOR")).toBe(true);
        expect(resultado.opciones).toContainEqual({ especie: fixture!.nombreEspecie, variedad: "Criollo", presentacion: "Caja", categoria: "Primera", calibre: "Mediano" });
    });

    it("ejecuta búsqueda sin tildes, filtros numéricos y orden descendente en SQL real", async () => {
        const resultado = await consultarPublicaciones({ busqueda: `${fixture!.prefijo} limon`, precioMinimo: "110", precioMaximo: "112", orden: "precioDesc" });
        expect(resultado.total).toBe(3);
        expect(resultado.publicaciones.map((publicacion) => publicacion.precio)).toEqual([112, 111, 110]);
        expect(resultado.publicaciones.map((publicacion) => publicacion.id)).toEqual(fixture!.visibles.slice(10, 13).reverse());
    });

    it("filtra por nave sin duplicar publicaciones de un operador con dos locales en A y otro en B", async () => {
        const resultadoA = await consultarPublicaciones({ nave: fixture!.naveA, orden: "ninguno" });
        const publicacionesOperador = [...fixture!.visibles, fixture!.publicacionOtraEspecieId];
        expect(resultadoA.publicaciones.map((publicacion) => publicacion.id)).toEqual(publicacionesOperador);
        expect(resultadoA.total).toBe(36);
        expect(resultadoA.publicaciones.every((publicacion) => publicacion.operador.id === fixture!.operadorId)).toBe(true);
        expect(resultadoA.publicaciones.map((publicacion) => publicacion.id)).not.toContain(fixture!.publicacionSoloBId);

        const resultadoB = await consultarPublicaciones({ nave: fixture!.naveB, orden: "ninguno" });
        expect(resultadoB.publicaciones.map((publicacion) => publicacion.id)).toEqual([
            ...fixture!.visibles, fixture!.publicacionSoloBId, fixture!.publicacionOtraEspecieId,
        ]);
        expect(resultadoB.total).toBe(37);
    });

    it("combina nave, especie y rango de precios manteniendo las naves globales disponibles", async () => {
        const resultado = await consultarPublicaciones({
            nave: fixture!.naveA, especie: fixture!.nombreEspecie, precioMinimo: "110", precioMaximo: "112", orden: "precioDesc",
        });
        expect(resultado.publicaciones.map((publicacion) => publicacion.id)).toEqual(fixture!.visibles.slice(10, 13).reverse());
        expect(resultado.total).toBe(3);
        expect(resultado.naves.filter((nave) => nave.startsWith(fixture!.prefijo))).toEqual([fixture!.naveA, fixture!.naveB, fixture!.naveHoy]);
    });

    it.each([undefined, "", "Todas"])("consulta todas las naves con el filtro %j", async (nave) => {
        const resultado = await consultarPublicaciones({ busqueda: fixture!.prefijo, nave, orden: "ninguno" });
        expect(resultado.publicaciones.map((publicacion) => publicacion.id)).toEqual([
            ...fixture!.visibles, fixture!.publicacionSoloBId, fixture!.publicacionOtraEspecieId,
        ]);
        expect(resultado.total).toBe(37);
    });

    it("devuelve vacío para nave desconocida o distinta en mayúsculas sin perder opciones globales", async () => {
        for (const nave of [`${fixture!.prefijo} Desconocida`, fixture!.naveA.toLowerCase()]) {
            const resultado = await consultarPublicaciones({ nave });
            expect(resultado.publicaciones).toEqual([]);
            expect(resultado.total).toBe(0);
            expect(resultado.naves.filter((opcion) => opcion.startsWith(fixture!.prefijo))).toEqual([fixture!.naveA, fixture!.naveB, fixture!.naveHoy]);
        }

        const sinCoincidencias = await consultarPublicaciones({ nave: fixture!.naveA, especie: `${fixture!.prefijo} Inexistente`, precioMinimo: "999" });
        expect(sinCoincidencias.publicaciones).toEqual([]);
        expect(sinCoincidencias.naves.filter((nave) => nave.startsWith(fixture!.prefijo))).toEqual([fixture!.naveA, fixture!.naveB, fixture!.naveHoy]);
    });

    it("excluye los locales vencidos y conserva el día final del contrato en Montevideo", async () => {
        const vencidas = await consultarPublicaciones({ nave: fixture!.naveVencida });
        expect(vencidas.publicaciones).toEqual([]);
        expect(vencidas.total).toBe(0);
        expect(vencidas.naves).not.toContain(fixture!.naveVencida);
        expect(vencidas.naves).not.toContain(fixture!.naveSinPublicaciones);

        const venceHoy = await consultarPublicaciones({ nave: fixture!.naveHoy, orden: "ninguno" });
        expect(venceHoy.publicaciones.map((publicacion) => publicacion.id)).toEqual([...fixture!.visibles, fixture!.publicacionOtraEspecieId]);
        expect(venceHoy.total).toBe(36);
        expect(venceHoy.naves).toContain(fixture!.naveHoy);
    });

    it("conserva publicaciones de solo especie en mercados, perfiles, Mi Mercado e inicio", async () => {
        const especie = await db.orm.public.Especie.create({ nombreEspecie: "Solo especie " + randomUUID() });
        const creadas: number[] = [];
        try {
            const operador = await db.orm.public.Publicacion.create({ especieId: especie.id, tipoPublicacion: "OPERADOR" });
            creadas.push(operador.id);
            await db.orm.public.PublicacionOperador.create({ operadorId: fixture!.operadorId, publicacionId: operador.id });
            const productor = await db.orm.public.Publicacion.create({ especieId: especie.id, tipoPublicacion: "PRODUCTOR" });
            creadas.push(productor.id);
            await db.orm.public.PublicacionProductor.create({ productorId: fixture!.productorId, publicacionId: productor.id });
            const sesionOperador: DatosSesion = { usuarioId: fixture!.usuarioId, rol: "OPERADOR", expiraEn: 2000000000 };
            sesionActual.mockResolvedValue(sesionOperador);

            const mercado = await consultarPublicaciones({ especie: especie.nombreEspecie });
            expect(mercado.total).toBe(1);
            expect(mercado.publicaciones).toEqual([expect.objectContaining({
                id: operador.id, especie: especie.nombreEspecie, variedad: "", presentacion: "",
                categoria: "", calibre: "", precio: null,
            })]);
            expect(mercado.opciones).toContainEqual({ especie: especie.nombreEspecie, variedad: "", presentacion: "", categoria: "", calibre: "" });
            expect((await consultarPublicaciones({ especie: especie.nombreEspecie, variedad: "Inexistente" })).publicaciones).toEqual([]);
            const mercadoProductores = await consultarPublicacionesProductores(sesionOperador);
            expect(mercadoProductores.publicaciones).toContainEqual(expect.objectContaining({
                id: productor.id, especie: especie.nombreEspecie, variedad: "", presentacion: "",
                categoria: "", calibre: "", pais: "", ubicaciones: [],
            }));
            const miMercado = mapearPublicacionesMiMercado(await obtenerPublicacionesDeOperador(fixture!.operadorId));
            expect(miMercado).toContainEqual(expect.objectContaining({
                id: operador.id, especie: expect.objectContaining({ id: especie.id }), variedad: null,
                presentacion: null, categoria: null, calibre: null, paisId: null,
            }));
            const perfilOperador = await obtenerPerfilPublicoOperador(fixture!.prefijo);
            expect(perfilOperador?.publicaciones).toContainEqual(expect.objectContaining({ id: operador.id, especie: especie.nombreEspecie, pais: "" }));
            const perfilProductor = await obtenerPerfilProductor(fixture!.prefijo + "-productor");
            expect(perfilProductor?.publicaciones).toContainEqual(expect.objectContaining({ id: productor.id, especie: especie.nombreEspecie, pais: "" }));
            const perfilProductorOperador = await obtenerPerfilProductorPorOperador(fixture!.prefijo + "-productor");
            expect(perfilProductorOperador?.publicaciones).toContainEqual(expect.objectContaining({ id: productor.id, especie: especie.nombreEspecie, ubicaciones: [] }));
            expect(await obtenerEspeciesConPublicacionesActivas()).toContainEqual({ nombreEspecie: especie.nombreEspecie, cantidadOperadores: 1 });

            sesionActual.mockResolvedValue({ usuarioId: fixture!.usuarioProductorId, rol: "PRODUCTOR", expiraEn: 2000000000 });
            const miMercadoProductor = await obtenerPublicacionesMiMercadoProductor();
            expect(miMercadoProductor.publicaciones).toContainEqual(expect.objectContaining({
                id: productor.id, especie: expect.objectContaining({ id: especie.id }), variedad: null,
                presentacion: null, categoria: null, calibre: null, paisId: null, ubicaciones: [],
            }));
        } finally {
            sesionActual.mockReset();
            for (const id of creadas) await db.orm.public.Publicacion.where({ id }).delete();
            await db.orm.public.Especie.where({ id: especie.id }).delete();
        }
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
        const barrera = JSON.stringify({ barrera: randomUUID() });
        await ejecutarYEsperarNotificacion(oyente, barrera, () => oyente.query("SELECT pg_notify($1, $2)", ["uam_publicaciones", barrera]));
        expect(recibidos).not.toContain(payload);
        const guardada = await db.orm.public.Publicacion.where({ id: fixture!.visibles[0] }).first();
        expect(Number(guardada!.precio)).toBe(100);
        expect(guardada!.version).toBe(1);
    });
});
