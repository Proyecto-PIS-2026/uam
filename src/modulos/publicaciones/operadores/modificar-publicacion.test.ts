import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    ErrorEdicionPublicacion,
    modificarPublicacionOperador,
    type CambiosPublicacionOperador,
} from "./modificar-publicacion";

const mocks = vi.hoisted(() => {
    const consulta = () => ({
        select: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        include: vi.fn().mockReturnThis(),
        first: vi.fn(),
        update: vi.fn(),
    });

    return {
        operador: consulta(),
        vinculo: consulta(),
        publicacion: consulta(),
        presentacion: consulta(),
        categoria: consulta(),
        calibre: consulta(),
        transaction: vi.fn(),
    };
});

vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
    db: {
        transaction: mocks.transaction,
        orm: { public: {
            Operador: mocks.operador,
            PublicacionOperador: mocks.vinculo,
            Publicacion: mocks.publicacion,
            Presentacion: mocks.presentacion,
            Categoria: mocks.categoria,
            Calibre: mocks.calibre,
        } },
    },
}));

const cambios: CambiosPublicacionOperador = {
    precio: "125.50",
    foto: "data:image/jpeg;base64,foto",
    categoriaId: 4,
    calibreId: 2,
    presentacionId: 8,
    disponible: true,
};

function prepararTransaccion() {
    mocks.operador.first.mockResolvedValue({ id: 3 });
    mocks.vinculo.first.mockResolvedValue({ id: 12, publicacionId: 20 });
    mocks.publicacion.first.mockResolvedValue({ tipoPublicacion: "OPERADOR" });
    mocks.presentacion.first.mockResolvedValue({
        id: 8,
        presentacionActiva: true,
        variedad: { especieId: 6, variedadActiva: true, especie: { especieActiva: true } },
    });
    mocks.categoria.first.mockResolvedValue({ id: 4, especieId: null });
    mocks.calibre.first.mockResolvedValue({ id: 2 });
    mocks.publicacion.update.mockResolvedValue(undefined);
    mocks.transaction.mockImplementation((callback: (tx: unknown) => unknown) => callback({
        orm: { public: {
            Operador: mocks.operador,
            PublicacionOperador: mocks.vinculo,
            Publicacion: mocks.publicacion,
            Presentacion: mocks.presentacion,
            Categoria: mocks.categoria,
            Calibre: mocks.calibre,
        } },
    }));
}

describe("modificarPublicacionOperador", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        prepararTransaccion();
    });

    it("guarda los cambios de una publicación del operador", async () => {
        await expect(modificarPublicacionOperador(9, 12, cambios)).resolves.toEqual({
            publicacionOperadorId: 12,
            publicacionId: 20,
        });
        expect(mocks.publicacion.update).toHaveBeenCalledWith({
            precio: "125.50",
            foto: cambios.foto,
            categoriaId: 4,
            calibreId: 2,
            presentacionId: 8,
            publicacionDisponible: true,
        });
    });

    it.each(["12,50", "-1", "10000000000", "1.234"])(
        "rechaza el precio inválido %s antes de abrir la transacción",
        async (precio) => {
            await expect(modificarPublicacionOperador(9, 12, { ...cambios, precio })).rejects.toMatchObject({ codigo: "DATOS_INVALIDOS" });
            expect(mocks.transaction).not.toHaveBeenCalled();
        },
    );

    it("permite guardar un precio vacío", async () => {
        await modificarPublicacionOperador(9, 12, { ...cambios, precio: null });
        expect(mocks.publicacion.update).toHaveBeenCalledWith(expect.objectContaining({ precio: null }));
    });

    it("rechaza datos de cambio inválidos", async () => {
        await expect(modificarPublicacionOperador(9, 12, null as unknown as CambiosPublicacionOperador))
            .rejects.toBeInstanceOf(ErrorEdicionPublicacion);
        await expect(modificarPublicacionOperador(9, 12, { ...cambios, disponible: "sí" as unknown as boolean }))
            .rejects.toMatchObject({ codigo: "DATOS_INVALIDOS" });
    });

    it("rechaza al operador sin registro", async () => {
        mocks.operador.first.mockResolvedValue(null);
        await expect(modificarPublicacionOperador(9, 12, cambios)).rejects.toMatchObject({ codigo: "NO_ENCONTRADA" });
    });

    it("rechaza una publicación que no pertenece al operador", async () => {
        mocks.vinculo.first.mockResolvedValue(null);
        await expect(modificarPublicacionOperador(9, 12, cambios)).rejects.toMatchObject({ codigo: "NO_ENCONTRADA" });
    });

    it("rechaza publicaciones de otro tipo", async () => {
        mocks.publicacion.first.mockResolvedValue({ tipoPublicacion: "PRODUCTOR" });
        await expect(modificarPublicacionOperador(9, 12, cambios)).rejects.toMatchObject({ codigo: "NO_ENCONTRADA" });
    });

    it.each([
        { presentacionActiva: false, variedad: { especieId: 6, variedadActiva: true, especie: { especieActiva: true } } },
        { presentacionActiva: true, variedad: { especieId: 6, variedadActiva: false, especie: { especieActiva: true } } },
        { presentacionActiva: true, variedad: { especieId: 6, variedadActiva: true, especie: { especieActiva: false } } },
    ])("rechaza una presentación inactiva o inexistente en la jerarquía", async (presentacion) => {
        mocks.presentacion.first.mockResolvedValue({ id: 8, ...presentacion });
        await expect(modificarPublicacionOperador(9, 12, cambios)).rejects.toMatchObject({ codigo: "DATOS_INVALIDOS" });
    });

    it("rechaza una categoría inexistente o de otra especie", async () => {
        mocks.categoria.first.mockResolvedValue(null);
        await expect(modificarPublicacionOperador(9, 12, cambios)).rejects.toMatchObject({ codigo: "DATOS_INVALIDOS" });
        prepararTransaccion();
        mocks.categoria.first.mockResolvedValue({ id: 4, especieId: 77 });
        await expect(modificarPublicacionOperador(9, 12, cambios)).rejects.toMatchObject({ codigo: "DATOS_INVALIDOS" });
    });

    it("rechaza un calibre inexistente", async () => {
        mocks.calibre.first.mockResolvedValue(null);
        await expect(modificarPublicacionOperador(9, 12, cambios)).rejects.toMatchObject({ codigo: "DATOS_INVALIDOS" });
    });
});
