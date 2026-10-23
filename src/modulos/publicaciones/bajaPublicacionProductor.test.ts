import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const buscarRelacion = vi.hoisted(() => vi.fn());
const buscarPublicacion = vi.hoisted(() => vi.fn());
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

function prepararTransaccion() {
    consultaSql.mockImplementation(() => ({
        returnsRow: () => ({ build: () => "bloqueo del productor" }),
    }));
    ejecutarTransaccion.mockImplementation(async (operacion: (tx: unknown) => Promise<unknown>) => operacion({
        execute: ejecutarSql,
        orm: {
            public: {
                PublicacionProductor: { where: () => ({ first: buscarRelacion }) },
                Publicacion: { where: () => ({ first: buscarPublicacion, delete: eliminarPublicacion }) },
            },
        },
    }));
}

describe("bajaPublicacionProductor", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        prepararTransaccion();
        buscarPublicacion.mockResolvedValue({ id: 15, foto: null });
        eliminarImagen.mockResolvedValue(undefined);
    });
    afterEach(() => vi.restoreAllMocks());

    it("elimina una publicación que pertenece al productor bajo el bloqueo", async () => {
        buscarRelacion.mockResolvedValue({ publicacionId: 15, productorId: 3 });

        const resultado = await bajaPublicacionProductor(15, 3);

        expect(resultado).toBe(true);
        expect(consultaSql).toHaveBeenCalledWith(expect.any(Array), 3);
        expect(consultaSql.mock.calls[0][0].join("")).toContain("pg_advisory_xact_lock(1720, ");
        expect(ejecutarSql).toHaveBeenCalledExactlyOnceWith("bloqueo del productor");
        expect(ejecutarSql.mock.invocationCallOrder[0]).toBeLessThan(buscarRelacion.mock.invocationCallOrder[0]);
        expect(eliminarPublicacion).toHaveBeenCalledOnce();
    });

    it("limpia la imagen sólo después de confirmar la transacción", async () => {
        buscarRelacion.mockResolvedValue({ publicacionId: 15, productorId: 3 });
        buscarPublicacion.mockResolvedValue({ id: 15, foto: urlFoto });
        let commitTerminado = false;
        const transaccion = ejecutarTransaccion.getMockImplementation()!;
        ejecutarTransaccion.mockImplementation(async (...argumentos) => {
            const resultado = await transaccion(...argumentos);
            commitTerminado = true;
            return resultado;
        });
        eliminarImagen.mockImplementation(async () => expect(commitTerminado).toBe(true));

        expect(await bajaPublicacionProductor(15, 3)).toBe(true);
        expect(eliminarImagen).toHaveBeenCalledExactlyOnceWith(urlFoto);
    });

    it("mantiene la baja exitosa si falla la limpieza del archivo", async () => {
        buscarRelacion.mockResolvedValue({ publicacionId: 15, productorId: 3 });
        buscarPublicacion.mockResolvedValue({ id: 15, foto: urlFoto });
        const error = new Error("Archivo bloqueado");
        eliminarImagen.mockRejectedValue(error);
        const registrar = vi.spyOn(console, "error").mockImplementation(() => undefined);

        expect(await bajaPublicacionProductor(15, 3)).toBe(true);
        expect(registrar).toHaveBeenCalledWith(expect.any(String), error);
    });

    it("no elimina una publicación que pertenece a otro productor", async () => {
        buscarRelacion.mockResolvedValue(null);
        buscarPublicacion.mockResolvedValue({ id: 15, foto: urlFoto });

        const resultado = await bajaPublicacionProductor(15, 8);

        expect(resultado).toBe(false);
        expect(eliminarPublicacion).not.toHaveBeenCalled();
        expect(eliminarImagen).not.toHaveBeenCalled();
    });

    it("acepta una baja repetida si la publicación ya no existe", async () => {
        buscarRelacion.mockResolvedValueOnce({ publicacionId: 15, productorId: 3 }).mockResolvedValueOnce(null);
        buscarPublicacion.mockResolvedValueOnce({ id: 15, foto: null }).mockResolvedValueOnce(null);

        expect(await bajaPublicacionProductor(15, 3)).toBe(true);
        expect(await bajaPublicacionProductor(15, 3)).toBe(true);
        expect(eliminarPublicacion).toHaveBeenCalledOnce();
        expect(ejecutarSql).toHaveBeenCalledTimes(2);
    });

    it("acepta una publicación inexistente sin intentar eliminarla", async () => {
        buscarRelacion.mockResolvedValue(null);
        buscarPublicacion.mockResolvedValue(null);

        expect(await bajaPublicacionProductor(999, 3)).toBe(true);
        expect(eliminarPublicacion).not.toHaveBeenCalled();
    });

    it("propaga errores de base de datos durante la baja", async () => {
        buscarRelacion.mockResolvedValue({ publicacionId: 15, productorId: 3 });
        const error = new Error("falló la base de datos");
        eliminarPublicacion.mockRejectedValue(error);

        await expect(bajaPublicacionProductor(15, 3)).rejects.toBe(error);
        expect(eliminarImagen).not.toHaveBeenCalled();
    });

    it("conserva la imagen si la transacción falla al confirmar después del delete", async () => {
        buscarRelacion.mockResolvedValue({ publicacionId: 15, productorId: 3 });
        buscarPublicacion.mockResolvedValue({ id: 15, foto: urlFoto });
        const transaccion = ejecutarTransaccion.getMockImplementation()!;
        ejecutarTransaccion.mockImplementation(async (...argumentos) => {
            await transaccion(...argumentos);
            throw new Error("Fallo de commit");
        });

        await expect(bajaPublicacionProductor(15, 3)).rejects.toThrow("Fallo de commit");
        expect(eliminarPublicacion).toHaveBeenCalledOnce();
        expect(eliminarImagen).not.toHaveBeenCalled();
    });
});