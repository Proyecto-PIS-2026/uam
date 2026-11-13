
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const buscarRelacion = vi.hoisted(() => vi.fn());
const buscarRelacionesRestantes = vi.hoisted(() => vi.fn());
const buscarPublicacion = vi.hoisted(() => vi.fn());
const buscarProductor = vi.hoisted(() => vi.fn());
const buscarUsuario = vi.hoisted(() => vi.fn());
const buscarEstadistica = vi.hoisted(() => vi.fn());
const crearEstadistica = vi.hoisted(() => vi.fn());
const actualizarEstadistica = vi.hoisted(() => vi.fn());

const eliminarPublicacion = vi.hoisted(() => vi.fn());
const ejecutarTransaccion = vi.hoisted(() => vi.fn());
const ejecutarSql = vi.hoisted(() => vi.fn());
const consultaSql = vi.hoisted(() => vi.fn());
const eliminarImagen = vi.hoisted(() => vi.fn());

vi.mock("./imagenes-productor", () => ({
    eliminarImagenProductor: eliminarImagen,
}));

vi.mock("../../infraestructura/persistencia/prisma/db", () => ({
    db: {
        transaction: ejecutarTransaccion,
        raw: { sql: consultaSql },
    },
}));

import { bajaPublicacionProductor } from "./bajaPublicacionProductor";

const urlFoto = "/api/publicaciones/imagenes/15/12345678-1234-4234-8234-123456789abc.png";

const tx = {
    execute: ejecutarSql,
    orm: {
        public: {
            PublicacionProductor: {
                where: (filtro: { publicacionId?: number }) =>
                    filtro.publicacionId !== undefined
                        ? { first: buscarRelacion }
                        : { all: buscarRelacionesRestantes },
            },
            Publicacion: {
                where: () => ({
                    first: buscarPublicacion,
                    delete: eliminarPublicacion,
                }),
            },
            Productor: {
                where: () => ({ first: buscarProductor }),
            },
            Usuario: {
                where: () => ({ first: buscarUsuario }),
            },
            EstadisticaCantidadPublicacion: {
                where: (filtro: { id?: number; fecha?: Temporal.Instant; username?: string }) =>
                    filtro.id !== undefined
                        ? { update: actualizarEstadistica }
                        : { first: buscarEstadistica },
                create: crearEstadistica,
            },
        },
    },
};

function prepararTransaccion() {
    consultaSql.mockImplementation((consulta: TemplateStringsArray) => ({
        returnsRow: () => ({
            build: () => consulta.join("").includes("pg_advisory_xact_lock")
                ? "bloqueo del productor"
                : "bloqueo de la publicación",
        }),
    }));

    ejecutarTransaccion.mockImplementation(
        async (operacion: (transaccion: typeof tx) => Promise<unknown>) =>
            operacion(tx),
    );
}

describe("bajaPublicacionProductor", () => {
    beforeEach(() => {
        vi.resetAllMocks();

        prepararTransaccion();

        buscarRelacion.mockResolvedValue(null);
        buscarRelacionesRestantes.mockResolvedValue([]);

        buscarPublicacion.mockResolvedValue({
            id: 15,
            foto: null,
        });

        buscarProductor.mockResolvedValue({
            id: 3,
            usuarioId: 30,
        });

        buscarUsuario.mockResolvedValue({
            id: 30,
            username: "productor1",
        });

        buscarEstadistica.mockResolvedValue(null);

        crearEstadistica.mockResolvedValue({ id: 100 });
        actualizarEstadistica.mockResolvedValue(undefined);

        eliminarPublicacion.mockResolvedValue(undefined);
        eliminarImagen.mockResolvedValue(undefined);
        ejecutarSql.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it.each([
        ["2026-11-13T00:00:00Z", "2026-11-12"],
        ["2026-11-13T02:59:59Z", "2026-11-12"],
        ["2026-11-13T03:00:00Z", "2026-11-13"],
        ["2026-11-13T15:00:00Z", "2026-11-13"],
    ])("registra la baja de %s en el día de Uruguay %s", async (instante, dia) => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(instante));
        buscarRelacion.mockResolvedValue({ publicacionId: 15, productorId: 3 });
        const consultar = vi.spyOn(tx.orm.public.EstadisticaCantidadPublicacion, "where");

        expect(await bajaPublicacionProductor(15, 3)).toBe(true);

        const filtro = consultar.mock.calls[0][0] as { fecha: Temporal.Instant; username: string };
        expect(filtro.fecha.toString()).toBe(`${dia}T00:00:00Z`);
        expect(filtro.username).toBe("productor1");
        expect(crearEstadistica.mock.calls[0][0].fecha.toString()).toBe(`${dia}T00:00:00Z`);
    });

    it("elimina una publicación que pertenece al productor bajo el bloqueo", async () => {
        buscarRelacion.mockResolvedValue({
            publicacionId: 15,
            productorId: 3,
        });

        const resultado = await bajaPublicacionProductor(15, 3);

        expect(resultado).toBe(true);

        expect(consultaSql).toHaveBeenNthCalledWith(
            1,
            expect.any(Array),
            3,
        );

        expect(consultaSql.mock.calls[0][0].join("")).toContain(
            "pg_advisory_xact_lock(1720, ",
        );

        expect(ejecutarSql).toHaveBeenNthCalledWith(
            1,
            "bloqueo del productor",
        );

        expect(ejecutarSql.mock.invocationCallOrder[0]).toBeLessThan(
            buscarRelacion.mock.invocationCallOrder[0],
        );

        expect(buscarPublicacion).toHaveBeenCalledOnce();
        expect(buscarProductor).toHaveBeenCalledOnce();
        expect(buscarUsuario).toHaveBeenCalledOnce();
        expect(eliminarPublicacion).toHaveBeenCalledOnce();

        expect(buscarRelacionesRestantes).toHaveBeenCalledOnce();

        expect(crearEstadistica).toHaveBeenCalledExactlyOnceWith({
            fecha: expect.anything(),
            username: "productor1",
            cantidad: 0,
        });

        expect(actualizarEstadistica).not.toHaveBeenCalled();
    });

    it("bloquea la relación antes de leer la foto y borrar para serializarse con una edición", async () => {
        buscarRelacion.mockResolvedValue({
            publicacionId: 15,
            productorId: 3,
        });

        await bajaPublicacionProductor(15, 3);

        expect(consultaSql).toHaveBeenNthCalledWith(
            2,
            expect.any(Array),
            15,
            3,
        );

        expect(consultaSql.mock.calls[1][0].join("?")).toBe(
            'SELECT id FROM "publicacionProductor" WHERE "publicacionId" = ? AND "productorId" = ? FOR UPDATE',
        );

        expect(ejecutarSql).toHaveBeenNthCalledWith(
            2,
            "bloqueo de la publicación",
        );

        expect(ejecutarSql.mock.invocationCallOrder[1]).toBeLessThan(
            buscarRelacion.mock.invocationCallOrder[0],
        );

        expect(ejecutarSql.mock.invocationCallOrder[1]).toBeLessThan(
            buscarPublicacion.mock.invocationCallOrder[0],
        );

        expect(buscarPublicacion.mock.invocationCallOrder[0]).toBeLessThan(
            eliminarPublicacion.mock.invocationCallOrder[0],
        );
    });

    it("registra la cantidad de publicaciones restantes después de la baja", async () => {
        buscarRelacion.mockResolvedValue({
            publicacionId: 15,
            productorId: 3,
        });

        buscarRelacionesRestantes.mockResolvedValue([
            { publicacionId: 20, productorId: 3 },
            { publicacionId: 21, productorId: 3 },
            { publicacionId: 22, productorId: 3 },
        ]);

        expect(await bajaPublicacionProductor(15, 3)).toBe(true);

        expect(crearEstadistica).toHaveBeenCalledExactlyOnceWith({
            fecha: expect.anything(),
            username: "productor1",
            cantidad: 3,
        });
    });

    it("actualiza el registro estadístico existente del mismo día", async () => {
        buscarRelacion.mockResolvedValue({
            publicacionId: 15,
            productorId: 3,
        });

        buscarEstadistica.mockResolvedValue({
            id: 456,
            username: "productor1",
            cantidad: 5,
        });

        buscarRelacionesRestantes.mockResolvedValue([
            { publicacionId: 20, productorId: 3 },
            { publicacionId: 21, productorId: 3 },
        ]);

        expect(await bajaPublicacionProductor(15, 3)).toBe(true);

        expect(actualizarEstadistica).toHaveBeenCalledExactlyOnceWith({
            cantidad: 2,
        });

        expect(crearEstadistica).not.toHaveBeenCalled();
    });

    it("limpia la imagen sólo después de confirmar la transacción", async () => {
        buscarRelacion.mockResolvedValue({
            publicacionId: 15,
            productorId: 3,
        });

        buscarPublicacion.mockResolvedValue({
            id: 15,
            foto: urlFoto,
        });

        let commitTerminado = false;

        const transaccion = ejecutarTransaccion.getMockImplementation()!;

        ejecutarTransaccion.mockImplementation(async (...argumentos) => {
            const resultado = await transaccion(...argumentos);
            commitTerminado = true;
            return resultado;
        });

        eliminarImagen.mockImplementation(async () =>
            expect(commitTerminado).toBe(true),
        );

        expect(await bajaPublicacionProductor(15, 3)).toBe(true);

        expect(eliminarImagen).toHaveBeenCalledExactlyOnceWith(
            urlFoto,
            15,
        );
    });

    it("mantiene la baja exitosa si falla la limpieza del archivo", async () => {
        buscarRelacion.mockResolvedValue({
            publicacionId: 15,
            productorId: 3,
        });

        buscarPublicacion.mockResolvedValue({
            id: 15,
            foto: urlFoto,
        });

        const error = new Error("Archivo bloqueado");
        eliminarImagen.mockRejectedValue(error);

        const registrar = vi.spyOn(console, "error").mockImplementation(
            () => undefined,
        );

        expect(await bajaPublicacionProductor(15, 3)).toBe(true);

        expect(registrar).toHaveBeenCalledWith(
            expect.any(String),
            error,
        );
    });

    it("no elimina una publicación que pertenece a otro productor", async () => {
        buscarRelacion.mockResolvedValue(null);

        buscarPublicacion.mockResolvedValue({
            id: 15,
            foto: urlFoto,
        });

        const resultado = await bajaPublicacionProductor(15, 8);

        expect(resultado).toBe(false);

        expect(eliminarPublicacion).not.toHaveBeenCalled();
        expect(buscarProductor).not.toHaveBeenCalled();
        expect(buscarUsuario).not.toHaveBeenCalled();
        expect(buscarRelacionesRestantes).not.toHaveBeenCalled();

        expect(crearEstadistica).not.toHaveBeenCalled();
        expect(actualizarEstadistica).not.toHaveBeenCalled();

        expect(eliminarImagen).not.toHaveBeenCalled();
    });

    it("acepta una baja repetida si la publicación ya no existe", async () => {
        buscarRelacion
            .mockResolvedValueOnce({
                publicacionId: 15,
                productorId: 3,
            })
            .mockResolvedValueOnce(null);

        buscarPublicacion
            .mockResolvedValueOnce({
                id: 15,
                foto: null,
            })
            .mockResolvedValueOnce(null);

        expect(await bajaPublicacionProductor(15, 3)).toBe(true);
        expect(await bajaPublicacionProductor(15, 3)).toBe(true);

        expect(eliminarPublicacion).toHaveBeenCalledOnce();

        expect(ejecutarSql).toHaveBeenCalledTimes(4);

        expect(buscarProductor).toHaveBeenCalledOnce();
        expect(buscarUsuario).toHaveBeenCalledOnce();
        expect(crearEstadistica).toHaveBeenCalledOnce();
    });

    it("acepta una publicación inexistente sin intentar eliminarla", async () => {
        buscarRelacion.mockResolvedValue(null);
        buscarPublicacion.mockResolvedValue(null);

        expect(await bajaPublicacionProductor(999, 3)).toBe(true);

        expect(eliminarPublicacion).not.toHaveBeenCalled();
        expect(buscarProductor).not.toHaveBeenCalled();
        expect(buscarUsuario).not.toHaveBeenCalled();

        expect(crearEstadistica).not.toHaveBeenCalled();
        expect(actualizarEstadistica).not.toHaveBeenCalled();
    });

    it("propaga errores de base de datos durante la baja", async () => {
        buscarRelacion.mockResolvedValue({
            publicacionId: 15,
            productorId: 3,
        });

        const error = new Error("Falló la base de datos");
        eliminarPublicacion.mockRejectedValue(error);

        await expect(
            bajaPublicacionProductor(15, 3),
        ).rejects.toBe(error);

        expect(eliminarImagen).not.toHaveBeenCalled();
        expect(crearEstadistica).not.toHaveBeenCalled();
    });

    it("aborta la transacción si no puede guardar la estadística", async () => {
        buscarRelacion.mockResolvedValue({
            publicacionId: 15,
            productorId: 3,
        });

        const error = new Error("No se pudo guardar la estadística");
        crearEstadistica.mockRejectedValue(error);

        await expect(
            bajaPublicacionProductor(15, 3),
        ).rejects.toBe(error);

        expect(eliminarPublicacion).toHaveBeenCalledOnce();
        expect(buscarRelacionesRestantes).toHaveBeenCalledOnce();
        expect(crearEstadistica).toHaveBeenCalledOnce();

        expect(eliminarImagen).not.toHaveBeenCalled();
    });

    it("conserva la imagen si la transacción falla al confirmar después del delete", async () => {
        buscarRelacion.mockResolvedValue({
            publicacionId: 15,
            productorId: 3,
        });

        buscarPublicacion.mockResolvedValue({
            id: 15,
            foto: urlFoto,
        });

        const transaccion = ejecutarTransaccion.getMockImplementation()!;

        ejecutarTransaccion.mockImplementation(async (...argumentos) => {
            await transaccion(...argumentos);
            throw new Error("Fallo de commit");
        });

        await expect(
            bajaPublicacionProductor(15, 3),
        ).rejects.toThrow("Fallo de commit");

        expect(eliminarPublicacion).toHaveBeenCalledOnce();
        expect(crearEstadistica).toHaveBeenCalledOnce();
        expect(eliminarImagen).not.toHaveBeenCalled();
    });
});
