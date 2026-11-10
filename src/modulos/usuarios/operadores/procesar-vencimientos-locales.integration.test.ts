import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { parse } from "dotenv";
import { Temporal } from "temporal-polyfill";
import { beforeAll, describe, expect, it } from "vitest";
import { obtenerDatabaseUrlTest } from "@/infraestructura/persistencia/configuracion-db-test";
import type { TransaccionTarea } from "@/infraestructura/tareas-programadas/tipos";

type BaseDatos = typeof import("@/infraestructura/persistencia/prisma/db").db;
type Procesar = typeof import("./procesar-vencimientos-locales").procesarVencimientosLocales;
type Cliente = Pick<BaseDatos, "orm">;
type Entorno = {
    operador: { id: number; usuarioId: number; nombreFantasia: string };
    administradores: number[];
    productorId: number;
    naveId: number;
};

let db: BaseDatos;
let procesar: Procesar;
const configuracion = { habilitado: true, diasAnticipacionAviso: 3 };

function instanteFin(fecha: string) {
    return Temporal.PlainDate.from(fecha).toPlainDateTime({ hour: 23, minute: 59, second: 59 })
        .toZonedDateTime("America/Montevideo").toInstant();
}

function contexto(tx: TransaccionTarea, fecha = "2026-11-06") {
    const limite = Temporal.PlainDate.from(fecha).toPlainDateTime({ hour: 12 })
        .toZonedDateTime("America/Montevideo").toInstant().toString();
    return { tx, fecha, limite };
}

async function crearEntorno(tx: Cliente): Promise<Entorno> {
    const usuarios = [];
    for (const rol of ["OPERADOR", "PRODUCTOR", "ADMINISTRADOR", "ADMINISTRADOR"] as const) {
        usuarios.push(await tx.orm.public.Usuario.create({
            username: `avisos-local-${randomUUID()}`, passwordHash: "hash-no-utilizable-de-integracion", rol,
        }));
    }
    const operador = await tx.orm.public.Operador.create({
        usuarioId: usuarios[0].id, nombreFantasia: `Operador locales ${randomUUID()}`, whatsApp: "099000000",
    });
    const nave = await tx.orm.public.Nave.create({ nombreNave: `Nave avisos ${randomUUID()}` });
    return { operador, administradores: [usuarios[2].id, usuarios[3].id], productorId: usuarios[1].id, naveId: nave.id };
}

async function crearLocal(tx: Cliente, entorno: Entorno, fecha: string | null, numeroLocal: string = randomUUID()) {
    return tx.orm.public.Local.create({
        operadorId: entorno.operador.id, naveId: entorno.naveId, numeroLocal,
        finContrato: fecha === null ? null : instanteFin(fecha),
    });
}

async function avisos(tx: Cliente, entorno: Entorno) {
    return tx.orm.public.Notificacion.where({ url: `/gestion-operadores/${entorno.operador.id}` }).all();
}

async function marcas(tx: Cliente, entorno: Entorno) {
    return tx.orm.public.AvisoVencimientoLocal.where({ operadorId: entorno.operador.id }).all();
}

async function conRollback(prueba: (tx: TransaccionTarea) => Promise<void>) {
    const rollback = new Error("Revertir exclusivamente la transacción de prueba de avisos de locales");
    await expect(db.transaction(async (tx) => {
        await prueba(tx);
        throw rollback;
    })).rejects.toBe(rollback);
}

describe.sequential("avisos transaccionales de vencimiento de locales", { timeout: 30_000 }, () => {
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
        ({ procesarVencimientosLocales: procesar } = await import("./procesar-vencimientos-locales"));
    });

    // El procesador también puede encontrar locales preexistentes: cada caso revierte
    // toda su transacción, incluidos los avisos generados para esos otros locales.
    it("deshabilitado conserva los contratos y no registra ni envía avisos", async () => {
        await conRollback(async (tx) => {
            const entorno = await crearEntorno(tx);
            const local = await crearLocal(tx, entorno, "2026-11-05");

            expect(await procesar(contexto(tx), { ...configuracion, habilitado: false })).toBe(0);

            expect(await avisos(tx, entorno)).toEqual([]);
            expect(await marcas(tx, entorno)).toEqual([]);
            expect(await tx.orm.public.Local.where({ id: local.id }).first()).toEqual(local);
        });
    });

    it("respeta los límites de tres días y el último día vigente en Uruguay, y sólo avisa a administradores", async () => {
        await conRollback(async (tx) => {
            const entorno = await crearEntorno(tx);
            const casos = [
                { fecha: "2026-11-10", numero: "fuera-del-aviso", tipo: null },
                { fecha: "2026-11-09", numero: "exactamente-tres-dias", tipo: "proximo" },
                { fecha: "2026-11-08", numero: "dos-dias", tipo: "proximo" },
                { fecha: "2026-11-06", numero: "ultimo-dia-vigente", tipo: "proximo" },
                { fecha: "2026-11-05", numero: "ya-vencido", tipo: "vencido" },
                { fecha: null, numero: "sin-fecha", tipo: null },
            ];
            const locales = [];
            for (const caso of casos) locales.push(await crearLocal(tx, entorno, caso.fecha, caso.numero));

            await procesar(contexto(tx), configuracion);

            const registros = await marcas(tx, entorno);
            expect(registros.map((marca) => ({ numero: marca.numeroLocal, tipo: marca.tipo })))
                .toEqual(expect.arrayContaining(casos.filter((caso) => caso.tipo !== null)
                    .map((caso) => ({ numero: caso.numero, tipo: caso.tipo }))));
            expect(registros).toHaveLength(4);
            const notificaciones = await avisos(tx, entorno);
            for (const id of entorno.administradores) {
                expect(notificaciones.filter((aviso) => aviso.usuarioId === id)).toHaveLength(4);
            }
            expect(notificaciones.some((aviso) => aviso.usuarioId === entorno.operador.usuarioId || aviso.usuarioId === entorno.productorId)).toBe(false);
            for (const aviso of notificaciones) {
                expect(aviso.descripcion).toContain(entorno.operador.nombreFantasia);
                expect(aviso.vista).toBe(false);
            }
            for (const local of locales) expect(await tx.orm.public.Local.where({ id: local.id }).first()).toEqual(local);
        });
    });

    it("no repite avisos diarios ni al borrar la notificación, y envía otro al vencer", async () => {
        await conRollback(async (tx) => {
            const entorno = await crearEntorno(tx);
            await crearLocal(tx, entorno, "2026-11-09");
            await procesar(contexto(tx), configuracion);
            const iniciales = await avisos(tx, entorno);
            await procesar(contexto(tx), configuracion);
            await procesar(contexto(tx, "2026-11-08"), configuracion);
            expect(await avisos(tx, entorno)).toEqual(iniciales);

            await tx.orm.public.Notificacion.where({ url: `/gestion-operadores/${entorno.operador.id}` }).deleteAndCount();
            await procesar(contexto(tx, "2026-11-09"), configuracion);
            expect(await avisos(tx, entorno)).toEqual([]);
            expect(await marcas(tx, entorno)).toHaveLength(1);

            await procesar(contexto(tx, "2026-11-10"), configuracion);
            const vencidas = await avisos(tx, entorno);
            for (const id of entorno.administradores) expect(vencidas.filter((aviso) => aviso.usuarioId === id)).toHaveLength(1);
            expect(vencidas.every((aviso) => aviso.descripcion.includes("venció"))).toBe(true);
            expect((await marcas(tx, entorno)).map((marca) => marca.tipo).sort()).toEqual(["proximo", "vencido"]);
            await procesar(contexto(tx, "2026-11-11"), configuracion);
            expect(await avisos(tx, entorno)).toEqual(vencidas);
        });
    });

    it("no repite el aviso si editar el operador borra y recrea el mismo local y contrato", async () => {
        await conRollback(async (tx) => {
            const entorno = await crearEntorno(tx);
            const local = await crearLocal(tx, entorno, "2026-11-09", "local-recreado");
            await procesar(contexto(tx), configuracion);
            const anteriores = await avisos(tx, entorno);
            await tx.orm.public.Local.where({ id: local.id }).delete();
            const recreado = await crearLocal(tx, entorno, "2026-11-09", local.numeroLocal);
            expect(recreado.id).not.toBe(local.id);

            await procesar(contexto(tx, "2026-11-07"), configuracion);

            expect(await avisos(tx, entorno)).toEqual(anteriores);
            expect(await marcas(tx, entorno)).toHaveLength(1);
        });
    });

    it("no repite el aviso si el local se recrea con otra hora que conserva el mismo día de contrato en Uruguay", async () => {
        await conRollback(async (tx) => {
            const entorno = await crearEntorno(tx);
            const local = await crearLocal(tx, entorno, "2026-11-09", "misma-fecha-otra-hora");
            await procesar(contexto(tx), configuracion);
            const anteriores = await avisos(tx, entorno);
            await tx.orm.public.Local.where({ id: local.id }).delete();
            const recreado = await tx.orm.public.Local.create({
                operadorId: entorno.operador.id, naveId: entorno.naveId, numeroLocal: local.numeroLocal,
                finContrato: Temporal.Instant.from("2026-11-09T23:59:59Z"),
            });
            expect(recreado.finContrato?.toString()).not.toBe(local.finContrato?.toString());

            await procesar(contexto(tx, "2026-11-07"), configuracion);

            expect(await avisos(tx, entorno)).toEqual(anteriores);
            expect((await marcas(tx, entorno)).map((marca) => marca.finContrato.toString())).toEqual(["2026-11-09"]);
        });
    });

    it("una renovación permite avisar por la nueva fecha sin perder los registros anteriores", async () => {
        await conRollback(async (tx) => {
            const entorno = await crearEntorno(tx);
            const local = await crearLocal(tx, entorno, "2026-11-09", "renovado");
            await procesar(contexto(tx), configuracion);
            await tx.orm.public.Local.where({ id: local.id }).update({ finContrato: instanteFin("2026-11-20") });
            await procesar(contexto(tx, "2026-11-10"), configuracion);
            expect(await marcas(tx, entorno)).toHaveLength(1);
            await procesar(contexto(tx, "2026-11-17"), configuracion);

            expect((await marcas(tx, entorno)).map((marca) => marca.finContrato.toString()).sort())
                .toEqual(["2026-11-09", "2026-11-20"]);
            for (const id of entorno.administradores) {
                expect((await avisos(tx, entorno)).filter((aviso) => aviso.usuarioId === id)).toHaveLength(2);
            }
        });
    });

    it("usa la anticipación configurada y no envía un aviso previo tardío a contratos vencidos", async () => {
        await conRollback(async (tx) => {
            const entorno = await crearEntorno(tx);
            await crearLocal(tx, entorno, "2026-11-13", "siete-dias");
            await crearLocal(tx, entorno, "2026-11-14", "ocho-dias");
            await crearLocal(tx, entorno, "2026-11-01", "vencido-antes-de-iniciar");

            await procesar(contexto(tx), { ...configuracion, diasAnticipacionAviso: 7 });

            const registros = await marcas(tx, entorno);
            expect(registros.map((marca) => ({ numero: marca.numeroLocal, tipo: marca.tipo })))
                .toEqual(expect.arrayContaining([
                    { numero: "siete-dias", tipo: "proximo" },
                    { numero: "vencido-antes-de-iniciar", tipo: "vencido" },
                ]));
            expect(registros).toHaveLength(2);
        });
    });

    it("sin administradores no consume el aviso y puede enviarlo cuando haya destinatarios", async () => {
        await conRollback(async (tx) => {
            const entorno = await crearEntorno(tx);
            await crearLocal(tx, entorno, "2026-11-09");
            await tx.orm.public.Usuario.where({ rol: "ADMINISTRADOR" }).updateAndCount({ rol: "PRODUCTOR" });

            await procesar(contexto(tx), configuracion);

            expect(await avisos(tx, entorno)).toEqual([]);
            expect(await marcas(tx, entorno)).toEqual([]);
            await tx.orm.public.Usuario.where({ id: entorno.administradores[0] }).update({ rol: "ADMINISTRADOR" });
            await procesar(contexto(tx), configuracion);
            expect(await avisos(tx, entorno)).toHaveLength(1);
            expect(await marcas(tx, entorno)).toHaveLength(1);
        });
    });
});
