import { existsSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { parse } from "dotenv";
import { Temporal } from "temporal-polyfill";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { DatosSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import type { CambiosPublicacionProductor } from "./modificar-publicacion";

type BaseDatos = typeof import("@/infraestructura/persistencia/prisma/db").db;
type Modificar = typeof import("./modificar-publicacion").modificarPublicacionProductor;
type DarDeBaja = typeof import("./bajaPublicacionProductorAutorizada").bajaPublicacionProductorAutorizada;
type PublicacionCreada = { id: number; publicacionProductorId: number };

let db: BaseDatos;
let modificarPublicacionProductor: Modificar;
let bajaPublicacionProductorAutorizada: DarDeBaja;
let propietario: { id: number; usuarioId: number };
let otroProductor: { id: number; usuarioId: number };
let sesionPropietario: DatosSesion;
let sesionAdministrador: DatosSesion;
let paisId: number;
let cambiosIniciales: CambiosPublicacionProductor;
let elegida: PublicacionCreada;
let otraPropia: PublicacionCreada;
let ajena: PublicacionCreada;
const idsCreados: number[] = [];
const calibresCreados: number[] = [];
const fechaInicial = Temporal.Instant.from("2020-01-01T12:00:00Z");

async function leer(publicacion: PublicacionCreada) {
    const relacion = await db.orm.public.PublicacionProductor.where({ id: publicacion.publicacionProductorId })
        .include("publicacion", (publicacion) => publicacion.select(
            "id", "fecha", "precio", "foto", "tipoPublicacion", "cantidadUnidades", "publicacionActiva", "publicacionDisponible",
            "presentacionId", "categoriaId", "calibreId",
        ))
        .include("ubicaciones", (ubicaciones) => ubicaciones.select("id", "publicacionId", "nombreUbicacion", "urlMaps")).first();
    if (!relacion) throw new Error("No se encontró la publicación creada para la prueba.");
    return {
        ...relacion,
        publicacion: {
            ...relacion.publicacion,
            fecha: relacion.publicacion.fecha.toString(),
            precio: relacion.publicacion.precio === null ? null : String(relacion.publicacion.precio),
        },
        ubicaciones: [...relacion.ubicaciones].sort((a, b) => a.id - b.id),
    };
}

describe.sequential("edición y baja reales de publicaciones del productor", { timeout: 15000 }, () => {
    beforeAll(async () => {
        const urlTest = process.env.DATABASE_URL_TEST;
        if (!urlTest || process.env.DATABASE_URL !== urlTest) {
            throw new Error("Estas pruebas requieren DATABASE_URL_TEST como base activa; no usan DATABASE_URL como alternativa.");
        }
        const urlDesarrollo = existsSync(".env") ? parse(readFileSync(".env")).DATABASE_URL : undefined;
        if (urlDesarrollo && urlTest === urlDesarrollo) {
            throw new Error("DATABASE_URL_TEST debe apuntar a una base distinta de DATABASE_URL en .env. No se modificó la base de desarrollo.");
        }

        // Importar después de validar la URL impide incluso abrir el cliente de desarrollo.
        ({ db } = await import("@/infraestructura/persistencia/prisma/db"));
        ({ modificarPublicacionProductor } = await import("./modificar-publicacion"));
        ({ bajaPublicacionProductorAutorizada } = await import("./bajaPublicacionProductorAutorizada"));
        const [productores, relaciones, administrador] = await Promise.all([
            db.orm.public.Productor.select("id", "usuarioId").all(),
            db.orm.public.PublicacionProductor.include("publicacion", (publicacion) => publicacion
                .select("tipoPublicacion", "presentacionId", "categoriaId", "calibreId")
                .include("presentacion", (presentacion) => presentacion.select("presentacionActiva")
                    .include("variedad", (variedad) => variedad.select("variedadActiva", "especieId")
                        .include("especie", (especie) => especie.select("especieActiva"))))
                .include("categoria", (categoria) => categoria.select("especieId"))).all(),
            db.orm.public.Usuario.where({ rol: "ADMINISTRADOR" }).select("id").first(),
        ]);
        const semilla = relaciones.find((relacion) => {
            const publicacion = relacion.publicacion;
            const variedad = publicacion.presentacion.variedad;
            return publicacion.tipoPublicacion === "PRODUCTOR" && publicacion.presentacion.presentacionActiva
                && variedad.variedadActiva && variedad.especie.especieActiva
                && (publicacion.categoria.especieId === null || publicacion.categoria.especieId === variedad.especieId);
        });
        if (!semilla || !administrador) throw new Error("La base de pruebas necesita un administrador y una publicación de productor con catálogo activo.");
        const dueno = productores.find((productor) => productor.id === semilla.productorId);
        const otro = productores.find((productor) => productor.usuarioId !== dueno?.usuarioId);
        if (!dueno || !otro) throw new Error("La base de pruebas necesita dos productores de usuarios distintos.");
        propietario = dueno;
        otroProductor = otro;
        sesionPropietario = { usuarioId: dueno.usuarioId, rol: "PRODUCTOR", expiraEn: 2000000000 };
        sesionAdministrador = { usuarioId: administrador.id, rol: "ADMINISTRADOR", expiraEn: 2000000000 };
        paisId = semilla.paisId;
        // Aísla las combinaciones de este archivo del catálogo ya publicado por la semilla.
        for (let indice = 0; indice < 3; indice++) {
            const calibre = await db.orm.public.Calibre.create({ codigoCalibre: `edicion-${randomUUID()}`, nombreCalibre: `Calibre de prueba ${indice}` });
            calibresCreados.push(calibre.id);
        }
        cambiosIniciales = {
            precio: "100", foto: null,
            presentacionId: semilla.publicacion.presentacionId,
            categoriaId: semilla.publicacion.categoriaId,
            calibreId: calibresCreados[0],
            ubicaciones: [{ nombreUbicacion: "Retiro de prueba", urlMaps: "https://maps.google.com/?q=Salto" }],
        };
    });

    beforeEach(async () => {
        const creadas = await db.transaction(async (tx) => {
            const publicaciones: PublicacionCreada[] = [];
            for (const [indice, productorId] of [propietario.id, propietario.id, otroProductor.id].entries()) {
                type Precio = Parameters<typeof tx.orm.public.Publicacion.create>[0]["precio"];
                const publicacion = await tx.orm.public.Publicacion.create({
                    fecha: fechaInicial,
                    tipoPublicacion: "PRODUCTOR",
                    precio: cambiosIniciales.precio as Precio,
                    foto: null,
                    cantidadUnidades: 12,
                    publicacionActiva: true,
                    publicacionDisponible: true,
                    presentacionId: cambiosIniciales.presentacionId,
                    categoriaId: cambiosIniciales.categoriaId,
                    calibreId: indice === 1 ? calibresCreados[1] : cambiosIniciales.calibreId,
                });
                const relacion = await tx.orm.public.PublicacionProductor.create({ publicacionId: publicacion.id, productorId, paisId });
                await tx.orm.public.Ubicacion.create({ ...cambiosIniciales.ubicaciones[0], publicacionId: relacion.id });
                publicaciones.push({ id: publicacion.id, publicacionProductorId: relacion.id });
            }
            return publicaciones;
        });
        idsCreados.push(...creadas.map((publicacion) => publicacion.id));
        [elegida, otraPropia, ajena] = creadas;
    });

    afterEach(async () => {
        // Las relaciones y ubicaciones tienen borrado en cascada; sólo se eliminan ids creados aquí.
        while (idsCreados.length > 0) {
            const id = idsCreados[idsCreados.length - 1];
            await db.orm.public.Publicacion.where({ id }).delete();
            idsCreados.pop();
        }
    });

    afterAll(async () => {
        for (const id of calibresCreados) await db.orm.public.Calibre.where({ id }).delete();
    });

    it("el propietario guarda su publicación y renueva su fecha sin cambiar otras publicaciones ni ubicaciones", async () => {
        const [antes, otraAntes, ajenaAntes] = await Promise.all([leer(elegida), leer(otraPropia), leer(ajena)]);
        const ubicaciones = [
            { nombreUbicacion: "Quinta actualizada", urlMaps: "https://maps.google.com/?q=Montevideo" },
            { nombreUbicacion: "Segundo retiro", urlMaps: "https://maps.app.goo.gl/retiroDePrueba" },
        ];

        const resultado = await modificarPublicacionProductor(sesionPropietario, elegida.publicacionProductorId, {
            ...cambiosIniciales, precio: "245", ubicaciones,
        });

        const despues = await leer(elegida);
        expect(resultado.productorId).toBe(propietario.id);
        expect(resultado.publicacion.id).toBe(elegida.id);
        expect(Number(despues.publicacion.precio)).toBe(245);
        expect(despues.ubicaciones.map(({ nombreUbicacion, urlMaps }) => ({ nombreUbicacion, urlMaps }))).toEqual(ubicaciones);
        expect(Temporal.Instant.compare(despues.publicacion.fecha, antes.publicacion.fecha)).toBe(1);
        expect(resultado.publicacion.fecha).toBe(despues.publicacion.fecha);
        expect(despues.publicacion).toMatchObject({ cantidadUnidades: 12, publicacionActiva: true, publicacionDisponible: true });
        expect(await leer(otraPropia)).toEqual(otraAntes);
        expect(await leer(ajena)).toEqual(ajenaAntes);
    });

    it("actualiza la fecha aunque únicamente se modifiquen los puntos de retiro", async () => {
        const [antes, otraAntes, ajenaAntes] = await Promise.all([leer(elegida), leer(otraPropia), leer(ajena)]);
        const ubicaciones = [{ nombreUbicacion: "Sólo cambia el retiro", urlMaps: "https://www.google.com/maps/place/Salto" }];

        const resultado = await modificarPublicacionProductor(sesionPropietario, elegida.publicacionProductorId, { ...cambiosIniciales, ubicaciones });

        const despues = await leer(elegida);
        expect({ ...despues.publicacion, fecha: antes.publicacion.fecha }).toEqual(antes.publicacion);
        expect(Temporal.Instant.compare(despues.publicacion.fecha, antes.publicacion.fecha)).toBe(1);
        expect(resultado.publicacion.fecha).toBe(despues.publicacion.fecha);
        expect(despues.ubicaciones.map(({ nombreUbicacion, urlMaps }) => ({ nombreUbicacion, urlMaps }))).toEqual(ubicaciones);
        expect(await leer(otraPropia)).toEqual(otraAntes);
        expect(await leer(ajena)).toEqual(ajenaAntes);
    });

    it("un administrador modifica la publicación de otro usuario y conserva el resto", async () => {
        const [antes, otraAntes, ajenaAntes] = await Promise.all([leer(elegida), leer(otraPropia), leer(ajena)]);
        expect(sesionAdministrador.usuarioId).not.toBe(sesionPropietario.usuarioId);

        await modificarPublicacionProductor(sesionAdministrador, elegida.publicacionProductorId, { ...cambiosIniciales, precio: "0", ubicaciones: [] });

        const despues = await leer(elegida);
        expect(Number(despues.publicacion.precio)).toBe(0);
        expect(despues.ubicaciones).toEqual([]);
        expect(Temporal.Instant.compare(despues.publicacion.fecha, antes.publicacion.fecha)).toBe(1);
        expect(await leer(otraPropia)).toEqual(otraAntes);
        expect(await leer(ajena)).toEqual(ajenaAntes);
    });

    it("rechaza otro productor y no cambia datos, ubicaciones ni fechas", async () => {
        const [antes, otraAntes, ajenaAntes] = await Promise.all([leer(elegida), leer(otraPropia), leer(ajena)]);

        await expect(modificarPublicacionProductor({ ...sesionPropietario, usuarioId: otroProductor.usuarioId }, elegida.publicacionProductorId, {
            ...cambiosIniciales, precio: "999", ubicaciones: [],
        })).rejects.toMatchObject({ status: 403 });

        expect(await leer(elegida)).toEqual(antes);
        expect(await leer(otraPropia)).toEqual(otraAntes);
        expect(await leer(ajena)).toEqual(ajenaAntes);
    });

    it("rechaza una combinación ya publicada por el mismo productor sin modificar ninguna", async () => {
        const [antes, otraAntes] = await Promise.all([leer(elegida), leer(otraPropia)]);

        await expect(modificarPublicacionProductor(sesionPropietario, otraPropia.publicacionProductorId, cambiosIniciales))
            .rejects.toMatchObject({ codigo: "DATOS_INVALIDOS", message: expect.stringContaining("ya tiene una publicación") });

        expect(await leer(elegida)).toEqual(antes);
        expect(await leer(otraPropia)).toEqual(otraAntes);
    });

    it("serializa dos ediciones que intentan crear la misma combinación", async () => {
        const cambios = { ...cambiosIniciales, calibreId: calibresCreados[2] };
        const resultados = await Promise.allSettled([
            modificarPublicacionProductor(sesionPropietario, elegida.publicacionProductorId, cambios),
            modificarPublicacionProductor(sesionPropietario, otraPropia.publicacionProductorId, cambios),
        ]);

        expect(resultados.filter((resultado) => resultado.status === "fulfilled")).toHaveLength(1);
        expect(resultados.filter((resultado) => resultado.status === "rejected")).toEqual([
            expect.objectContaining({ reason: expect.objectContaining({ codigo: "DATOS_INVALIDOS" }) }),
        ]);
        const guardadas = await Promise.all([leer(elegida), leer(otraPropia)]);
        expect(guardadas.filter((relacion) => relacion.publicacion.calibreId === calibresCreados[2])).toHaveLength(1);
    });

    it("el propietario edita y luego elimina su publicación con ubicaciones y relación en cascada", async () => {
        const [otraAntes, ajenaAntes] = await Promise.all([leer(otraPropia), leer(ajena)]);
        const ubicaciones = [
            { nombreUbicacion: "Retiro actualizado", urlMaps: "https://www.google.com/maps/place/Salto" },
            { nombreUbicacion: "Segundo retiro", urlMaps: "https://maps.google.com/?q=Montevideo" },
        ];
        await modificarPublicacionProductor(sesionPropietario, elegida.publicacionProductorId, {
            ...cambiosIniciales, precio: "245", ubicaciones,
        });
        const editada = await leer(elegida);
        expect(Number(editada.publicacion.precio)).toBe(245);
        expect(editada.publicacion.foto).toBeNull();
        expect(editada.ubicaciones.map(({ nombreUbicacion, urlMaps }) => ({ nombreUbicacion, urlMaps }))).toEqual(ubicaciones);

        await expect(bajaPublicacionProductorAutorizada(sesionPropietario, elegida.publicacionProductorId))
            .resolves.toEqual({ productorId: propietario.id });

        expect(await db.orm.public.Publicacion.where({ id: elegida.id }).first()).toBeNull();
        expect(await db.orm.public.PublicacionProductor.where({ id: elegida.publicacionProductorId }).first()).toBeNull();
        expect(await db.orm.public.Ubicacion.where({ publicacionId: elegida.publicacionProductorId }).all()).toEqual([]);
        expect(await leer(otraPropia)).toEqual(otraAntes);
        expect(await leer(ajena)).toEqual(ajenaAntes);
    });

    it("rechaza la baja de una publicación ajena sin cambiar publicaciones ni ubicaciones", async () => {
        const [antes, otraAntes, ajenaAntes] = await Promise.all([leer(elegida), leer(otraPropia), leer(ajena)]);

        await expect(bajaPublicacionProductorAutorizada(sesionPropietario, ajena.publicacionProductorId))
            .rejects.toMatchObject({ status: 403 });

        expect(await leer(elegida)).toEqual(antes);
        expect(await leer(otraPropia)).toEqual(otraAntes);
        expect(await leer(ajena)).toEqual(ajenaAntes);
    });
});
