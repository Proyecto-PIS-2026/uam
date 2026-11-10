import { beforeEach, describe, expect, it, vi } from "vitest";

const buscarRelacion = vi.hoisted(() => vi.fn());
const buscarProductor = vi.hoisted(() => vi.fn());
const baja = vi.hoisted(() => vi.fn());

vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
    db: {
        orm: {
            public: {
                PublicacionProductor: { where: () => ({ first: buscarRelacion }) },
                Productor: { where: () => ({ select: () => ({ first: buscarProductor }) }) },
            },
        },
    },
}));
vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({ obtenerSesion: vi.fn() }));
vi.mock("../bajaPublicacionProductor", () => ({ bajaPublicacionProductor: baja }));

import { ErrorAutorizacion } from "@/modulos/identidad-acceso/autorizacion/controles";
import { bajaPublicacionProductorAutorizada } from "./bajaPublicacionProductorAutorizada";

const sesionDe = (rol: string, usuarioId: number) => ({ rol, usuarioId }) as never;

describe("bajaPublicacionProductorAutorizada", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        buscarRelacion.mockResolvedValue({ id: 40, publicacionId: 15, productorId: 3 });
        buscarProductor.mockResolvedValue({ id: 3, usuarioId: 10 });
        baja.mockResolvedValue(true);
    });

    it("permite al Productor dueño dar de baja su publicación", async () => {
        const resultado = await bajaPublicacionProductorAutorizada(sesionDe("PRODUCTOR", 10), 40);

        expect(resultado).toEqual({ productorId: 3 });
        expect(baja).toHaveBeenCalledExactlyOnceWith(15, 3);
    });

    it("permite a un Administrador dar de baja cualquier publicación", async () => {
        const resultado = await bajaPublicacionProductorAutorizada(sesionDe("ADMINISTRADOR", 99), 40);

        expect(resultado).toEqual({ productorId: 3 });
        expect(baja).toHaveBeenCalledExactlyOnceWith(15, 3);
    });

    it("rechaza con 403 a un Productor que no es el dueño", async () => {
        await expect(bajaPublicacionProductorAutorizada(sesionDe("PRODUCTOR", 11), 40))
            .rejects.toMatchObject({ status: 403 });
        expect(baja).not.toHaveBeenCalled();
    });

    it("rechaza con 403 a un Operador", async () => {
        await expect(bajaPublicacionProductorAutorizada(sesionDe("OPERADOR", 10), 40))
            .rejects.toBeInstanceOf(ErrorAutorizacion);
        expect(baja).not.toHaveBeenCalled();
    });

    it("responde 404 si la publicación no existe", async () => {
        buscarRelacion.mockResolvedValue(null);

        await expect(bajaPublicacionProductorAutorizada(sesionDe("PRODUCTOR", 10), 40))
            .rejects.toMatchObject({ status: 404 });
        expect(baja).not.toHaveBeenCalled();
    });

    it("responde 404 si el Productor no existe", async () => {
        buscarProductor.mockResolvedValue(null);

        await expect(bajaPublicacionProductorAutorizada(sesionDe("ADMINISTRADOR", 99), 40))
            .rejects.toMatchObject({ status: 404 });
        expect(baja).not.toHaveBeenCalled();
    });

    it("responde 404 si la baja informa que la publicación no pertenece al Productor", async () => {
        baja.mockResolvedValue(false);

        await expect(bajaPublicacionProductorAutorizada(sesionDe("PRODUCTOR", 10), 40))
            .rejects.toMatchObject({ status: 404 });
    });

    it("propaga errores inesperados de la baja", async () => {
        const error = new Error("falló la base de datos");
        baja.mockRejectedValue(error);

        await expect(bajaPublicacionProductorAutorizada(sesionDe("PRODUCTOR", 10), 40)).rejects.toBe(error);
    });
});