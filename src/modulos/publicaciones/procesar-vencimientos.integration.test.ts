import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { parse } from "dotenv";
import { Temporal } from "temporal-polyfill";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerDatabaseUrlTest } from "@/infraestructura/persistencia/configuracion-db-test";
import type { DatosSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";

type BaseDatos = typeof import("@/infraestructura/persistencia/prisma/db").db;
type Servicio = typeof import("@/modulos/notificaciones/notificaciones");
type Rol = "OPERADOR" | "PRODUCTOR";
type Propietario = { id: number; sesion: DatosSesion };

const AHORA = Temporal.Instant.from("2030-01-15T15:00:00Z");
const CONFIGURACIONES = [
    ["aviso_vencimiento_publicaciones_productor_habilitado", "true"],
    ["anticipacion_aviso_publicaciones_productor", "7"],
] as const;
const configuracionesPrevias = new Map<string, string | null>();
const usuariosCreados: number[] = [];
const publicacionesCreadas: number[] = [];
const propietarios = new Map<Rol, Propietario>();
let especieId: number | undefined;
let db: BaseDatos;
let servicio: Servicio;
let procesar: typeof import("./procesar-vencimientos").procesarVencimientosUsuario;

function propietario(rol: Rol): Propietario {
    const encontrado = propietarios.get(rol);
    if (!encontrado) throw new Error("Falta el propietario creado para esta prueba.");
    return encontrado;
}

async function crearPublicacion(rol: Rol, fechaVigencia: Temporal.Instant) {
    if (!especieId) throw new Error("Falta la especie creada para esta prueba.");
    const publicacion = await db.orm.public.Publicacion.create({
        especieId,
        tipoPublicacion: rol,
        fechaVigencia,
        publicacionDisponible: true,
    });
    publicacionesCreadas.push(publicacion.id);
    const { id } = propietario(rol);
    if (rol === "OPERADOR") {
        await db.orm.public.PublicacionOperador.create({ publicacionId: publicacion.id, operadorId: id });
    } else {
        await db.orm.public.PublicacionProductor.create({ publicacionId: publicacion.id, productorId: id });
    }
    return publicacion;
}

describe.sequential("publicaciones conservan sus avisos enviados al borrar notificaciones", { timeout: 15000 }, () => {
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
        servicio = await import("@/modulos/notificaciones/notificaciones");
        ({ procesarVencimientosUsuario: procesar } = await import("./procesar-vencimientos"));

        for (const [nombreConfiguracion, valorConfiguracion] of CONFIGURACIONES) {
            const anterior = await db.orm.public.Configuracion.where({ nombreConfiguracion }).first();
            configuracionesPrevias.set(nombreConfiguracion, anterior?.valorConfiguracion ?? null);
            if (anterior) {
                await db.orm.public.Configuracion.where({ id: anterior.id }).update({ valorConfiguracion });
            } else {
                await db.orm.public.Configuracion.create({ nombreConfiguracion, valorConfiguracion });
            }
        }
        for (const rol of ["OPERADOR", "PRODUCTOR"] as const) {
            const usuario = await db.orm.public.Usuario.create({
                username: `avisos-vigencia-${randomUUID()}`,
                passwordHash: "hash-no-utilizable-de-integracion",
                rol,
            });
            usuariosCreados.push(usuario.id);
            const datos = {
                usuarioId: usuario.id,
                nombreFantasia: `Avisos de publicaciones ${randomUUID()}`,
                whatsApp: "+59899123456",
            };
            const perfil = rol === "OPERADOR"
                ? await db.orm.public.Operador.create(datos)
                : await db.orm.public.Productor.create(datos);
            propietarios.set(rol, {
                id: perfil.id,
                sesion: { usuarioId: usuario.id, rol, expiraEn: 2147483647 },
            });
        }
    });

    beforeEach(async () => {
        vi.spyOn(Temporal.Now, "instant").mockReturnValue(AHORA);
        especieId = (await db.orm.public.Especie.create({ nombreEspecie: `Especie avisos ${randomUUID()}` })).id;
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        if (!db) return;
        for (const id of publicacionesCreadas.splice(0)) {
            await db.orm.public.Publicacion.where({ id }).deleteAll();
        }
        if (especieId) {
            await db.orm.public.Especie.where({ id: especieId }).deleteAll();
            especieId = undefined;
        }
        for (const usuarioId of usuariosCreados) {
            await db.orm.public.Notificacion.where({ usuarioId }).deleteAll();
        }
    });

    afterAll(async () => {
        if (!db) return;
        for (const id of usuariosCreados) await db.orm.public.Usuario.where({ id }).deleteAll();
        for (const [nombreConfiguracion, valorConfiguracion] of configuracionesPrevias) {
            if (valorConfiguracion === null) {
                await db.orm.public.Configuracion.where({ nombreConfiguracion }).deleteAll();
            } else {
                await db.orm.public.Configuracion.where({ nombreConfiguracion }).update({ valorConfiguracion });
            }
        }
    });

    describe.each(["OPERADOR", "PRODUCTOR"] as const)("%s", (rol) => {
        it.each([
            { tipo: "proximo", horas: 48, borrado: "individual" },
            { tipo: "proximo", horas: 48, borrado: "todas" },
            { tipo: "vencido", horas: -48, borrado: "individual" },
            { tipo: "vencido", horas: -48, borrado: "todas" },
        ])("no recrea el aviso $tipo tras el borrado $borrado al listar o contar", async ({ tipo, horas, borrado }) => {
            const publicacion = await crearPublicacion(rol, AHORA.add({ hours: horas }));
            const { sesion } = propietario(rol);
            const inicial = await servicio.consultarNotificaciones(sesion);
            expect(inicial.notificaciones).toHaveLength(1);
            expect(await servicio.contarNotificacionesNoLeidas(sesion)).toBe(1);

            const noLeidas = borrado === "individual"
                ? await servicio.eliminarNotificacion(sesion, inicial.notificaciones[0].id)
                : await servicio.eliminarTodasNotificaciones(sesion);
            expect(noLeidas).toBe(0);
            const [listado, contador] = await Promise.all([
                servicio.consultarNotificaciones(sesion),
                servicio.contarNotificacionesNoLeidas(sesion),
            ]);
            expect(listado).toEqual({ notificaciones: [], noLeidas: 0 });
            expect(contador).toBe(0);
            const actual = await db.orm.public.Publicacion.where({ id: publicacion.id }).first();
            const enviada = tipo === "proximo" ? actual?.avisoProximoVencimientoEn : actual?.avisoVencimientoEn;
            expect(enviada?.equals(AHORA)).toBe(true);
            expect(tipo === "proximo" ? actual?.avisoVencimientoEn : actual?.avisoProximoVencimientoEn).toBeNull();
            if (tipo === "proximo") {
                expect(actual?.fecha.equals(publicacion.fecha)).toBe(true);
                expect(actual?.version).toBe(publicacion.version);
            }
        });

        it("envía un aviso nuevo cuando la renovación reinició los campos de aviso", async () => {
            const publicacion = await crearPublicacion(rol, AHORA.subtract({ hours: 48 }));
            const { sesion } = propietario(rol);
            await servicio.consultarNotificaciones(sesion);
            await servicio.eliminarTodasNotificaciones(sesion);
            const renovada = AHORA.add({ hours: 72 });
            await db.orm.public.Publicacion.where({ id: publicacion.id }).update({
                fechaVigencia: renovada,
                publicacionDisponible: true,
                avisoProximoVencimientoEn: null,
                avisoVencimientoEn: null,
            });

            const nuevo = await servicio.consultarNotificaciones(sesion);

            expect(nuevo.notificaciones).toHaveLength(1);
            expect(nuevo.notificaciones[0].texto).toContain("está próxima a vencer");
            const actual = await db.orm.public.Publicacion.where({ id: publicacion.id }).first();
            expect(actual?.fechaVigencia?.equals(renovada)).toBe(true);
            expect(actual?.avisoProximoVencimientoEn?.equals(AHORA)).toBe(true);
            expect(actual?.avisoVencimientoEn).toBeNull();
            await servicio.eliminarTodasNotificaciones(sesion);
            expect(await servicio.contarNotificacionesNoLeidas(sesion)).toBe(0);
        });

        it("envía el aviso de vencida aunque se haya borrado el aviso previo de esa misma vigencia", async () => {
            const vigencia = AHORA.add({ hours: 48 });
            const publicacion = await crearPublicacion(rol, vigencia);
            const { sesion } = propietario(rol);
            expect((await servicio.consultarNotificaciones(sesion)).notificaciones).toHaveLength(1);
            await servicio.eliminarTodasNotificaciones(sesion);
            vi.mocked(Temporal.Now.instant).mockReturnValue(vigencia.add({ hours: 1 }));

            const vencida = await servicio.consultarNotificaciones(sesion);

            expect(vencida.notificaciones).toHaveLength(1);
            expect(vencida.notificaciones[0].texto).toContain("ha vencido");
            expect(await db.orm.public.Publicacion.where({ id: publicacion.id }).first())
                .toMatchObject({ publicacionDisponible: false });
            const actual = await db.orm.public.Publicacion.where({ id: publicacion.id }).first();
            expect(actual?.avisoProximoVencimientoEn?.equals(AHORA)).toBe(true);
            expect(actual?.avisoVencimientoEn?.equals(vigencia.add({ hours: 1 }))).toBe(true);
            await servicio.eliminarTodasNotificaciones(sesion);
            expect(await servicio.contarNotificacionesNoLeidas(sesion)).toBe(0);
        });

        it("no duplica el aviso cuando se consultan simultáneamente listado y contador", async () => {
            const publicacion = await crearPublicacion(rol, AHORA.subtract({ hours: 48 }));
            const { sesion } = propietario(rol);

            await Promise.all([
                servicio.consultarNotificaciones(sesion),
                servicio.contarNotificacionesNoLeidas(sesion),
                procesar(sesion.usuarioId),
            ]);

            expect(await db.orm.public.Notificacion.where({ usuarioId: sesion.usuarioId }).all()).toHaveLength(1);
            const actual = await db.orm.public.Publicacion.where({ id: publicacion.id }).first();
            expect(actual?.avisoVencimientoEn?.equals(AHORA)).toBe(true);
            expect(actual?.avisoProximoVencimientoEn).toBeNull();
        });

        it("revierte la marca si falla el envío y permite reintentarlo después", async () => {
            const publicacion = await crearPublicacion(rol, AHORA.subtract({ hours: 48 }));
            const { sesion } = propietario(rol);
            await db.orm.public.Especie.where({ id: publicacion.especieId }).update({ nombreEspecie: "A".repeat(2050) });

            await expect(procesar(sesion.usuarioId)).rejects.toMatchObject({ name: "ErrorNotificaciones", status: 400 });

            expect(await db.orm.public.Notificacion.where({ usuarioId: sesion.usuarioId }).all()).toEqual([]);
            expect(await db.orm.public.Publicacion.where({ id: publicacion.id }).first())
                .toMatchObject({ publicacionDisponible: true, avisoProximoVencimientoEn: null, avisoVencimientoEn: null });
            await db.orm.public.Especie.where({ id: publicacion.especieId }).update({ nombreEspecie: "Tomate de integración" });
            await procesar(sesion.usuarioId);
            const actual = await db.orm.public.Publicacion.where({ id: publicacion.id }).first();
            expect(actual?.avisoVencimientoEn?.equals(AHORA)).toBe(true);
            expect(await db.orm.public.Notificacion.where({ usuarioId: sesion.usuarioId }).all()).toHaveLength(1);
        });
    });
});
