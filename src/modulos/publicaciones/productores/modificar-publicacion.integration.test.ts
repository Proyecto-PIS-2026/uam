import { existsSync, readFileSync } from "node:fs";
import { parse } from "dotenv";
import { Temporal } from "temporal-polyfill";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { DatosSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import type { CambiosPublicacionProductor } from "./modificar-publicacion";

type BaseDatos = typeof import("@/infraestructura/persistencia/prisma/db").db;
type Modificar = typeof import("./modificar-publicacion").modificarPublicacionProductor;
type PublicacionCreada = { id: number; publicacionProductorId: number };

let db: BaseDatos;
let modificarPublicacionProductor: Modificar;
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

describe.sequential("modificación real de publicaciones del productor", { timeout: 15000 }, () => {
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
        cambiosIniciales = {
            precio: "100", foto: null,
            presentacionId: semilla.publicacion.presentacionId,
            categoriaId: semilla.publicacion.categoriaId,
            calibreId: semilla.publicacion.calibreId,
            ubicaciones: [{ nombreUbicacion: "Retiro de prueba", urlMaps: "https://maps.google.com/?q=Salto" }],
        };
    });

    beforeEach(async () => {
        const creadas = await db.transaction(async (tx) => {
            const publicaciones: PublicacionCreada[] = [];
            for (const productorId of [propietario.id, propietario.id, otroProductor.id]) {
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
                    calibreId: cambiosIniciales.calibreId,
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
});
