
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const buscarRelacion = vi.hoisted(() => vi.fn());
const buscarRelacionesRestantes = vi.hoisted(() => vi.fn());
const buscarPublicacion = vi.hoisted(() => vi.fn());
const buscarOperador = vi.hoisted(() => vi.fn());
const buscarUsuario = vi.hoisted(() => vi.fn());
const buscarEstadistica = vi.hoisted(() => vi.fn());
const crearEstadistica = vi.hoisted(() => vi.fn());
const actualizarEstadistica = vi.hoisted(() => vi.fn());

const eliminarPublicacion = vi.hoisted(() => vi.fn());
const ejecutarTransaccion = vi.hoisted(() => vi.fn());
const ejecutarSql = vi.hoisted(() => vi.fn());
const consultaSql = vi.hoisted(() => vi.fn());
const eliminarImagen = vi.hoisted(() => vi.fn());
const notificar = vi.hoisted(() => vi.fn());

vi.mock("@/infraestructura/tiempo-real/publicaciones", () => ({
    notificarCambioPublicacion: notificar,
}));

vi.mock("./operadores/imagenes-publicacion", () => ({
    eliminarImagenPublicacionGestionada: eliminarImagen,
}));

vi.mock("../../infraestructura/persistencia/prisma/db", () => ({
    db: {
        transaction: ejecutarTransaccion,
        raw: { sql: consultaSql },
    },
}));

import { bajaPublicacionOperador } from "./bajaPublicacionOperador";

const tx = {
    execute: ejecutarSql,
    orm: {
        public: {
            PublicacionOperador: {
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
            Operador: {
                where: () => ({ first: buscarOperador }),
            },
            Usuario: {
                where: () => ({ first: buscarUsuario }),
            },
            EstadisticaCantidadPublicacion: {
                where: (filtro: { id?: number }) =>
                    filtro.id !== undefined
                        ? { update: actualizarEstadistica }
                        : { first: buscarEstadistica },
                create: crearEstadistica,
            },
        },
    },
};

function prepararTransaccion() {
    consultaSql.mockImplementation(() => ({
        returnsRow: () => ({
            build: () => "bloqueo del operador",
        }),
    }));

    ejecutarTransaccion.mockImplementation(
        async (operacion: (transaccion: typeof tx) => Promise<unknown>) =>
            operacion(tx),
    );
}

describe("bajaPublicacionOperador", () => {
    beforeEach(() => {
        vi.resetAllMocks();

        prepararTransaccion();

        buscarRelacion.mockResolvedValue(null);
        buscarRelacionesRestantes.mockResolvedValue([]);

        buscarPublicacion.mockResolvedValue({
            id: 15,
            foto: null,
        });

        buscarOperador.mockResolvedValue({
            id: 3,
            usuarioId: 30,
        });

        buscarUsuario.mockResolvedValue({
            id: 30,
            username: "operador1",
        });

        buscarEstadistica.mockResolvedValue(null);
        crearEstadistica.mockResolvedValue({ id: 100 });
        actualizarEstadistica.mockResolvedValue(undefined);

        eliminarPublicacion.mockResolvedValue(undefined);
        eliminarImagen.mockResolvedValue(undefined);
        ejecutarSql.mockResolvedValue(undefined);
        notificar.mockResolvedValue(undefined);
    });

    afterEach(() => vi.restoreAllMocks());

    it("elimina una publicación que pertenece al operador bajo el bloqueo", async () => {
        buscarRelacion.mockResolvedValue({
            publicacionId: 15,
            operadorId: 3,
        });

        const resultado = await bajaPublicacionOperador(15, 3);

        expect(resultado).toBe(true);

        expect(consultaSql).toHaveBeenCalledWith(expect.any(Array), 3);
        expect(consultaSql.mock.calls[0][0].join("")).toContain(
            "pg_advisory_xact_lock(1719, ",
        );

        expect(ejecutarSql).toHaveBeenCalledExactlyOnceWith(
            "bloqueo del operador",
        );

        expect(ejecutarSql.mock.invocationCallOrder[0]).toBeLessThan(
            buscarRelacion.mock.invocationCallOrder[0],
        );

        expect(buscarPublicacion).toHaveBeenCalledOnce();
        expect(buscarOperador).toHaveBeenCalledExactlyOnceWith();
        expect(buscarUsuario).toHaveBeenCalledExactlyOnceWith();
        expect(eliminarPublicacion).toHaveBeenCalledOnce();

        expect(buscarRelacionesRestantes).toHaveBeenCalledOnce();

        expect(crearEstadistica).toHaveBeenCalledExactlyOnceWith({
            fecha: expect.anything(),
            username: "operador1",
            cantidad: 0,
        });

        expect(actualizarEstadistica).not.toHaveBeenCalled();

        expect(notificar).toHaveBeenCalledWith(
            expect.anything(),
            { operadorId: 3, publicacionId: 15 },
        );
    });

    it("registra la cantidad de publicaciones restantes después de la baja", async () => {
        buscarRelacion.mockResolvedValue({
            publicacionId: 15,
            operadorId: 3,
        });

        buscarRelacionesRestantes.mockResolvedValue([
            { publicacionId: 20, operadorId: 3 },
            { publicacionId: 21, operadorId: 3 },
            { publicacionId: 22, operadorId: 3 },
        ]);

        expect(await bajaPublicacionOperador(15, 3)).toBe(true);

        expect(crearEstadistica).toHaveBeenCalledExactlyOnceWith({
            fecha: expect.anything(),
            username: "operador1",
            cantidad: 3,
        });
    });

    it("actualiza el registro estadístico existente del mismo día", async () => {
        buscarRelacion.mockResolvedValue({
            publicacionId: 15,
            operadorId: 3,
        });

        buscarEstadistica.mockResolvedValue({
            id: 456,
            username: "operador1",
            cantidad: 5,
        });

        buscarRelacionesRestantes.mockResolvedValue([
            { publicacionId: 20, operadorId: 3 },
            { publicacionId: 21, operadorId: 3 },
        ]);

        expect(await bajaPublicacionOperador(15, 3)).toBe(true);

        expect(actualizarEstadistica).toHaveBeenCalledExactlyOnceWith({
            cantidad: 2,
        });

        expect(crearEstadistica).not.toHaveBeenCalled();
    });

    it("limpia la imagen gestionada sólo después de confirmar la transacción", async () => {
        const url = "/api/publicaciones/imagenes/15/12345678-1234-4234-8234-123456789abc.png";

        buscarRelacion.mockResolvedValue({
            publicacionId: 15,
            operadorId: 3,
        });

        buscarPublicacion.mockResolvedValue({
            id: 15,
            foto: url,
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

        expect(await bajaPublicacionOperador(15, 3)).toBe(true);

        expect(eliminarImagen).toHaveBeenCalledExactlyOnceWith(url, 15);
    });

    it("mantiene la baja exitosa si falla la limpieza del archivo", async () => {
        buscarRelacion.mockResolvedValue({
            publicacionId: 15,
            operadorId: 3,
        });

        buscarPublicacion.mockResolvedValue({
            id: 15,
            foto: "/api/publicaciones/imagenes/15/12345678-1234-4234-8234-123456789abc.png",
        });

        const error = new Error("Archivo bloqueado");
        eliminarImagen.mockRejectedValue(error);

        const registrar = vi.spyOn(console, "error").mockImplementation(
            () => undefined,
        );

        expect(await bajaPublicacionOperador(15, 3)).toBe(true);

        expect(registrar).toHaveBeenCalledWith(expect.any(String), error);
    });

    it("no elimina una publicación que pertenece a otro operador", async () => {
        buscarRelacion.mockResolvedValue(null);
        buscarPublicacion.mockResolvedValue({ id: 15 });

        const resultado = await bajaPublicacionOperador(15, 8);

        expect(resultado).toBe(false);
        expect(buscarPublicacion).toHaveBeenCalledOnce();

        expect(buscarOperador).not.toHaveBeenCalled();
        expect(buscarUsuario).not.toHaveBeenCalled();
        expect(buscarRelacionesRestantes).not.toHaveBeenCalled();

        expect(eliminarPublicacion).not.toHaveBeenCalled();
        expect(crearEstadistica).not.toHaveBeenCalled();
        expect(actualizarEstadistica).not.toHaveBeenCalled();

        expect(eliminarImagen).not.toHaveBeenCalled();
        expect(notificar).not.toHaveBeenCalled();
    });

    it("acepta una baja repetida si la publicación ya no existe", async () => {
        buscarRelacion
            .mockResolvedValueOnce({
                publicacionId: 15,
                operadorId: 3,
            })
            .mockResolvedValueOnce(null);

        buscarPublicacion.mockResolvedValue(null);

        expect(await bajaPublicacionOperador(15, 3)).toBe(true);
        expect(await bajaPublicacionOperador(15, 3)).toBe(true);

        expect(eliminarPublicacion).toHaveBeenCalledOnce();
        expect(ejecutarSql).toHaveBeenCalledTimes(2);

        expect(buscarOperador).toHaveBeenCalledOnce();
        expect(buscarUsuario).toHaveBeenCalledOnce();
        expect(crearEstadistica).toHaveBeenCalledOnce();
        expect(notificar).toHaveBeenCalledOnce();
    });

    it("acepta una publicación inexistente sin intentar eliminarla", async () => {
        buscarRelacion.mockResolvedValue(null);
        buscarPublicacion.mockResolvedValue(null);

        const resultado = await bajaPublicacionOperador(999, 3);

        expect(resultado).toBe(true);

        expect(eliminarPublicacion).not.toHaveBeenCalled();
        expect(buscarOperador).not.toHaveBeenCalled();
        expect(buscarUsuario).not.toHaveBeenCalled();
        expect(crearEstadistica).not.toHaveBeenCalled();
        expect(notificar).not.toHaveBeenCalled();
    });

    it("propaga errores de base de datos durante la baja", async () => {
        buscarRelacion.mockResolvedValue({
            publicacionId: 15,
            operadorId: 3,
        });

        const error = new Error("Falló la base de datos");
        eliminarPublicacion.mockRejectedValue(error);

        await expect(
            bajaPublicacionOperador(15, 3),
        ).rejects.toBe(error);

        expect(eliminarImagen).not.toHaveBeenCalled();
        expect(crearEstadistica).not.toHaveBeenCalled();
        expect(notificar).not.toHaveBeenCalled();
    });

    it("aborta la transacción si no puede guardar la estadística", async () => {
        buscarRelacion.mockResolvedValue({
            publicacionId: 15,
            operadorId: 3,
        });

        const error = new Error("No se pudo guardar la estadística");
        crearEstadistica.mockRejectedValue(error);

        await expect(
            bajaPublicacionOperador(15, 3),
        ).rejects.toBe(error);

        expect(eliminarPublicacion).toHaveBeenCalledOnce();
        expect(buscarRelacionesRestantes).toHaveBeenCalledOnce();
        expect(crearEstadistica).toHaveBeenCalledOnce();

        expect(notificar).not.toHaveBeenCalled();
        expect(eliminarImagen).not.toHaveBeenCalled();
    });

    it("conserva la imagen si la transacción falla al confirmar después del delete", async () => {
        buscarRelacion.mockResolvedValue({
            publicacionId: 15,
            operadorId: 3,
        });

        buscarPublicacion.mockResolvedValue({
            id: 15,
            foto: "/api/publicaciones/imagenes/15/12345678-1234-4234-8234-123456789abc.png",
        });

        const transaccion = ejecutarTransaccion.getMockImplementation()!;

        ejecutarTransaccion.mockImplementation(async (...argumentos) => {
            await transaccion(...argumentos);
            throw new Error("Fallo de commit");
        });

        await expect(
            bajaPublicacionOperador(15, 3),
        ).rejects.toThrow("Fallo de commit");

        expect(eliminarPublicacion).toHaveBeenCalledOnce();
        expect(crearEstadistica).toHaveBeenCalledOnce();
        expect(notificar).toHaveBeenCalledOnce();
        expect(eliminarImagen).not.toHaveBeenCalled();
    });
});
