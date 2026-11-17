import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { parse } from "dotenv";
import { Temporal } from "temporal-polyfill";
import { beforeAll, describe, expect, it } from "vitest";
import { obtenerDatabaseUrlTest } from "@/infraestructura/persistencia/configuracion-db-test";
import type { ContextoTareaDiaria, TransaccionTarea } from "@/infraestructura/tareas-programadas/tipos";

type BaseDatos = typeof import("@/infraestructura/persistencia/prisma/db").db;
type Procesar = typeof import("./procesar-vencimientos").procesarVencimientosPublicaciones;
type Rol = "OPERADOR" | "PRODUCTOR";
type Cliente = Pick<BaseDatos, "orm">;
let db: BaseDatos;
let procesar: Procesar;

function finDelDia(fecha: string) {
    return Temporal.PlainDate.from(fecha).toPlainDateTime({ hour: 23, minute: 59, second: 59 })
        .toZonedDateTime("America/Montevideo").toInstant();
}
function contexto(tx: TransaccionTarea, fecha = "2030-01-15"): ContextoTareaDiaria {
    return { tx, fecha, limite: Temporal.PlainDate.from(fecha).toZonedDateTime("America/Montevideo").toInstant().toString() };
}
async function configurar(cliente: Cliente, rol: Rol, dias = 7, habilitados = true) {
    for (const [nombreConfiguracion, valorConfiguracion] of [
        [`aviso_vencimiento_publicaciones_${rol.toLowerCase()}_habilitado`, String(habilitados)],
        [`anticipacion_aviso_publicaciones_${rol.toLowerCase()}`, String(dias)],
        [`vigencia_publicaciones_${rol.toLowerCase()}_habilitada`, "false"],
    ]) {
        const existente = await cliente.orm.public.Configuracion.where({ nombreConfiguracion }).first();
        if (existente) await cliente.orm.public.Configuracion.where({ id: existente.id }).update({ valorConfiguracion });
        else await cliente.orm.public.Configuracion.create({ nombreConfiguracion, valorConfiguracion });
    }
}
async function crearPropietario(cliente: Cliente, rol: Rol) {
    const usuario = await cliente.orm.public.Usuario.create({
        username: `vigencia-diaria-${randomUUID()}`, passwordHash: "hash-no-utilizable-de-integracion", rol,
    });
    const datos = { usuarioId: usuario.id, nombreFantasia: `Vigencia diaria ${randomUUID()}`, whatsApp: "+59899123456" };
    const propietario = rol === "OPERADOR" ? await cliente.orm.public.Operador.create(datos) : await cliente.orm.public.Productor.create(datos);
    const especie = await cliente.orm.public.Especie.create({ nombreEspecie: `Tomate ${randomUUID()}` });
    return { id: propietario.id, usuarioId: usuario.id, especieId: especie.id, rol };
}
async function crearPublicacion(cliente: Cliente, propietario: Awaited<ReturnType<typeof crearPropietario>>, fecha: string | null) {
    const publicacion = await cliente.orm.public.Publicacion.create({
        especieId: propietario.especieId, tipoPublicacion: propietario.rol,
        fechaVigencia: fecha ? finDelDia(fecha) : null, publicacionDisponible: true,
    });
    if (propietario.rol === "OPERADOR") {
        await cliente.orm.public.PublicacionOperador.create({ publicacionId: publicacion.id, operadorId: propietario.id });
    } else {
        await cliente.orm.public.PublicacionProductor.create({ publicacionId: publicacion.id, productorId: propietario.id });
    }
    return publicacion;
}
async function conRollback(prueba: (tx: TransaccionTarea) => Promise<void>) {
    const rollback = new Error("Revertir únicamente la prueba de vigencia diaria");
    await expect(db.transaction(async (tx) => { await prueba(tx); throw rollback; })).rejects.toBe(rollback);
}

describe.sequential("vigencia diaria de publicaciones sin sesiones conectadas", { timeout: 30000 }, () => {
    beforeAll(async () => {
        const urlTest = process.env.DATABASE_URL_TEST;
        if (!urlTest || process.env.DATABASE_URL !== urlTest) throw new Error("Estas pruebas requieren DATABASE_URL_TEST como base activa.");
        for (const archivo of [".env", ".env.local"]) {
            if (existsSync(archivo)) obtenerDatabaseUrlTest({ DATABASE_URL: parse(readFileSync(archivo)).DATABASE_URL, DATABASE_URL_TEST: urlTest });
        }
        ({ db } = await import("@/infraestructura/persistencia/prisma/db"));
        ({ procesarVencimientosPublicaciones: procesar } = await import("./procesar-vencimientos"));
    });

    // El procesador puede encontrar publicaciones preexistentes; se revierte toda
    // la transacción de cada prueba, incluidos los avisos de otros propietarios.
    describe.each(["OPERADOR", "PRODUCTOR"] as const)("%s", (rol) => {
        it("avisa a las 00 de Uruguay con siete días calendario y conserva el último día de vigencia", async () => {
            await conRollback(async (tx) => {
                await configurar(tx, rol);
                const propietario = await crearPropietario(tx, rol);
                const fechas = ["2030-01-14", "2030-01-15", "2030-01-22", "2030-01-23", null];
                const publicaciones = [];
                for (const fecha of fechas) publicaciones.push(await crearPublicacion(tx, propietario, fecha));

                await procesar(contexto(tx), rol);

                const avisos = await tx.orm.public.Notificacion.where({ usuarioId: propietario.usuarioId }).all();
                expect(avisos).toHaveLength(3);
                for (const [indice, publicacion] of publicaciones.entries()) {
                    const actual = await tx.orm.public.Publicacion.where({ id: publicacion.id }).first();
                    expect(actual?.publicacionDisponible).toBe(indice !== 0);
                    expect(actual?.fecha.equals(publicacion.fecha)).toBe(true);
                    expect(actual?.version).toBe(publicacion.version);
                    expect(actual?.avisoVencimientoEn?.toString() ?? null).toBe(indice === 0 ? contexto(tx).limite : null);
                    expect(actual?.avisoProximoVencimientoEn?.toString() ?? null).toBe(indice === 1 || indice === 2 ? contexto(tx).limite : null);
                    const aviso = avisos.find(a => a.url?.endsWith(`publicacion=${publicacion.id}`));
                    expect(Boolean(aviso)).toBe(indice < 3);
                    if (aviso) {
                        expect(aviso.url).toBe(`${rol === "OPERADOR" ? "/mi-mercado" : "/mi-mercado/productor"}?publicacion=${publicacion.id}`);
                        expect(aviso.descripcion).toContain(indice === 0 ? "ha vencido" : "está próxima a vencer");
                    }
                }
            });
        });

        it("vence y avisa aunque los avisos previos y la vigencia administrativa estén desactivados", async () => {
            await conRollback(async (tx) => {
                await configurar(tx, rol, 7, false);
                const propietario = await crearPropietario(tx, rol);
                const vencida = await crearPublicacion(tx, propietario, "2030-01-14");
                const proxima = await crearPublicacion(tx, propietario, "2030-01-16");

                await procesar(contexto(tx), rol);

                const avisos = await tx.orm.public.Notificacion.where({ usuarioId: propietario.usuarioId }).all();
                expect(avisos).toHaveLength(1);
                expect(avisos[0].descripcion).toContain("ha vencido");
                expect((await tx.orm.public.Publicacion.where({ id: vencida.id }).first())?.publicacionDisponible).toBe(false);
                expect((await tx.orm.public.Publicacion.where({ id: proxima.id }).first())?.avisoProximoVencimientoEn).toBeNull();
            });
        });

        it.each(["2030-01-14", "2030-01-16"])("no recrea notificaciones eliminadas para la vigencia %s", async (fecha) => {
            await conRollback(async (tx) => {
                await configurar(tx, rol);
                const propietario = await crearPropietario(tx, rol);
                const publicacion = await crearPublicacion(tx, propietario, fecha);
                await procesar(contexto(tx), rol);
                expect(await tx.orm.public.Notificacion.where({ usuarioId: propietario.usuarioId }).all()).toHaveLength(1);
                const guardada = await tx.orm.public.Publicacion.where({ id: publicacion.id }).first();
                await tx.orm.public.Notificacion.where({ usuarioId: propietario.usuarioId }).deleteAll();

                await procesar(contexto(tx), rol);

                expect(await tx.orm.public.Notificacion.where({ usuarioId: propietario.usuarioId }).all()).toEqual([]);
                expect(await tx.orm.public.Publicacion.where({ id: publicacion.id }).first()).toEqual(guardada);
            });
        });

        it("permite avisar una nueva vigencia y después su vencimiento sin repetir el aviso previo", async () => {
            await conRollback(async (tx) => {
                await configurar(tx, rol);
                const propietario = await crearPropietario(tx, rol);
                const publicacion = await crearPublicacion(tx, propietario, "2030-01-14");
                await procesar(contexto(tx), rol);
                await tx.orm.public.Notificacion.where({ usuarioId: propietario.usuarioId }).deleteAll();
                await tx.orm.public.Publicacion.where({ id: publicacion.id }).update({
                    fechaVigencia: finDelDia("2030-01-17"), publicacionDisponible: true,
                    avisoProximoVencimientoEn: null, avisoVencimientoEn: null,
                });

                await procesar(contexto(tx), rol);
                const previos = await tx.orm.public.Notificacion.where({ usuarioId: propietario.usuarioId }).all();
                expect(previos).toHaveLength(1);
                expect(previos[0].descripcion).toContain("está próxima a vencer el 2030-01-17");
                await tx.orm.public.Notificacion.where({ usuarioId: propietario.usuarioId }).deleteAll();
                await procesar(contexto(tx, "2030-01-18"), rol);

                const vencidos = await tx.orm.public.Notificacion.where({ usuarioId: propietario.usuarioId }).all();
                expect(vencidos).toHaveLength(1);
                expect(vencidos[0].descripcion).toContain("ha vencido el 2030-01-17");
                expect(await tx.orm.public.Publicacion.where({ id: publicacion.id }).first()).toMatchObject({ publicacionDisponible: false });
            });
        });
    });

    it("respeta la anticipación propia de cada rol en la misma fecha de ejecución", async () => {
        await conRollback(async (tx) => {
            await configurar(tx, "OPERADOR", 1);
            await configurar(tx, "PRODUCTOR", 7);
            const operador = await crearPropietario(tx, "OPERADOR");
            const productor = await crearPropietario(tx, "PRODUCTOR");
            await crearPublicacion(tx, operador, "2030-01-17");
            await crearPublicacion(tx, productor, "2030-01-17");

            await procesar(contexto(tx), "OPERADOR");
            await procesar(contexto(tx), "PRODUCTOR");

            expect(await tx.orm.public.Notificacion.where({ usuarioId: operador.usuarioId }).all()).toEqual([]);
            expect(await tx.orm.public.Notificacion.where({ usuarioId: productor.usuarioId }).all()).toHaveLength(1);
        });
    });
});
