import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { parse } from "dotenv";
import { Temporal } from "temporal-polyfill";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { DatosSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { obtenerDatabaseUrlTest } from "@/infraestructura/persistencia/configuracion-db-test";

type BaseDatos = typeof import("@/infraestructura/persistencia/prisma/db").db;
type Servicio = typeof import("./notificaciones");
type DatosEnvio = Parameters<Servicio["enviarNotificacion"]>[0];

let db: BaseDatos;
let servicio: Servicio;
let operador: DatosSesion;
let productor: DatosSesion;
let administrador: DatosSesion;
const usuariosCreados: number[] = [];
const textosEnviados = new Set<string>();

function textoUnico() {
    const texto = `Aviso de integración ${randomUUID()}`;
    textosEnviados.add(texto);
    return texto;
}

async function crearNotificacion(sesion: DatosSesion, datos: { texto?: string; titulo?: string; vista?: boolean; fecha?: string } = {}) {
    return db.orm.public.Notificacion.create({
        usuarioId: sesion.usuarioId,
        titulo: datos.titulo ?? "Notificación de integración",
        descripcion: datos.texto ?? textoUnico(),
        vista: datos.vista ?? false,
        url: null,
        ...(datos.fecha ? { fecha: Temporal.Instant.from(datos.fecha) } : {}),
    });
}

async function estadoPropio() {
    const estados = [];
    for (const sesion of [operador, productor, administrador]) {
        estados.push(await servicio.consultarNotificaciones(sesion));
    }
    return estados;
}

describe.sequential("notificaciones persistidas y aisladas por usuario", { timeout: 15000 }, () => {
    beforeAll(async () => {
        const urlTest = process.env.DATABASE_URL_TEST;
        if (!urlTest || process.env.DATABASE_URL !== urlTest) {
            throw new Error("Estas pruebas requieren DATABASE_URL_TEST como base activa.");
        }
        for (const archivo of [".env", ".env.local"]) {
            if (!existsSync(archivo)) continue;
            obtenerDatabaseUrlTest({ DATABASE_URL: parse(readFileSync(archivo)).DATABASE_URL, DATABASE_URL_TEST: urlTest });
        }
        ({ db } = await import("@/infraestructura/persistencia/prisma/db"));
        servicio = await import("./notificaciones");
        const sesiones: DatosSesion[] = [];
        for (const rol of ["OPERADOR", "PRODUCTOR", "ADMINISTRADOR"] as const) {
            const usuario = await db.orm.public.Usuario.create({
                username: `notificaciones-${randomUUID()}`,
                passwordHash: "hash-no-utilizable-de-integracion",
                rol,
            });
            usuariosCreados.push(usuario.id);
            sesiones.push({ usuarioId: usuario.id, rol, expiraEn: 2147483647 });
        }
        [operador, productor, administrador] = sesiones;
    });

    afterEach(async () => {
        if (!db) return;
        for (const descripcion of textosEnviados) {
            const filas = await db.orm.public.Notificacion.where({ descripcion }).select("id").all();
            for (const { id } of filas) await db.orm.public.Notificacion.where({ id }).deleteAll();
        }
        textosEnviados.clear();
        for (const usuarioId of usuariosCreados) {
            await db.orm.public.Notificacion.where({ usuarioId }).deleteAll();
        }
    });

    afterAll(async () => {
        if (!db) return;
        for (const id of usuariosCreados) await db.orm.public.Usuario.where({ id }).deleteAll();
    });

    it("une usuarios explícitos y roles actuales sin duplicar destinatarios", async () => {
        const texto = textoUnico();
        const usuariosDelRol = await db.orm.public.Usuario.where({ rol: "OPERADOR" }).select("id").all();
        const esperados = [...new Set([...usuariosDelRol.map(({ id }) => id), productor.usuarioId])].sort((a, b) => a - b);

        const resultado = await servicio.enviarNotificacion({
            texto,
            url: "/notificaciones?origen=prueba#aviso",
            usuarios: [operador.usuarioId, operador.usuarioId, productor.usuarioId],
            roles: ["OPERADOR", "OPERADOR"],
        });

        const filas = await db.orm.public.Notificacion.where({ descripcion: texto }).all();
        expect(resultado).toEqual({ enviadas: esperados.length });
        expect(filas.map(({ usuarioId }) => usuarioId).sort((a, b) => a - b)).toEqual(esperados);
        expect(new Set(filas.map(({ id }) => id)).size).toBe(esperados.length);
        expect(filas.every(({ vista, url }) => !vista && url === "/notificaciones?origen=prueba#aviso")).toBe(true);
        expect((await servicio.consultarNotificaciones(administrador)).notificaciones).toEqual([]);
    });

    it("guarda copias independientes y leer o borrar una no afecta al otro destinatario", async () => {
        const texto = textoUnico();
        await servicio.enviarNotificacion({ texto, usuarios: [operador.usuarioId, productor.usuarioId] });
        const propia = (await servicio.consultarNotificaciones(operador)).notificaciones[0];
        const ajenaAntes = await servicio.consultarNotificaciones(productor);

        expect(await servicio.marcarNotificacionLeida(operador, propia.id)).toBe(0);
        expect((await servicio.consultarNotificaciones(operador)).notificaciones[0]).toMatchObject({ id: propia.id, leida: true });
        expect(await servicio.consultarNotificaciones(productor)).toEqual(ajenaAntes);
        expect(await servicio.eliminarNotificacion(operador, propia.id)).toBe(0);
        expect(await servicio.consultarNotificaciones(operador)).toEqual({ notificaciones: [], noLeidas: 0 });
        expect(await servicio.consultarNotificaciones(productor)).toEqual(ajenaAntes);
    });

    it("lista sólo las propias, ordena por fecha e id descendentes y conserva fecha al marcar leída", async () => {
        const antigua = await crearNotificacion(operador, { fecha: "2020-01-01T12:00:00Z" });
        const reciente = await crearNotificacion(operador, { fecha: "2021-01-01T12:00:00Z" });
        const empate = await crearNotificacion(operador, { fecha: "2021-01-01T12:00:00Z", vista: true });
        await crearNotificacion(productor, { fecha: "2022-01-01T12:00:00Z" });

        const antes = await servicio.consultarNotificaciones(operador);
        expect(antes.notificaciones.map(({ id }) => id)).toEqual([empate.id, reciente.id, antigua.id]);
        expect(antes.noLeidas).toBe(2);
        expect(await servicio.contarNotificacionesNoLeidas(operador)).toBe(2);
        expect(antes.notificaciones[0]).toEqual({
            id: empate.id,
            texto: empate.descripcion,
            url: null,
            leida: true,
            fecha: expect.any(String),
        });
        expect(Temporal.Instant.from(antes.notificaciones[0].fecha).equals(Temporal.Instant.from("2021-01-01T12:00:00Z"))).toBe(true);
        expect(await servicio.marcarNotificacionLeida(operador, reciente.id)).toBe(1);
        const despues = await servicio.consultarNotificaciones(operador);
        expect(despues.notificaciones).toEqual(antes.notificaciones.map((fila) => fila.id === reciente.id ? { ...fila, leida: true } : fila));
        expect(await servicio.marcarNotificacionLeida(operador, reciente.id)).toBe(1);
        expect(await servicio.contarNotificacionesNoLeidas(operador)).toBe(1);
    });

    it("un administrador tampoco puede leer, marcar ni borrar notificaciones ajenas", async () => {
        const propia = await crearNotificacion(administrador);
        const ajena = await crearNotificacion(operador);
        const antes = await estadoPropio();

        expect((await servicio.consultarNotificaciones(administrador)).notificaciones.map(({ id }) => id)).toEqual([propia.id]);
        await expect(servicio.marcarNotificacionLeida(administrador, ajena.id)).rejects.toMatchObject({ status: 404 });
        await expect(servicio.eliminarNotificacion(administrador, ajena.id)).rejects.toMatchObject({ status: 404 });
        expect(await estadoPropio()).toEqual(antes);
    });

    it("trata igual una notificación inexistente y una de otro usuario", async () => {
        const ajena = await crearNotificacion(productor);
        const eliminada = await crearNotificacion(operador);
        await servicio.eliminarNotificacion(operador, eliminada.id);
        const antes = await estadoPropio();

        for (const id of [ajena.id, eliminada.id]) {
            await expect(servicio.marcarNotificacionLeida(operador, id)).rejects.toMatchObject({ status: 404 });
            await expect(servicio.eliminarNotificacion(operador, id)).rejects.toMatchObject({ status: 404 });
        }
        expect(await estadoPropio()).toEqual(antes);
    });

    it("las acciones masivas actualizan sólo las propias y son idempotentes", async () => {
        await crearNotificacion(operador);
        await crearNotificacion(operador, { vista: true });
        await crearNotificacion(operador);
        await crearNotificacion(productor);
        await crearNotificacion(administrador);
        const productorAntes = await servicio.consultarNotificaciones(productor);
        const administradorAntes = await servicio.consultarNotificaciones(administrador);

        expect(await servicio.marcarTodasNotificacionesLeidas(operador)).toBe(0);
        expect(await servicio.marcarTodasNotificacionesLeidas(operador)).toBe(0);
        const leidas = await servicio.consultarNotificaciones(operador);
        expect(leidas.notificaciones).toHaveLength(3);
        expect(leidas.notificaciones.every(({ leida }) => leida)).toBe(true);
        expect(await servicio.eliminarTodasNotificaciones(operador)).toBe(0);
        expect(await servicio.eliminarTodasNotificaciones(operador)).toBe(0);
        expect(await servicio.consultarNotificaciones(operador)).toEqual({ notificaciones: [], noLeidas: 0 });
        expect(await servicio.consultarNotificaciones(productor)).toEqual(productorAntes);
        expect(await servicio.consultarNotificaciones(administrador)).toEqual(administradorAntes);
    });

    it("rechaza todas las consultas y mutaciones sin sesión sin tocar datos", async () => {
        const existente = await crearNotificacion(operador);
        const antes = await estadoPropio();
        const operaciones = [
            () => servicio.consultarNotificaciones(null),
            () => servicio.contarNotificacionesNoLeidas(null),
            () => servicio.marcarNotificacionLeida(null, existente.id),
            () => servicio.eliminarNotificacion(null, existente.id),
            () => servicio.marcarTodasNotificacionesLeidas(null),
            () => servicio.eliminarTodasNotificaciones(null),
        ];
        for (const operacion of operaciones) await expect(operacion()).rejects.toMatchObject({ status: 401 });
        expect(await estadoPropio()).toEqual(antes);
    });

    it("rechaza identificadores de notificación inválidos sin cambios", async () => {
        await crearNotificacion(operador);
        const antes = await estadoPropio();
        for (const id of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2147483648]) {
            await expect(servicio.marcarNotificacionLeida(operador, id)).rejects.toMatchObject({ status: 400 });
            await expect(servicio.eliminarNotificacion(operador, id)).rejects.toMatchObject({ status: 400 });
        }
        expect(await estadoPropio()).toEqual(antes);
    });

    it("no hace un envío global cuando faltan destinatarios o ya no existen", async () => {
        const eliminado = await db.orm.public.Usuario.create({ username: `notificaciones-eliminado-${randomUUID()}`, passwordHash: "no-utilizable", rol: "PRODUCTOR" });
        usuariosCreados.push(eliminado.id);
        await db.orm.public.Usuario.where({ id: eliminado.id }).deleteAll();

        for (const destino of [{}, { usuarios: [], roles: [] }, { usuarios: [eliminado.id] }]) {
            const texto = textoUnico();
            expect(await servicio.enviarNotificacion({ texto, ...destino })).toEqual({ enviadas: 0 });
            expect(await db.orm.public.Notificacion.where({ descripcion: texto }).all()).toEqual([]);
        }
    });

    it("valida el mensaje y los destinatarios completos antes de crear ninguna copia", async () => {
        const texto = textoUnico();
        const entradas: unknown[] = [
            { texto: "", usuarios: [operador.usuarioId] },
            { texto: " \n\t ", usuarios: [operador.usuarioId] },
            { texto: "x".repeat(2001), usuarios: [operador.usuarioId] },
            { texto: 7, usuarios: [operador.usuarioId] },
            { texto, usuarios: [operador.usuarioId, 0] },
            { texto, usuarios: [operador.usuarioId, -1] },
            { texto, usuarios: [operador.usuarioId, 1.5] },
            { texto, usuarios: [operador.usuarioId, 2147483648] },
            { texto, usuarios: [operador.usuarioId, "1"] },
            { texto, usuarios: "OPERADOR" },
            { texto, usuarios: [operador.usuarioId], roles: ["ADMINISTRADOR", "COMPRADOR"] },
            { texto, usuarios: [operador.usuarioId], roles: "OPERADOR" },
        ];
        const antes = await estadoPropio();
        for (const entrada of entradas) {
            await expect(servicio.enviarNotificacion(entrada as DatosEnvio)).rejects.toMatchObject({ status: 400 });
        }
        expect(await estadoPropio()).toEqual(antes);
        expect(await db.orm.public.Notificacion.where({ descripcion: texto }).all()).toEqual([]);
    });

    it("rechaza enlaces externos y ambiguos y acepta enlaces internos o ausencia de enlace", async () => {
        for (const url of ["https://externo.example/", "//externo.example/", "javascript:alert(1)", "/\\externo.example/", "/inicio\n", "/inicio\u0000"]) {
            const texto = textoUnico();
            await expect(servicio.enviarNotificacion({ texto, url, usuarios: [operador.usuarioId] })).rejects.toMatchObject({ status: 400 });
            expect(await db.orm.public.Notificacion.where({ descripcion: texto }).all()).toEqual([]);
        }
        for (const url of [undefined, null, "/mi-mercado/productor", "/notificaciones?pagina=2#aviso"]) {
            const texto = textoUnico();
            expect(await servicio.enviarNotificacion({ texto, url, usuarios: [operador.usuarioId] })).toEqual({ enviadas: 1 });
            const fila = (await servicio.consultarNotificaciones(operador)).notificaciones.find((notificacion) => notificacion.texto === texto);
            expect(fila).toMatchObject({ texto, url: url ?? null, leida: false });
            expect(Number.isFinite(Date.parse(fila!.fecha))).toBe(true);
        }
    });

    it("mantiene visibles los avisos anteriores sin descripción usando su título", async () => {
        const legacy = await crearNotificacion(productor, { titulo: "Aviso anterior", texto: "", fecha: "2020-01-01T00:00:00Z" });
        const resultado = await servicio.consultarNotificaciones(productor);
        expect(resultado.notificaciones).toEqual([{
            id: legacy.id,
            texto: "Aviso anterior",
            url: null,
            leida: false,
            fecha: expect.any(String),
        }]);
    });
});
