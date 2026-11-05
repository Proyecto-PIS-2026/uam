import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { parse } from "dotenv";
import { Temporal } from "temporal-polyfill";
import { beforeAll, describe, expect, it } from "vitest";
import { obtenerDatabaseUrlTest } from "@/infraestructura/persistencia/configuracion-db-test";
import type { TransaccionTarea } from "@/infraestructura/tareas-programadas/tipos";

type BaseDatos = typeof import("@/infraestructura/persistencia/prisma/db").db;
type Cliente = Pick<BaseDatos, "orm">;
type Procesar = typeof import("./procesar-vencimientos-fotos").procesarVencimientosFotos;
type Almacenamiento = typeof import("@/infraestructura/imagenes/almacenamiento-postgres").AlmacenamientoImagenesPostgres;
type Rol = "OPERADOR" | "PRODUCTOR";
type Propietario = { id: number; usuarioId: number; rol: Rol };
type Entorno = {
    propietarios: Record<Rol, Propietario>;
    administradorId: number;
    especie: { id: number; nombreEspecie: string };
};
type Foto = { publicacionId: number; clave: string; url: string; propietario: Propietario };

let db: BaseDatos;
let procesar: Procesar;
let AlmacenamientoImagenesPostgres: Almacenamiento;
const configuracion = { habilitado: true, diasVigencia: 30, diasAnticipacionAviso: 7 } as const;
const limite = "2026-11-04T15:00:00Z";
const fecha = "2026-11-04";
const inicioAviso = "2026-10-12T15:00:00Z";
const inicioVencimiento = "2026-10-05T15:00:00Z";
const fechaPublicacion = Temporal.Instant.from("2020-01-01T12:00:00Z");
const roles: readonly Rol[] = ["OPERADOR", "PRODUCTOR"];

async function crearEntorno(cliente: Cliente): Promise<Entorno> {
    const propietarios = {} as Record<Rol, Propietario>;
    for (const rol of roles) {
        const identificador = randomUUID();
        const usuario = await cliente.orm.public.Usuario.create({
            username: `aging-${identificador}`,
            passwordHash: "hash-no-utilizable-de-integracion",
            rol,
        });
        const datos = { usuarioId: usuario.id, nombreFantasia: `Aging ${identificador}`, whatsApp: "099000000" };
        const propietario = rol === "OPERADOR"
            ? await cliente.orm.public.Operador.create(datos)
            : await cliente.orm.public.Productor.create(datos);
        propietarios[rol] = { id: propietario.id, usuarioId: usuario.id, rol };
    }
    const administrador = await cliente.orm.public.Usuario.create({
        username: `aging-admin-${randomUUID()}`,
        passwordHash: "hash-no-utilizable-de-integracion",
        rol: "ADMINISTRADOR",
    });
    const especie = await cliente.orm.public.Especie.create({ nombreEspecie: `Especie aging ${randomUUID()}` });
    return { propietarios, administradorId: administrador.id, especie };
}

async function crearFoto(cliente: Cliente, entorno: Entorno, rol: Rol, cargadaEn: string | null): Promise<Foto> {
    const propietario = entorno.propietarios[rol];
    const publicacion = await cliente.orm.public.Publicacion.create({
        especieId: entorno.especie.id,
        tipoPublicacion: rol,
        fecha: fechaPublicacion,
        version: 7,
        cantidadUnidades: 12,
        publicacionActiva: true,
        publicacionDisponible: true,
    });
    if (rol === "OPERADOR") {
        await cliente.orm.public.PublicacionOperador.create({ publicacionId: publicacion.id, operadorId: propietario.id });
    } else {
        await cliente.orm.public.PublicacionProductor.create({ publicacionId: publicacion.id, productorId: propietario.id });
    }
    const archivo = `${randomUUID()}.webp`;
    const clave = `publicaciones/${publicacion.id}/${archivo}`;
    const url = `/api/publicaciones/imagenes/${publicacion.id}/${archivo}`;
    await cliente.orm.public.Imagen.create({
        clave,
        contenido: Buffer.from([82, 73, 70, 70, 0, 255, 87, 69, 66, 80]),
        cargadaEn: cargadaEn === null ? null : Temporal.Instant.from(cargadaEn),
    });
    await cliente.orm.public.Publicacion.where({ id: publicacion.id }).update({ foto: url, fecha: fechaPublicacion });
    return { publicacionId: publicacion.id, clave, url, propietario };
}

async function leerFoto(cliente: Cliente, foto: Foto) {
    const publicacion = await cliente.orm.public.Publicacion.where({ id: foto.publicacionId }).first();
    const imagen = await cliente.orm.public.Imagen.where({ clave: foto.clave }).first();
    if (!publicacion) throw new Error("No se encontró la publicación de la prueba de aging.");
    return {
        publicacion: {
            ...publicacion, fecha: publicacion.fecha.toString(),
            fotoEliminadaPorVencimientoEn: publicacion.fotoEliminadaPorVencimientoEn?.toString() ?? null,
        },
        imagen: imagen ? {
            ...imagen,
            contenido: Buffer.from(imagen.contenido),
            cargadaEn: imagen.cargadaEn?.toString() ?? null,
            avisoVencimientoEn: imagen.avisoVencimientoEn?.toString() ?? null,
        } : null,
    };
}

function usuariosDelEntorno(entorno: Entorno) {
    return [...roles.map((rol) => entorno.propietarios[rol].usuarioId), entorno.administradorId];
}

async function avisosPropios(cliente: Cliente, entorno: Entorno) {
    return cliente.orm.public.Notificacion.where((aviso) => aviso.usuarioId.in(usuariosDelEntorno(entorno))).all();
}

function contexto(tx: TransaccionTarea, instante = limite) {
    return { tx, fecha: instante.slice(0, 10), limite: instante };
}

async function conRollback(prueba: (tx: TransaccionTarea) => Promise<void>) {
    const rollback = new Error("Revertir exclusivamente la transacción de prueba de aging");
    await expect(db.transaction(async (tx) => {
        await prueba(tx);
        throw rollback;
    })).rejects.toBe(rollback);
}

describe.sequential("aging transaccional de fotos y avisos al propietario", { timeout: 30_000 }, () => {
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
        ({ procesarVencimientosFotos: procesar } = await import("./procesar-vencimientos-fotos"));
        ({ AlmacenamientoImagenesPostgres } = await import("@/infraestructura/imagenes/almacenamiento-postgres"));
    });

    // El procesador recorre todas las fotos. Revertir cada caso evita persistir cambios
    // sobre cualquier dato ajeno que ya exista en DATABASE_URL_TEST.
    it("deshabilitado conserva fotos vencidas, próximas y anteriores sin inicializar marcas ni enviar avisos", async () => {
        await conRollback(async (tx) => {
            const entorno = await crearEntorno(tx);
            const fotos: Foto[] = [];
            for (const rol of roles) {
                for (const cargadaEn of [inicioVencimiento, inicioAviso, null]) {
                    fotos.push(await crearFoto(tx, entorno, rol, cargadaEn));
                }
            }
            const antes = await Promise.all(fotos.map((foto) => leerFoto(tx, foto)));

            expect(await procesar({ tx, fecha, limite }, { habilitado: false })).toBe(0);

            expect(await Promise.all(fotos.map((foto) => leerFoto(tx, foto)))).toEqual(antes);
            expect(await avisosPropios(tx, entorno)).toEqual([]);
        });
    });

    it.each(roles)("respeta ambos umbrales exactos para %s y avisa únicamente a su dueño", async (rol) => {
        await conRollback(async (tx) => {
            const entorno = await crearEntorno(tx);
            const casos = [
                { instante: "2026-10-12T15:00:00.001Z", resultado: "vigente" },
                { instante: inicioAviso, resultado: "aviso" },
                { instante: "2026-10-12T14:59:59.999Z", resultado: "aviso" },
                { instante: "2026-10-05T15:00:00.001Z", resultado: "aviso" },
                { instante: inicioVencimiento, resultado: "eliminada" },
                { instante: "2026-10-05T14:59:59.999Z", resultado: "eliminada" },
            ] as const;
            const fotos: Foto[] = [];
            for (const caso of casos) fotos.push(await crearFoto(tx, entorno, rol, caso.instante));
            const antes = await Promise.all(fotos.map((foto) => leerFoto(tx, foto)));

            expect(await procesar(contexto(tx), configuracion)).toBeGreaterThanOrEqual(5);

            const avisos = await avisosPropios(tx, entorno);
            expect(avisos).toHaveLength(5);
            expect(avisos.every((aviso) => aviso.usuarioId === entorno.propietarios[rol].usuarioId)).toBe(true);
            for (const [indice, caso] of casos.entries()) {
                const foto = fotos[indice];
                const despues = await leerFoto(tx, foto);
                const urlPublicacion = `${rol === "OPERADOR" ? "/mi-mercado" : "/mi-mercado/productor"}?publicacion=${foto.publicacionId}`;
                const propios = avisos.filter((aviso) => aviso.url === urlPublicacion);
                if (caso.resultado === "vigente") {
                    expect(despues).toEqual(antes[indice]);
                    expect(propios).toEqual([]);
                    continue;
                }
                expect(propios).toHaveLength(1);
                expect(propios[0]).toMatchObject({
                    usuarioId: foto.propietario.usuarioId,
                    vista: false,
                    url: urlPublicacion,
                });
                expect(propios[0].descripcion).toContain(entorno.especie.nombreEspecie);
                expect(propios[0].descripcion).not.toContain(`#${foto.publicacionId}`);
                if (caso.resultado === "aviso") {
                    expect(despues.publicacion).toEqual(antes[indice].publicacion);
                    expect(despues.imagen).toEqual({ ...antes[indice].imagen, avisoVencimientoEn: limite });
                    expect(propios[0].descripcion).toContain("vence");
                    expect(propios[0].descripcion).toMatch(/\d{2}\/\d{2}\/2026/);
                    if (indice === 1) expect(propios[0].descripcion).toContain("11/11/2026");
                } else {
                    expect(despues.imagen).toBeNull();
                    expect(despues.publicacion).toEqual({
                        ...antes[indice].publicacion,
                        foto: null,
                        fotoEliminadaPorVencimientoEn: limite,
                        version: antes[indice].publicacion.version + 1,
                        fecha: expect.any(String),
                    });
                    expect(Temporal.Instant.compare(despues.publicacion.fecha, antes[indice].publicacion.fecha)).toBe(1);
                    expect(propios[0].descripcion).toMatch(/venció.*eliminada/);
                }
            }
            for (const usuarioId of usuariosDelEntorno(entorno).filter((id) => id !== entorno.propietarios[rol].usuarioId)) {
                expect(await tx.orm.public.Notificacion.where({ usuarioId }).all()).toEqual([]);
            }
            expect(await procesar(contexto(tx), configuracion)).toBe(0);
            expect(await avisosPropios(tx, entorno)).toEqual(avisos);
        });
    });

    it.each(roles)("%s conserva la marca de eliminación aunque borre el aviso y modifique otros datos", async (rol) => {
        await conRollback(async (tx) => {
            const entorno = await crearEntorno(tx);
            const foto = await crearFoto(tx, entorno, rol, inicioVencimiento);
            await procesar(contexto(tx), configuracion);
            await tx.orm.public.Notificacion.where({ usuarioId: foto.propietario.usuarioId }).deleteAll();
            await tx.orm.public.Publicacion.where({ id: foto.publicacionId }).update({ cantidadUnidades: 25 });

            const despues = await leerFoto(tx, foto);
            expect(despues.publicacion).toMatchObject({
                foto: null, cantidadUnidades: 25, fotoEliminadaPorVencimientoEn: limite,
            });
            expect(despues.imagen).toBeNull();
            expect(await procesar(contexto(tx, "2026-11-05T15:00:00Z"), configuracion)).toBe(0);
            expect((await leerFoto(tx, foto)).publicacion.fotoEliminadaPorVencimientoEn).toBe(limite);
            expect(await avisosPropios(tx, entorno)).toEqual([]);
        });
    });

    it.each(roles)("%s no recibe otra advertencia al borrar avisos y una foto reemplazada inicia su propio ciclo", async (rol) => {
        await conRollback(async (tx) => {
            const entorno = await crearEntorno(tx);
            const foto = await crearFoto(tx, entorno, rol, inicioAviso);
            await procesar(contexto(tx), configuracion);
            const primerAviso = await avisosPropios(tx, entorno);
            expect(primerAviso).toHaveLength(1);
            expect((await leerFoto(tx, foto)).imagen?.avisoVencimientoEn).toBe(limite);
            await tx.orm.public.Notificacion.where({ usuarioId: foto.propietario.usuarioId }).deleteAll();

            expect(await procesar(contexto(tx), configuracion)).toBe(0);
            expect(await avisosPropios(tx, entorno)).toEqual([]);

            const archivo = `${randomUUID()}.webp`;
            const nueva = {
                ...foto,
                clave: `publicaciones/${foto.publicacionId}/${archivo}`,
                url: `/api/publicaciones/imagenes/${foto.publicacionId}/${archivo}`,
            };
            const almacenamiento = new AlmacenamientoImagenesPostgres(tx);
            await almacenamiento.guardar(nueva.clave, Buffer.from([82, 73, 70, 70, 1, 87, 69, 66, 80]));
            const guardada = await tx.orm.public.Imagen.where({ clave: nueva.clave }).first();
            expect(guardada?.cargadaEn).not.toBeNull();
            expect(guardada?.avisoVencimientoEn).toBeNull();
            // La carga real asigna su fecha; fijarla permite probar el siguiente ciclo sin depender del reloj.
            await tx.orm.public.Imagen.where({ clave: nueva.clave }).update({ cargadaEn: Temporal.Instant.from(limite) });
            await tx.orm.public.Publicacion.where({ id: foto.publicacionId }).update({ foto: nueva.url });
            await almacenamiento.eliminar(foto.clave);

            expect(await procesar(contexto(tx), configuracion)).toBe(0);
            expect((await leerFoto(tx, nueva)).imagen?.avisoVencimientoEn).toBeNull();
            expect(await avisosPropios(tx, entorno)).toEqual([]);
            const siguienteAviso = "2026-11-27T15:00:00Z";
            await procesar(contexto(tx, siguienteAviso), configuracion);
            const avisosNuevos = await avisosPropios(tx, entorno);
            expect(avisosNuevos).toHaveLength(1);
            expect(avisosNuevos[0].id).not.toBe(primerAviso[0].id);
            expect(avisosNuevos[0].descripcion).toContain("04/12/2026");
            expect((await leerFoto(tx, nueva)).imagen?.avisoVencimientoEn).toBe(siguienteAviso);
            expect(await procesar(contexto(tx, siguienteAviso), configuracion)).toBe(0);
            expect(await avisosPropios(tx, entorno)).toEqual(avisosNuevos);
        });
    });

    it("inicia la vigencia de fotos anteriores sin fecha una sola vez y conserva la publicación", async () => {
        await conRollback(async (tx) => {
            const entorno = await crearEntorno(tx);
            const fotos: Foto[] = [];
            for (const rol of roles) fotos.push(await crearFoto(tx, entorno, rol, null));
            const antes = await Promise.all(fotos.map((foto) => leerFoto(tx, foto)));

            await procesar(contexto(tx), configuracion);

            for (const [indice, foto] of fotos.entries()) {
                expect(await leerFoto(tx, foto)).toEqual({
                    publicacion: antes[indice].publicacion,
                    imagen: { ...antes[indice].imagen, cargadaEn: limite },
                });
            }
            await procesar(contexto(tx, "2026-11-05T15:00:00Z"), configuracion);
            for (const foto of fotos) {
                const estado = await leerFoto(tx, foto);
                expect(estado.imagen?.cargadaEn).toBe(limite);
                expect(estado.imagen?.avisoVencimientoEn).toBeNull();
                expect(estado.publicacion.foto).toBe(foto.url);
            }
            expect(await avisosPropios(tx, entorno)).toEqual([]);
        });
    });

    it("revierte juntos avisos, marcas, eliminación de bytes y publicación si falla la transacción", async () => {
        const { entorno, fotos } = await db.transaction(async (tx) => {
            const entorno = await crearEntorno(tx);
            const fotos = [
                await crearFoto(tx, entorno, "OPERADOR", inicioVencimiento),
                await crearFoto(tx, entorno, "PRODUCTOR", inicioAviso),
                await crearFoto(tx, entorno, "PRODUCTOR", null),
            ];
            return { entorno, fotos };
        });
        try {
            const antes = await Promise.all(fotos.map((foto) => leerFoto(db, foto)));
            const error = new Error("Fallo posterior al aging, antes del commit");

            await expect(db.transaction(async (tx) => {
                await procesar(contexto(tx), configuracion);
                expect((await leerFoto(tx, fotos[0])).publicacion.foto).toBeNull();
                expect((await leerFoto(tx, fotos[0])).publicacion.fotoEliminadaPorVencimientoEn).toBe(limite);
                expect((await leerFoto(tx, fotos[0])).imagen).toBeNull();
                expect((await leerFoto(tx, fotos[1])).imagen?.avisoVencimientoEn).toBe(limite);
                expect((await leerFoto(tx, fotos[2])).imagen?.cargadaEn).toBe(limite);
                expect(await avisosPropios(tx, entorno)).toHaveLength(2);
                throw error;
            })).rejects.toBe(error);

            expect(await Promise.all(fotos.map((foto) => leerFoto(db, foto)))).toEqual(antes);
            expect(await avisosPropios(db, entorno)).toEqual([]);
        } finally {
            // Sólo este caso confirma fixtures para comprobar el estado desde fuera de la transacción revertida.
            for (const foto of fotos) {
                await db.orm.public.Publicacion.where({ id: foto.publicacionId }).deleteAll();
                await db.orm.public.Imagen.where({ clave: foto.clave }).deleteAll();
            }
            for (const usuarioId of usuariosDelEntorno(entorno)) {
                await db.orm.public.Notificacion.where({ usuarioId }).deleteAll();
                await db.orm.public.Usuario.where({ id: usuarioId }).deleteAll();
            }
            await db.orm.public.Especie.where({ id: entorno.especie.id }).deleteAll();
        }
    });
});
