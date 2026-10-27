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
let paisId: number | null;
let cambiosIniciales: CambiosPublicacionProductor;
let catalogoAlternativo: { especieId: number; variedadId: number; presentacionId: number; categoriaId: number; paisId: number };
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
            "especieId", "variedadId", "presentacionId", "categoriaId", "calibreId",
        ))
        .include("ubicaciones", (ubicaciones) => ubicaciones.select("id", "publicacionId", "nombreUbicacion", "urlMaps", "departamento")).first();
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
                .select("tipoPublicacion", "especieId", "variedadId", "presentacionId", "categoriaId", "calibreId")
                .include("presentacion", (presentacion) => presentacion.select("presentacionActiva")
                    .include("variedad", (variedad) => variedad.select("variedadActiva", "especieId")
                        .include("especie", (especie) => especie.select("especieActiva"))))
                .include("categoria", (categoria) => categoria.select("especieId"))).all(),
            db.orm.public.Usuario.where({ rol: "ADMINISTRADOR" }).select("id").first(),
        ]);
        const semilla = relaciones.find((relacion) => {
            const publicacion = relacion.publicacion;
            if (!publicacion.presentacion || !publicacion.categoria) return false;
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
        for (let indice = 0; indice < 3; indice++) {
            const calibre = await db.orm.public.Calibre.create({ codigoCalibre: `edicion-${randomUUID()}`, nombreCalibre: `Calibre de prueba ${indice}` });
            calibresCreados.push(calibre.id);
        }
        cambiosIniciales = {
            precio: "100", foto: null,
            especieId: semilla.publicacion.especieId,
            variedadId: semilla.publicacion.variedadId,
            presentacionId: semilla.publicacion.presentacionId,
            categoriaId: semilla.publicacion.categoriaId,
            calibreId: calibresCreados[0],
            ubicaciones: [{ nombreUbicacion: "Retiro de prueba", urlMaps: "https://maps.google.com/?q=Salto" }],
        };
        catalogoAlternativo = await db.transaction(async (tx) => {
            const identificador = randomUUID();
            const especie = await tx.orm.public.Especie.create({ nombreEspecie: `Especie de edición ${identificador}` });
            const variedad = await tx.orm.public.Variedad.create({ nombreVariedad: "Variedad de edición", especieId: especie.id });
            const presentacion = await tx.orm.public.Presentacion.create({ nombrePresentacion: "Cajón de edición", variedadId: variedad.id });
            const categoria = await tx.orm.public.Categoria.create({ nombreCategoria: "Categoría de edición", especieId: especie.id });
            const pais = await tx.orm.public.Pais.create({ codigoPais: `edicion-${identificador}`, nombrePais: `País de edición ${identificador}` });
            return { especieId: especie.id, variedadId: variedad.id, presentacionId: presentacion.id, categoriaId: categoria.id, paisId: pais.id };
        });
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
                    especieId: cambiosIniciales.especieId,
                    variedadId: cambiosIniciales.variedadId,
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
        if (catalogoAlternativo) {
            await db.orm.public.Presentacion.where({ id: catalogoAlternativo.presentacionId }).delete();
            await db.orm.public.Categoria.where({ id: catalogoAlternativo.categoriaId }).delete();
            await db.orm.public.Variedad.where({ id: catalogoAlternativo.variedadId }).delete();
            await db.orm.public.Especie.where({ id: catalogoAlternativo.especieId }).delete();
            await db.orm.public.Pais.where({ id: catalogoAlternativo.paisId }).delete();
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
        expect(despues.paisId).toBe(antes.paisId);
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

    it("conserva ubicaciones anteriores sin departamento y permite guardar, conservar y cambiar los departamentos del mapa", async () => {
        const antes = await leer(elegida);
        expect(antes.ubicaciones[0].departamento).toBeNull();

        const anteriorGuardada = await modificarPublicacionProductor(sesionPropietario, elegida.publicacionProductorId, {
            ...cambiosIniciales, ubicaciones: antes.ubicaciones,
        });
        expect(anteriorGuardada.publicacion.ubicaciones[0].departamento).toBeNull();
        expect((await leer(elegida)).ubicaciones[0].departamento).toBeNull();

        const ubicaciones = [
            { nombreUbicacion: "Retiro sur", urlMaps: "https://www.google.com/maps?q=-34.9,-56.2", departamento: "Montevideo" },
            { nombreUbicacion: "Chacra", urlMaps: "https://www.google.com/maps?q=-34.7,-56.1", departamento: "Canelones" },
        ];
        const agregadas = await modificarPublicacionProductor(sesionPropietario, elegida.publicacionProductorId, {
            ...cambiosIniciales,
            ubicaciones: ubicaciones.map((ubicacion) => ({ ...ubicacion, departamento: ` Departamento de ${ubicacion.departamento} ` })),
        });
        expect((await leer(elegida)).ubicaciones.map(({ nombreUbicacion, urlMaps, departamento }) => ({ nombreUbicacion, urlMaps, departamento })))
            .toEqual(ubicaciones);
        expect(agregadas.publicacion.ubicaciones).toEqual(ubicaciones.map((ubicacion) => ({ ...ubicacion, id: expect.any(Number) })));

        const conservadas = await modificarPublicacionProductor(sesionPropietario, elegida.publicacionProductorId, {
            ...cambiosIniciales, precio: "250", ubicaciones: agregadas.publicacion.ubicaciones,
        });
        expect(conservadas.publicacion.ubicaciones.map(({ departamento }) => departamento)).toEqual(["Montevideo", "Canelones"]);

        const clienteAnterior = await modificarPublicacionProductor(sesionPropietario, elegida.publicacionProductorId, {
            ...cambiosIniciales, precio: "275",
            ubicaciones: ubicaciones.map(({ nombreUbicacion, urlMaps }) => ({ nombreUbicacion, urlMaps: ` ${urlMaps} ` })),
        });
        expect(clienteAnterior.publicacion.ubicaciones.map(({ departamento }) => departamento)).toEqual(["Montevideo", "Canelones"]);
        expect((await leer(elegida)).ubicaciones.map(({ departamento }) => departamento)).toEqual(["Montevideo", "Canelones"]);

        const cambiada = await modificarPublicacionProductor(sesionPropietario, elegida.publicacionProductorId, {
            ...cambiosIniciales, ubicaciones: [{ ...ubicaciones[0], departamento: " SAN JOSE " }],
        });
        const final = await leer(elegida);
        expect(final.ubicaciones).toHaveLength(1);
        expect(final.ubicaciones[0]).toMatchObject({ ...ubicaciones[0], departamento: "San José" });
        expect(cambiada.publicacion.ubicaciones).toEqual([{ ...ubicaciones[0], departamento: "San José", id: final.ubicaciones[0].id }]);
    });

    it("un administrador modifica la publicación de otro usuario y conserva el resto", async () => {
        const [antes, otraAntes, ajenaAntes] = await Promise.all([leer(elegida), leer(otraPropia), leer(ajena)]);
        expect(sesionAdministrador.usuarioId).not.toBe(sesionPropietario.usuarioId);

        const resultado = await modificarPublicacionProductor(sesionAdministrador, elegida.publicacionProductorId, { ...cambiosIniciales, precio: null, ubicaciones: [] });

        const despues = await leer(elegida);
        expect(despues.publicacion.precio).toBeNull();
        expect(despues.ubicaciones).toEqual([]);
        expect(resultado.publicacion.ubicaciones).toEqual([]);
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

    it("cambia a otra especie y variedad con su categoría, país, cero unidades y disponibilidad desactivada", async () => {
        const [otraAntes, ajenaAntes] = await Promise.all([leer(otraPropia), leer(ajena)]);
        const cambios = {
            ...cambiosIniciales,
            especieId: catalogoAlternativo.especieId,
            variedadId: catalogoAlternativo.variedadId,
            presentacionId: catalogoAlternativo.presentacionId,
            categoriaId: catalogoAlternativo.categoriaId,
            paisId: catalogoAlternativo.paisId,
            cantidadUnidades: 0,
            disponible: false,
        };

        const resultado = await modificarPublicacionProductor(sesionPropietario, elegida.publicacionProductorId, cambios);

        const despues = await leer(elegida);
        expect(despues).toMatchObject({
            paisId: catalogoAlternativo.paisId,
            publicacion: {
                especieId: catalogoAlternativo.especieId,
                variedadId: catalogoAlternativo.variedadId,
                presentacionId: catalogoAlternativo.presentacionId, categoriaId: catalogoAlternativo.categoriaId,
                cantidadUnidades: 0, publicacionDisponible: false, publicacionActiva: true,
            },
        });
        expect(resultado.publicacion).toMatchObject({
            paisId: catalogoAlternativo.paisId, cantidadUnidades: 0, publicacionDisponible: false,
            especie: { id: catalogoAlternativo.especieId },
            variedad: { id: catalogoAlternativo.variedadId },
            presentacion: { id: catalogoAlternativo.presentacionId },
        });
        expect(await leer(otraPropia)).toEqual(otraAntes);
        expect(await leer(ajena)).toEqual(ajenaAntes);
    });

    it("permite quitar la cantidad y volver a activar la disponibilidad sin cambiar el país omitido", async () => {
        await modificarPublicacionProductor(sesionPropietario, elegida.publicacionProductorId, {
            ...cambiosIniciales, paisId: catalogoAlternativo.paisId, cantidadUnidades: 0, disponible: false,
        });

        const resultado = await modificarPublicacionProductor(sesionPropietario, elegida.publicacionProductorId, {
            ...cambiosIniciales, cantidadUnidades: null, disponible: true,
        });

        expect(await leer(elegida)).toMatchObject({
            paisId: catalogoAlternativo.paisId,
            publicacion: { cantidadUnidades: null, publicacionDisponible: true },
        });
        expect(resultado.publicacion).toMatchObject({ cantidadUnidades: null, publicacionDisponible: true, paisId: catalogoAlternativo.paisId });
    });

    it("rechaza una categoría de otra especie sin guardar país, cantidad, disponibilidad ni ubicaciones", async () => {
        const antes = await leer(elegida);

        await expect(modificarPublicacionProductor(sesionPropietario, elegida.publicacionProductorId, {
            ...cambiosIniciales, categoriaId: catalogoAlternativo.categoriaId,
            paisId: catalogoAlternativo.paisId, cantidadUnidades: 0, disponible: false, ubicaciones: [],
        })).rejects.toMatchObject({ codigo: "DATOS_INVALIDOS" });

        expect(await leer(elegida)).toEqual(antes);
    });

    it("rechaza una combinación ya publicada por el mismo productor sin modificar ninguna", async () => {
        const [antes, otraAntes] = await Promise.all([leer(elegida), leer(otraPropia)]);

        await expect(modificarPublicacionProductor(sesionPropietario, otraPropia.publicacionProductorId, cambiosIniciales))
            .rejects.toMatchObject({ codigo: "DATOS_INVALIDOS", message: expect.stringContaining("ya tiene una publicación") });

        expect(await leer(elegida)).toEqual(antes);
        expect(await leer(otraPropia)).toEqual(otraAntes);
    });

    it("serializa dos ediciones que intentan crear la misma combinación", async () => {
        const cambios = {
            ...cambiosIniciales,
            especieId: catalogoAlternativo.especieId,
            variedadId: catalogoAlternativo.variedadId,
            presentacionId: catalogoAlternativo.presentacionId, categoriaId: catalogoAlternativo.categoriaId,
            paisId: catalogoAlternativo.paisId, cantidadUnidades: 0, disponible: false,
            calibreId: calibresCreados[2],
        };
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
