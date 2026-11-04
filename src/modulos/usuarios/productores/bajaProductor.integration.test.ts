
import "temporal-polyfill/full/global";
import "temporal-polyfill/types/global";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { bajaProductor } from "./bajaProductor";

type PrecioPublicacion = Parameters<
    typeof db.orm.public.Publicacion.create
>[0]["precio"];

const username = "bajaproductor_test";

vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => ({
    exigirAdministrador: vi.fn(),
}));

vi.mock("next/cache", () => ({
    revalidatePath: vi.fn(),
}));

function obtenerFechaEstadisticaActual() {
    const fechaStr = new Date().toISOString().slice(0, 10);
    return Temporal.Instant.from(`${fechaStr}T00:00:00Z`);
}

async function crearProductorDePrueba() {
    const usuario = await db.orm.public.Usuario.create({
        username,
        passwordHash: "password-test",
        rol: "PRODUCTOR",
    });

    const productor = await db.orm.public.Productor.create({
        usuarioId: usuario.id,
        nombreFantasia: "Productor Baja Test",
        whatsApp: "099123456",
    });

    return { usuario, productor };
}

async function crearPublicacionDePrueba(productorId: number) {
    const calibre = (await db.orm.public.Calibre.all())[0];
    const categoria = (await db.orm.public.Categoria.all())[0];

    const presentacion = (
        await db.orm.public.Presentacion
            .include("variedad", (variedad) =>
                variedad.select("id", "especieId"),
            )
            .all()
    )[0];

    const pais = (await db.orm.public.Pais.all())[0];

    if (!calibre || !categoria || !presentacion || !pais) {
        throw new Error(
            "Faltan datos de referencia para crear la publicación de prueba.",
        );
    }

    const precio = "100.00" as unknown as PrecioPublicacion;

    const publicacion = await db.orm.public.Publicacion.create({
        calibreId: calibre.id,
        categoriaId: categoria.id,
        fecha: Temporal.Instant.fromEpochMilliseconds(
            new Date("2026-10-03T15:00:00.000Z").getTime(),
        ),
        foto: null,
        precio,
        especieId: presentacion.variedad.especieId,
        variedadId: presentacion.variedad.id,
        presentacionId: presentacion.id,
        publicacionActiva: true,
        publicacionDisponible: true,
        tipoPublicacion: "PRODUCTOR",
        cantidadUnidades: 10,
    });

    const relacion = await db.orm.public.PublicacionProductor.create({
        productorId,
        publicacionId: publicacion.id,
        paisId: pais.id,
    });

    return { publicacion, relacion };
}

async function obtenerEstadisticasDelDia() {
    return db.orm.public.EstadisticaCantidadPublicacion
        .where({
            fecha: obtenerFechaEstadisticaActual(),
            username,
        })
        .all();
}

describe("baja de productor", () => {
    beforeEach(async () => {
        // Eliminar estadísticas de ejecuciones anteriores.
        await db.orm.public.EstadisticaCantidadPublicacion
            .where({ username })
            .deleteAll();

        const usuario = await db.orm.public.Usuario
            .where({ username })
            .first();

        if (!usuario) return;

        const productor = await db.orm.public.Productor
            .where({ usuarioId: usuario.id })
            .first();

        if (productor) {
            const relaciones = await db.orm.public.PublicacionProductor
                .where({ productorId: productor.id })
                .all();

            await db.orm.public.PublicacionProductor
                .where({ productorId: productor.id })
                .deleteAll();

            for (const relacion of relaciones) {
                await db.orm.public.Publicacion
                    .where({ id: relacion.publicacionId })
                    .delete();
            }

            await db.orm.public.Productor
                .where({ id: productor.id })
                .delete();
        }

        await db.orm.public.Usuario
            .where({ id: usuario.id })
            .delete();
    });

    it("devuelve los errores del validador cuando los datos son inválidos", async () => {
        const resultado = await bajaProductor(null);

        expect(resultado).toEqual({
            esValido: false,
            errores: ["Los datos de la baja no son válidos."],
        });
    });

    it("elimina correctamente el productor y su usuario", async () => {
        const { usuario, productor } = await crearProductorDePrueba();

        const resultado = await bajaProductor({
            productorId: productor.id,
        });

        expect(resultado).toEqual({
            esValido: true,
            mensaje: "Productor eliminado correctamente.",
        });

        const productorEliminado = await db.orm.public.Productor
            .where({ id: productor.id })
            .first();

        const usuarioEliminado = await db.orm.public.Usuario
            .where({ id: usuario.id })
            .first();

        expect(productorEliminado).toBeNull();
        expect(usuarioEliminado).toBeNull();

        // No existían publicaciones, por lo que no debe generarse un evento.
        expect(await obtenerEstadisticasDelDia()).toHaveLength(0);
    });

    it("elimina las publicaciones y sus relaciones al dar de baja al productor", async () => {
        const { productor } = await crearProductorDePrueba();

        const { publicacion } = await crearPublicacionDePrueba(
            productor.id,
        );

        const resultado = await bajaProductor({
            productorId: productor.id,
        });

        expect(resultado).toEqual({
            esValido: true,
            mensaje: "Productor eliminado correctamente.",
        });

        const publicacionEliminada = await db.orm.public.Publicacion
            .where({ id: publicacion.id })
            .first();

        const relacionEliminada = await db.orm.public.PublicacionProductor
            .where({ publicacionId: publicacion.id })
            .first();

        expect(publicacionEliminada).toBeNull();
        expect(relacionEliminada).toBeNull();
    });

    it("registra una estadística con cantidad cero al eliminar las publicaciones del productor", async () => {
        const { usuario, productor } = await crearProductorDePrueba();

        const { publicacion } = await crearPublicacionDePrueba(
            productor.id,
        );

        const resultado = await bajaProductor({
            productorId: productor.id,
        });

        expect(resultado.esValido).toBe(true);

        const estadisticas = await obtenerEstadisticasDelDia();

        expect(estadisticas).toHaveLength(1);

        expect(estadisticas[0]).toMatchObject({
            username: usuario.username,
            cantidad: 0,
        });

        expect(estadisticas[0].fecha.toString()).toBe(
            obtenerFechaEstadisticaActual().toString(),
        );

        const publicacionEliminada = await db.orm.public.Publicacion
            .where({ id: publicacion.id })
            .first();

        expect(publicacionEliminada).toBeNull();
    });

    it("actualiza el registro estadístico existente del mismo día en lugar de crear otro", async () => {
        const { usuario, productor } = await crearProductorDePrueba();

        await crearPublicacionDePrueba(productor.id);

        const fecha = obtenerFechaEstadisticaActual();

        const estadisticaInicial = await db.orm.public.EstadisticaCantidadPublicacion
            .create({
                fecha,
                username: usuario.username,
                cantidad: 1,
            });

        const resultado = await bajaProductor({
            productorId: productor.id,
        });

        expect(resultado.esValido).toBe(true);

        const estadisticas = await obtenerEstadisticasDelDia();

        expect(estadisticas).toHaveLength(1);

        expect(estadisticas[0].id).toBe(estadisticaInicial.id);
        expect(estadisticas[0].cantidad).toBe(0);
        expect(estadisticas[0].username).toBe(usuario.username);
    });

    it("rechaza la baja cuando el productor no existe", async () => {
        const resultado = await bajaProductor({
            productorId: 999999999,
        });

        expect(resultado).toEqual({
            esValido: false,
            errores: ["El productor seleccionado ya no existe."],
        });
    });
});
