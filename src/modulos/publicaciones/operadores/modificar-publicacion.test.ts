import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorImagenPublicacion } from "./imagenes-publicacion";
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
        all: vi.fn(),
        update: vi.fn(),
    });

    return {
        operador: consulta(),
        vinculo: consulta(),
        publicacion: consulta(),
        presentacion: consulta(),
        categoria: consulta(),
        calibre: consulta(),
        pais: consulta(),
        transaction: vi.fn(),
        rawSql: vi.fn(),
        execute: vi.fn(),
        guardarImagen: vi.fn(),
        eliminarImagen: vi.fn(),
    };
});

vi.mock("../../../infraestructura/persistencia/prisma/db", () => ({
    db: {
        transaction: mocks.transaction,
        raw: { sql: mocks.rawSql },
        orm: { public: {
            Operador: mocks.operador,
            PublicacionOperador: mocks.vinculo,
            Publicacion: mocks.publicacion,
            Presentacion: mocks.presentacion,
            Categoria: mocks.categoria,
            Calibre: mocks.calibre,
            Pais: mocks.pais,
        } },
    },
}));

vi.mock("./imagenes-publicacion", () => ({
    ErrorImagenPublicacion: class ErrorImagenPublicacion extends Error {},
    guardarImagenPublicacion: mocks.guardarImagen,
    eliminarImagenPublicacionGestionada: mocks.eliminarImagen,
}));

const FOTO_ANTERIOR = "/api/publicaciones/imagenes/20/11111111-1111-4111-8111-111111111111.jpg";
const FOTO_NUEVA = "/api/publicaciones/imagenes/20/22222222-2222-4222-8222-222222222222.jpg";
const resultadoEsperado = { publicacionOperadorId: 12, publicacionId: 20 };

const cambios: CambiosPublicacionOperador = {
    precio: "125",
    foto: FOTO_ANTERIOR,
    categoriaId: 4,
    calibreId: 2,
    presentacionId: 8,
    paisId: 5,
    disponible: true,
};

const transaccion = {
    execute: mocks.execute,
    orm: { public: {
        Operador: mocks.operador,
        PublicacionOperador: mocks.vinculo,
        Publicacion: mocks.publicacion,
        Presentacion: mocks.presentacion,
        Categoria: mocks.categoria,
        Calibre: mocks.calibre,
        Pais: mocks.pais,
    } },
};

function archivoNuevo(): File {
    return new File(["foto simulada"], "nueva.jpg", { type: "image/jpeg" });
}

function prepararTransaccion() {
    for (const consulta of [mocks.operador, mocks.vinculo, mocks.publicacion, mocks.presentacion, mocks.categoria, mocks.calibre, mocks.pais]) {
        consulta.select.mockReturnThis();
        consulta.where.mockReturnThis();
        consulta.include.mockReturnThis();
    }
    mocks.operador.first.mockResolvedValue({ id: 3 });
    mocks.vinculo.first.mockResolvedValue({ id: 12, publicacionId: 20 });
    mocks.vinculo.all.mockResolvedValue([{ id: 12, publicacionId: 20, operadorId: 3 }]);
    mocks.publicacion.first.mockResolvedValue({ tipoPublicacion: "OPERADOR", foto: FOTO_ANTERIOR });
    mocks.publicacion.all.mockResolvedValue([]);
    mocks.presentacion.first.mockResolvedValue({
        id: 8,
        presentacionActiva: true,
        variedad: { especieId: 6, variedadActiva: true, especie: { especieActiva: true } },
    });
    mocks.categoria.first.mockResolvedValue({ id: 4, especieId: null });
    mocks.calibre.first.mockResolvedValue({ id: 2 });
    mocks.pais.first.mockResolvedValue({ id: 5 });
    mocks.publicacion.update.mockResolvedValue(undefined);
    mocks.vinculo.update.mockResolvedValue(undefined);
    mocks.transaction.mockImplementation((callback: (tx: typeof transaccion) => unknown) => callback(transaccion));
    mocks.rawSql.mockReturnValue({ returnsRow: () => ({ build: () => ({}) }) });
    mocks.execute.mockResolvedValue(undefined);
    mocks.guardarImagen.mockResolvedValue(FOTO_NUEVA);
    mocks.eliminarImagen.mockResolvedValue(undefined);
}

describe("modificarPublicacionOperador", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        prepararTransaccion();
    });

    afterEach(() => vi.restoreAllMocks());

    it("guarda los cambios de una publicación del operador", async () => {
        await expect(modificarPublicacionOperador(9, 12, cambios)).resolves.toEqual({
            publicacionOperadorId: 12,
            publicacionId: 20,
        });
        expect(mocks.publicacion.update).toHaveBeenCalledWith({
            precio: "125",
            foto: cambios.foto,
            categoriaId: 4,
            calibreId: 2,
            presentacionId: 8,
            publicacionDisponible: true,
        });
        expect(mocks.operador.where).toHaveBeenCalledWith({ usuarioId: 9 });
        expect(mocks.vinculo.where).toHaveBeenCalledWith({ id: 12, operadorId: 3 });
        expect(mocks.vinculo.where).toHaveBeenCalledWith({ id: 12 });
        expect(mocks.vinculo.update).toHaveBeenCalledExactlyOnceWith({ paisId: 5 });
        expect(mocks.pais.where).toHaveBeenCalledWith({ id: 5 });
        expect(mocks.publicacion.where).toHaveBeenCalledWith({ id: 20 });
        expect(mocks.execute).toHaveBeenCalledOnce();
        expect(mocks.execute.mock.invocationCallOrder[0]).toBeLessThan(mocks.vinculo.all.mock.invocationCallOrder[0]);
        expect(mocks.guardarImagen).not.toHaveBeenCalled();
        expect(mocks.eliminarImagen).not.toHaveBeenCalled();
    });

    it("rechaza una combinación ya publicada por el mismo operador antes de guardar la foto", async () => {
        mocks.vinculo.all.mockResolvedValue([
            { id: 12, publicacionId: 20, operadorId: 3 },
            { id: 13, publicacionId: 21, operadorId: 3 },
        ]);
        mocks.publicacion.all.mockResolvedValue([{ id: 21 }]);

        await expect(modificarPublicacionOperador(9, 12, cambios, archivoNuevo())).rejects.toMatchObject({
            codigo: "DATOS_INVALIDOS",
            message: "Este operador ya tiene una publicación con la misma especie, variedad, presentación, categoría y calibre.",
        });
        expect(mocks.vinculo.where).toHaveBeenCalledWith({ operadorId: 3 });
        expect(mocks.publicacion.where).toHaveBeenCalledWith({ presentacionId: 8, categoriaId: 4, calibreId: 2 });
        expect(mocks.guardarImagen).not.toHaveBeenCalled();
        expect(mocks.publicacion.update).not.toHaveBeenCalled();
        expect(mocks.vinculo.update).not.toHaveBeenCalled();
    });

    it("no considera duplicado a la propia publicación ni a otra de otro operador", async () => {
        mocks.vinculo.all.mockResolvedValue([
            { id: 12, publicacionId: 20, operadorId: 3 },
            { id: 13, publicacionId: 21, operadorId: 3 },
        ]);
        mocks.publicacion.all.mockResolvedValue([{ id: 20 }, { id: 90 }]);

        await expect(modificarPublicacionOperador(9, 12, cambios)).resolves.toEqual(resultadoEsperado);
        expect(mocks.publicacion.update).toHaveBeenCalledOnce();
    });

    it.each(["12.50", "12,50", "1.00", "0.00", "9999999999.99", "-1", "10000000000", "1.234", "1e2", "+1", "01", ""])(
        "rechaza el precio inválido %s antes de abrir la transacción",
        async (precio) => {
            await expect(modificarPublicacionOperador(9, 12, { ...cambios, precio })).rejects.toMatchObject({
                codigo: "DATOS_INVALIDOS",
                message: "El precio debe ser un número entero de hasta 10 dígitos, sin decimales.",
            });
            expect(mocks.transaction).not.toHaveBeenCalled();
        },
    );

    it("permite guardar sin precio", async () => {
        await modificarPublicacionOperador(9, 12, { ...cambios, precio: null });
        expect(mocks.publicacion.update).toHaveBeenCalledWith(expect.objectContaining({ precio: null }));
    });

    it.each([null, undefined, []])("rechaza cambios que no son un objeto válido: %s", async (datos) => {
        await expect(modificarPublicacionOperador(9, 12, datos as unknown as CambiosPublicacionOperador))
            .rejects.toBeInstanceOf(ErrorEdicionPublicacion);
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it.each(["sí", null, undefined])("rechaza disponibilidad no booleana: %s", async (disponible) => {
        await expect(modificarPublicacionOperador(9, 12, { ...cambios, disponible: disponible as unknown as boolean }))
            .rejects.toMatchObject({ codigo: "DATOS_INVALIDOS" });
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("rechaza precios que no son texto o null antes de iniciar la transacción", async () => {
        await expect(modificarPublicacionOperador(9, 12, { ...cambios, precio: 125 as unknown as string }))
            .rejects.toMatchObject({ codigo: "DATOS_INVALIDOS", message: "El precio no es válido." });
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it.each([
        { entrada: " 125 ", esperado: "125" },
        { entrada: "0", esperado: "0" },
        { entrada: "9999999999", esperado: "9999999999" },
    ])("normaliza y permite el precio $entrada", async ({ entrada, esperado }) => {
        await modificarPublicacionOperador(9, 12, { ...cambios, precio: entrada });
        expect(mocks.publicacion.update).toHaveBeenCalledWith(expect.objectContaining({ precio: esperado }));
    });

    it("persiste la disponibilidad false", async () => {
        await modificarPublicacionOperador(9, 12, { ...cambios, disponible: false });
        expect(mocks.publicacion.update).toHaveBeenCalledWith(expect.objectContaining({ publicacionDisponible: false }));
    });

    it.each([undefined, null, "5", 0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
        "rechaza un país inválido antes de abrir la transacción: %s",
        async (paisId) => {
            await expect(modificarPublicacionOperador(9, 12, {
                ...cambios,
                paisId: paisId as unknown as number,
            }, archivoNuevo())).rejects.toMatchObject({ codigo: "DATOS_INVALIDOS", message: "El país no es válido." });
            expect(mocks.transaction).not.toHaveBeenCalled();
            expect(mocks.guardarImagen).not.toHaveBeenCalled();
            expect(mocks.publicacion.update).not.toHaveBeenCalled();
            expect(mocks.vinculo.update).not.toHaveBeenCalled();
        },
    );

    it("rechaza un país inexistente antes de guardar la foto o actualizar datos", async () => {
        mocks.pais.first.mockResolvedValue(null);
        await expect(modificarPublicacionOperador(9, 12, cambios, archivoNuevo()))
            .rejects.toMatchObject({ codigo: "DATOS_INVALIDOS", message: "El país no existe." });
        expect(mocks.guardarImagen).not.toHaveBeenCalled();
        expect(mocks.publicacion.update).not.toHaveBeenCalled();
        expect(mocks.vinculo.update).not.toHaveBeenCalled();
        expect(mocks.eliminarImagen).not.toHaveBeenCalled();
    });

    it("guarda el país seleccionado en el vínculo de la publicación", async () => {
        mocks.pais.first.mockResolvedValue({ id: 77 });
        await expect(modificarPublicacionOperador(9, 12, { ...cambios, paisId: 77 })).resolves.toEqual(resultadoEsperado);
        expect(mocks.pais.where).toHaveBeenCalledWith({ id: 77 });
        expect(mocks.vinculo.update).toHaveBeenCalledExactlyOnceWith({ paisId: 77 });
    });

    it("rechaza al operador sin registro", async () => {
        mocks.operador.first.mockResolvedValue(null);
        await expect(modificarPublicacionOperador(9, 12, cambios, archivoNuevo())).rejects.toMatchObject({ codigo: "NO_ENCONTRADA" });
        expect(mocks.vinculo.first).not.toHaveBeenCalled();
        expect(mocks.guardarImagen).not.toHaveBeenCalled();
        expect(mocks.publicacion.update).not.toHaveBeenCalled();
    });

    it("rechaza una publicación que no pertenece al operador", async () => {
        mocks.vinculo.first.mockResolvedValue(null);
        await expect(modificarPublicacionOperador(9, 12, cambios, archivoNuevo())).rejects.toMatchObject({ codigo: "NO_ENCONTRADA" });
        expect(mocks.publicacion.first).not.toHaveBeenCalled();
        expect(mocks.guardarImagen).not.toHaveBeenCalled();
        expect(mocks.publicacion.update).not.toHaveBeenCalled();
    });

    it("rechaza publicaciones de otro tipo", async () => {
        mocks.publicacion.first.mockResolvedValue({ tipoPublicacion: "PRODUCTOR" });
        await expect(modificarPublicacionOperador(9, 12, cambios, archivoNuevo())).rejects.toMatchObject({ codigo: "NO_ENCONTRADA" });
        expect(mocks.guardarImagen).not.toHaveBeenCalled();
        expect(mocks.publicacion.update).not.toHaveBeenCalled();
    });

    it("rechaza una publicación inexistente sin tocar archivos ni actualizar datos", async () => {
        mocks.publicacion.first.mockResolvedValue(null);
        await expect(modificarPublicacionOperador(9, 12, cambios, archivoNuevo())).rejects.toMatchObject({ codigo: "NO_ENCONTRADA" });
        expect(mocks.guardarImagen).not.toHaveBeenCalled();
        expect(mocks.publicacion.update).not.toHaveBeenCalled();
    });

    it("rechaza una presentación inexistente", async () => {
        mocks.presentacion.first.mockResolvedValue(null);
        await expect(modificarPublicacionOperador(9, 12, cambios, archivoNuevo()))
            .rejects.toMatchObject({ codigo: "DATOS_INVALIDOS", message: "La presentación no existe." });
        expect(mocks.guardarImagen).not.toHaveBeenCalled();
        expect(mocks.publicacion.update).not.toHaveBeenCalled();
    });

    it.each([
        { presentacionActiva: false, variedad: { especieId: 6, variedadActiva: true, especie: { especieActiva: true } } },
        { presentacionActiva: true, variedad: { especieId: 6, variedadActiva: false, especie: { especieActiva: true } } },
        { presentacionActiva: true, variedad: { especieId: 6, variedadActiva: true, especie: { especieActiva: false } } },
    ])("rechaza una presentación, variedad o especie inactiva", async (presentacion) => {
        mocks.presentacion.first.mockResolvedValue({ id: 8, ...presentacion });
        await expect(modificarPublicacionOperador(9, 12, cambios, archivoNuevo())).rejects.toMatchObject({ codigo: "DATOS_INVALIDOS" });
        expect(mocks.guardarImagen).not.toHaveBeenCalled();
        expect(mocks.publicacion.update).not.toHaveBeenCalled();
    });

    it("rechaza una categoría inexistente", async () => {
        mocks.categoria.first.mockResolvedValue(null);
        await expect(modificarPublicacionOperador(9, 12, cambios, archivoNuevo())).rejects.toMatchObject({ codigo: "DATOS_INVALIDOS" });
        expect(mocks.guardarImagen).not.toHaveBeenCalled();
        expect(mocks.publicacion.update).not.toHaveBeenCalled();
    });

    it("rechaza una categoría de otra especie", async () => {
        mocks.categoria.first.mockResolvedValue({ id: 4, especieId: 77 });
        await expect(modificarPublicacionOperador(9, 12, cambios, archivoNuevo())).rejects.toMatchObject({ codigo: "DATOS_INVALIDOS" });
        expect(mocks.guardarImagen).not.toHaveBeenCalled();
        expect(mocks.publicacion.update).not.toHaveBeenCalled();
    });

    it("permite una categoría específica de la especie de la presentación", async () => {
        mocks.categoria.first.mockResolvedValue({ id: 4, especieId: 6 });
        await expect(modificarPublicacionOperador(9, 12, cambios)).resolves.toEqual(resultadoEsperado);
        expect(mocks.publicacion.update).toHaveBeenCalledWith(expect.objectContaining({ categoriaId: 4 }));
    });

    it("rechaza un calibre inexistente", async () => {
        mocks.calibre.first.mockResolvedValue(null);
        await expect(modificarPublicacionOperador(9, 12, cambios, archivoNuevo())).rejects.toMatchObject({ codigo: "DATOS_INVALIDOS" });
        expect(mocks.guardarImagen).not.toHaveBeenCalled();
        expect(mocks.publicacion.update).not.toHaveBeenCalled();
    });

    it("guarda el archivo bajo el ID de publicación y elimina la foto anterior al confirmar la transacción", async () => {
        const fotoNueva = archivoNuevo();
        const confirmarTransaccion = vi.fn();
        mocks.transaction.mockImplementation(async (callback: (tx: typeof transaccion) => Promise<unknown>) => {
            const resultado = await callback(transaccion);
            confirmarTransaccion();
            return resultado;
        });
        await expect(modificarPublicacionOperador(9, 12, cambios, fotoNueva)).resolves.toEqual(resultadoEsperado);
        expect(mocks.guardarImagen).toHaveBeenCalledExactlyOnceWith(20, fotoNueva);
        expect(mocks.pais.first.mock.invocationCallOrder[0]).toBeLessThan(mocks.guardarImagen.mock.invocationCallOrder[0]);
        expect(mocks.publicacion.update).toHaveBeenCalledWith(expect.objectContaining({ foto: FOTO_NUEVA }));
        expect(mocks.eliminarImagen).toHaveBeenCalledExactlyOnceWith(FOTO_ANTERIOR, 20);
        expect(confirmarTransaccion.mock.invocationCallOrder[0]).toBeLessThan(mocks.eliminarImagen.mock.invocationCallOrder[0]);
    });

    it("borra la foto de la publicación y limpia el archivo anterior", async () => {
        await modificarPublicacionOperador(9, 12, { ...cambios, foto: null });
        expect(mocks.publicacion.update).toHaveBeenCalledWith(expect.objectContaining({ foto: null }));
        expect(mocks.guardarImagen).not.toHaveBeenCalled();
        expect(mocks.eliminarImagen).toHaveBeenCalledExactlyOnceWith(FOTO_ANTERIOR, 20);
    });

    it("convierte los errores de validación de imagen en DATOS_INVALIDOS", async () => {
        mocks.guardarImagen.mockRejectedValue(new ErrorImagenPublicacion("La imagen debe ser JPEG, PNG o WebP."));
        await expect(modificarPublicacionOperador(9, 12, cambios, archivoNuevo())).rejects.toMatchObject({
            name: "ErrorEdicionPublicacion",
            codigo: "DATOS_INVALIDOS",
            message: "La imagen debe ser JPEG, PNG o WebP.",
        });
        expect(mocks.publicacion.update).not.toHaveBeenCalled();
        expect(mocks.eliminarImagen).not.toHaveBeenCalled();
    });

    it("propaga un fallo de almacenamiento sin borrar la foto anterior", async () => {
        const errorOriginal = new Error("No hay espacio para guardar la imagen.");
        mocks.guardarImagen.mockRejectedValue(errorOriginal);
        await expect(modificarPublicacionOperador(9, 12, cambios, archivoNuevo())).rejects.toBe(errorOriginal);
        expect(mocks.publicacion.update).not.toHaveBeenCalled();
        expect(mocks.eliminarImagen).not.toHaveBeenCalled();
    });

    it("limpia únicamente la foto nueva cuando falla la actualización", async () => {
        const errorOriginal = new Error("Falló la actualización.");
        mocks.publicacion.update.mockRejectedValue(errorOriginal);
        await expect(modificarPublicacionOperador(9, 12, cambios, archivoNuevo())).rejects.toBe(errorOriginal);
        expect(mocks.eliminarImagen).toHaveBeenCalledExactlyOnceWith(FOTO_NUEVA, 20);
    });

    it("limpia la foto nueva cuando falla la actualización del país dentro de la transacción", async () => {
        const errorOriginal = new Error("Falló la actualización del país.");
        mocks.vinculo.update.mockRejectedValue(errorOriginal);
        await expect(modificarPublicacionOperador(9, 12, cambios, archivoNuevo())).rejects.toBe(errorOriginal);
        expect(mocks.publicacion.update).toHaveBeenCalledOnce();
        expect(mocks.eliminarImagen).toHaveBeenCalledExactlyOnceWith(FOTO_NUEVA, 20);
    });

    it("limpia la foto nueva si falla la confirmación de la transacción después de actualizar", async () => {
        const errorOriginal = new Error("No se pudo confirmar la transacción.");
        mocks.transaction.mockImplementation(async (callback: (tx: typeof transaccion) => Promise<unknown>) => {
            await callback(transaccion);
            throw errorOriginal;
        });
        await expect(modificarPublicacionOperador(9, 12, cambios, archivoNuevo())).rejects.toBe(errorOriginal);
        expect(mocks.publicacion.update).toHaveBeenCalledOnce();
        expect(mocks.eliminarImagen).toHaveBeenCalledExactlyOnceWith(FOTO_NUEVA, 20);
    });

    it("conserva la foto anterior si falla la actualización sin archivo nuevo", async () => {
        const errorOriginal = new Error("Falló la actualización.");
        mocks.publicacion.update.mockRejectedValue(errorOriginal);
        await expect(modificarPublicacionOperador(9, 12, { ...cambios, foto: null })).rejects.toBe(errorOriginal);
        expect(mocks.guardarImagen).not.toHaveBeenCalled();
        expect(mocks.eliminarImagen).not.toHaveBeenCalled();
    });

    it("conserva el error original y registra el fallo si no puede limpiar tras rollback", async () => {
        const errorOriginal = new Error("Falló la actualización.");
        const errorLimpieza = new Error("No se pudo borrar el archivo.");
        const registrarError = vi.spyOn(console, "error").mockImplementation(() => undefined);
        mocks.publicacion.update.mockRejectedValue(errorOriginal);
        mocks.eliminarImagen.mockRejectedValue(errorLimpieza);
        await expect(modificarPublicacionOperador(9, 12, cambios, archivoNuevo())).rejects.toBe(errorOriginal);
        expect(mocks.eliminarImagen).toHaveBeenCalledExactlyOnceWith(FOTO_NUEVA, 20);
        expect(registrarError).toHaveBeenCalledWith("No se pudo eliminar la imagen tras fallar la edición:", errorLimpieza);
    });

    it("mantiene el guardado exitoso y registra el fallo al limpiar la foto anterior", async () => {
        const errorLimpieza = new Error("No se pudo borrar la foto anterior.");
        const registrarError = vi.spyOn(console, "error").mockImplementation(() => undefined);
        mocks.eliminarImagen.mockRejectedValue(errorLimpieza);
        await expect(modificarPublicacionOperador(9, 12, cambios, archivoNuevo())).resolves.toEqual(resultadoEsperado);
        expect(mocks.publicacion.update).toHaveBeenCalledWith(expect.objectContaining({ foto: FOTO_NUEVA }));
        expect(mocks.eliminarImagen).toHaveBeenCalledExactlyOnceWith(FOTO_ANTERIOR, 20);
        expect(registrarError).toHaveBeenCalledWith("No se pudo eliminar la imagen anterior:", errorLimpieza);
    });
});
