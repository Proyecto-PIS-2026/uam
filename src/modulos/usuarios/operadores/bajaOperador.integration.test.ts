import "temporal-polyfill/full/global";
import "temporal-polyfill/types/global";

import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { bajaOperador } from "./bajaOperador";

vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => ({
    exigirAdministrador: vi.fn(),
}));

vi.mock("next/cache", () => ({
    revalidatePath: vi.fn(),
}));

let username: string;
let identificador: string;
let navesCreadas: number[] = [];

function obtenerFechaEstadisticaActual() {
    const fechaStr = new Date().toISOString().slice(0, 10);

    return Temporal.Instant.from(`${fechaStr}T00:00:00Z`);
}

async function crearOperadorDePrueba() {
    const usuario = await db.orm.public.Usuario.create({
        username,
        passwordHash: "password-test",
        rol: "OPERADOR",
    });

    const operador = await db.orm.public.Operador.create({
        usuarioId: usuario.id,
        nombreFantasia: `Operador Baja Test ${identificador}`,
        whatsApp: "099123456",
    });

    return { usuario, operador };
}

async function crearNaveDePrueba() {
    const nave = await db.orm.public.Nave.create({
        nombreNave: `baja-test-${identificador}`,
    });

    navesCreadas.push(nave.id);

    return nave;
}

async function crearPublicacionesDePrueba(
    operadorId: number,
    cantidad: number,
) {
    const relacionesSemilla = await db.orm.public.PublicacionOperador.all();
    const relacionSemilla = relacionesSemilla[0];

    if (!relacionSemilla) {
        throw new Error(
            "No hay una relación de publicación de operador disponible para crear los datos de prueba.",
        );
    }

    const publicacionSemilla = await db.orm.public.Publicacion
        .where({ id: relacionSemilla.publicacionId })
        .first();

    if (!publicacionSemilla) {
        throw new Error(
            "No se encontró la publicación semilla necesaria para crear los datos de prueba.",
        );
    }

    const publicacionesCreadas: number[] = [];

    for (let i = 0; i < cantidad; i++) {
        const publicacion = await db.orm.public.Publicacion.create({
            tipoPublicacion: "OPERADOR",
            publicacionDisponible: publicacionSemilla.publicacionDisponible,
            precio: publicacionSemilla.precio,
            foto: null,
            cantidadUnidades: publicacionSemilla.cantidadUnidades ?? null,
            comentario: publicacionSemilla.comentario ?? null,
            especieId: publicacionSemilla.especieId,
            variedadId: publicacionSemilla.variedadId,
            envaseId: publicacionSemilla.envaseId,
            kilosId: publicacionSemilla.kilosId,
            categoriaId: publicacionSemilla.categoriaId,
            calibreId: publicacionSemilla.calibreId,
            fechaVigencia: publicacionSemilla.fechaVigencia,
        });

        await db.orm.public.PublicacionOperador.create({
            publicacionId: publicacion.id,
            operadorId,
            paisId: relacionSemilla.paisId,
        });

        publicacionesCreadas.push(publicacion.id);
    }

    return publicacionesCreadas;
}

async function obtenerEstadisticasDelDia() {
    return db.orm.public.EstadisticaCantidadPublicacion
        .where({
            fecha: obtenerFechaEstadisticaActual(),
            username,
        })
        .all();
}

describe("baja de operador", () => {
    beforeEach(() => {
        identificador = randomUUID();
        username = `baja-test-${identificador}`;
        navesCreadas = [];
    });

    afterEach(async () => {
        const usuario = await db.orm.public.Usuario
            .where({ username })
            .first();

        if (usuario) {
            const operador = await db.orm.public.Operador
                .where({ usuarioId: usuario.id })
                .first();

            if (operador) {
                await db.orm.public.Local
                    .where({ operadorId: operador.id })
                    .delete();

                const relaciones = await db.orm.public.PublicacionOperador
                    .where({ operadorId: operador.id })
                    .all();

                await db.orm.public.PublicacionOperador
                    .where({ operadorId: operador.id })
                    .delete();

                for (const relacion of relaciones) {
                    await db.orm.public.Publicacion
                        .where({ id: relacion.publicacionId })
                        .delete();
                }

                await db.orm.public.Operador
                    .where({ id: operador.id })
                    .delete();
            }

            await db.orm.public.Usuario
                .where({ id: usuario.id })
                .delete();
        }

        await db.orm.public.EstadisticaCantidadPublicacion
            .where({ username })
            .delete();

        for (const id of navesCreadas) {
            await db.orm.public.Nave
                .where({ id })
                .delete();
        }
    });

    it("devuelve los errores del validador cuando los datos son inválidos", async () => {
        const resultado = await bajaOperador(null);

        expect(resultado).toEqual({
            esValido: false,
            errores: ["Los datos de la baja no son válidos."],
        });
    });

    it("elimina correctamente el operador y su usuario", async () => {
        const { usuario, operador } = await crearOperadorDePrueba();

        const resultado = await bajaOperador({
            operadorId: operador.id,
        });

        expect(resultado).toEqual({
            esValido: true,
            mensaje: "Operador eliminado correctamente.",
        });

        const operadorEliminado = await db.orm.public.Operador
            .where({ id: operador.id })
            .first();

        const usuarioEliminado = await db.orm.public.Usuario
            .where({ id: usuario.id })
            .first();

        expect(operadorEliminado).toBeNull();
        expect(usuarioEliminado).toBeNull();

        expect(await obtenerEstadisticasDelDia()).toHaveLength(0);
    });

    it("elimina los locales del operador", async () => {
        const { operador } = await crearOperadorDePrueba();
        const nave = await crearNaveDePrueba();

        await db.orm.public.Local.create({
            operadorId: operador.id,
            naveId: nave.id,
            numeroLocal: "998",
            finContrato: null,
        });

        const resultado = await bajaOperador({
            operadorId: operador.id,
        });

        expect(resultado.esValido).toBe(true);

        const local = await db.orm.public.Local
            .where({ operadorId: operador.id })
            .first();

        expect(local).toBeNull();
    });

    it("registra una única estadística con cantidad cero al eliminar todas las publicaciones", async () => {
        const { usuario, operador } = await crearOperadorDePrueba();

        const publicaciones = await crearPublicacionesDePrueba(
            operador.id,
            2,
        );

        const resultado = await bajaOperador({
            operadorId: operador.id,
        });

        expect(resultado.esValido).toBe(true);

        const publicacionesRestantes = await Promise.all(
            publicaciones.map((id) =>
                db.orm.public.Publicacion.where({ id }).first(),
            ),
        );

        expect(
            publicacionesRestantes.every(
                (publicacion) => publicacion === null,
            ),
        ).toBe(true);

        const relacionesRestantes = await db.orm.public.PublicacionOperador
            .where({ operadorId: operador.id })
            .all();

        expect(relacionesRestantes).toHaveLength(0);

        const estadisticas = await obtenerEstadisticasDelDia();

        expect(estadisticas).toHaveLength(1);

        expect(estadisticas[0]).toMatchObject({
            username: usuario.username,
            cantidad: 0,
        });

        expect(estadisticas[0].fecha.toString()).toBe(
            obtenerFechaEstadisticaActual().toString(),
        );
    });

    it("actualiza el registro estadístico existente del mismo día en lugar de crear otro", async () => {
        const { usuario, operador } = await crearOperadorDePrueba();

        const publicaciones = await crearPublicacionesDePrueba(
            operador.id,
            2,
        );

        const fecha = obtenerFechaEstadisticaActual();

        const estadisticaInicial =
            await db.orm.public.EstadisticaCantidadPublicacion.create({
                fecha,
                username: usuario.username,
                cantidad: publicaciones.length,
            });

        const resultado = await bajaOperador({
            operadorId: operador.id,
        });

        expect(resultado.esValido).toBe(true);

        const estadisticas = await obtenerEstadisticasDelDia();

        expect(estadisticas).toHaveLength(1);
        expect(estadisticas[0].id).toBe(estadisticaInicial.id);
        expect(estadisticas[0].cantidad).toBe(0);
        expect(estadisticas[0].username).toBe(usuario.username);
    });

    it("rechaza la baja cuando el operador no existe", async () => {
        const resultado = await bajaOperador({
            operadorId: 999999999,
        });

        expect(resultado).toEqual({
            esValido: false,
            errores: ["El operador seleccionado ya no existe."],
        });
    });
});