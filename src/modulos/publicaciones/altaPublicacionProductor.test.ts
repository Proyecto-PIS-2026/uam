import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    productor: vi.fn(), especie: vi.fn(), variedad: vi.fn(), presentacion: vi.fn(),
    categoria: vi.fn(), calibre: vi.fn(), pais: vi.fn(), relaciones: vi.fn(), coincidencias: vi.fn(),
    crearPublicacion: vi.fn(), crearRelacion: vi.fn(), crearUbicacion: vi.fn(),
    actualizarPublicacion: vi.fn(), eliminarPublicacion: vi.fn(), ejecutar: vi.fn(), transaccion: vi.fn(),
    guardarImagen: vi.fn(), eliminarImagen: vi.fn(),
}));

vi.mock("../../infraestructura/persistencia/prisma/db", () => ({
    db: {
        orm: { public: {
            Productor: { where: () => ({ first: mocks.productor }) },
            Especie: { where: () => ({ first: mocks.especie }) },
            Variedad: { where: () => ({ first: mocks.variedad }) },
            Presentacion: { where: () => ({ first: mocks.presentacion }) },
            Categoria: { where: () => ({ first: mocks.categoria }) },
            Calibre: { where: () => ({ first: mocks.calibre }) },
            Pais: { where: () => ({ first: mocks.pais }) },
            Publicacion: { where: () => ({ update: mocks.actualizarPublicacion, delete: mocks.eliminarPublicacion }) },
        } },
        raw: { sql: () => ({ returnsRow: () => ({ build: () => "bloqueo del productor" }) }) },
        transaction: mocks.transaccion,
    },
}));
vi.mock("./imagenes-productor", async (importar) => ({
    ...await importar<typeof import("./imagenes-productor")>(),
    guardarImagenProductor: mocks.guardarImagen,
    eliminarImagenProductor: mocks.eliminarImagen,
}));

import { altaPublicacionProductor } from "./altaPublicacionProductor";
import { ErrorImagenProductor } from "./imagenes-productor";

const datos = {
    productorId: 1, especieId: 2, variedadId: 3, presentacionId: 4,
    categoriaId: 5, calibreId: 6, paisId: 7,
    latitud: -34.9, longitud: -56.2, departamento: " Montevideo ", nombreLugar: null,
    disponibilidad: true,
};
const tx = {
    execute: mocks.ejecutar,
    orm: { public: {
        PublicacionProductor: { where: () => ({ all: mocks.relaciones }), create: mocks.crearRelacion },
        Publicacion: { where: () => ({ select: () => ({ all: mocks.coincidencias }) }), create: mocks.crearPublicacion },
        Ubicacion: { create: mocks.crearUbicacion },
    } },
};

describe("altaPublicacionProductor", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mocks.productor.mockResolvedValue({ id: 1 });
        mocks.especie.mockResolvedValue({ id: 2, especieActiva: true });
        mocks.variedad.mockResolvedValue({ id: 3, especieId: 2, variedadActiva: true });
        mocks.presentacion.mockResolvedValue({ id: 4, variedadId: 3, presentacionActiva: true });
        mocks.categoria.mockResolvedValue({ id: 5, especieId: 2 });
        mocks.calibre.mockResolvedValue({ id: 6 });
        mocks.pais.mockResolvedValue({ id: 7 });
        mocks.relaciones.mockResolvedValue([]);
        mocks.coincidencias.mockResolvedValue([]);
        mocks.crearPublicacion.mockResolvedValue({ id: 42 });
        mocks.crearRelacion.mockResolvedValue({ id: 74 });
        mocks.transaccion.mockImplementation(async (operacion: (transaccion: typeof tx) => Promise<number>) => operacion(tx));
    });

    it("rechaza datos inválidos antes de consultar la base", async () => {
        expect(await altaPublicacionProductor(null)).toMatchObject({ esValido: false });
        expect(mocks.productor).not.toHaveBeenCalled();
        expect(mocks.transaccion).not.toHaveBeenCalled();
    });

    it.each([
        { consulta: "productor", valor: null },
        { consulta: "especie", valor: { id: 2, especieActiva: false } },
        { consulta: "variedad", valor: { id: 3, especieId: 9, variedadActiva: true } },
        { consulta: "variedad", valor: { id: 3, especieId: 2, variedadActiva: false } },
        { consulta: "presentacion", valor: { id: 4, variedadId: 9, presentacionActiva: true } },
        { consulta: "presentacion", valor: { id: 4, variedadId: 3, presentacionActiva: false } },
        { consulta: "categoria", valor: { id: 5, especieId: 9 } },
        { consulta: "categoria", valor: null },
        { consulta: "calibre", valor: null },
        { consulta: "pais", valor: null },
    ] as const)("rechaza una selección no disponible o incoherente: $consulta", async ({ consulta, valor }) => {
        mocks[consulta].mockResolvedValue(valor);
        expect(await altaPublicacionProductor(datos)).toEqual({ esValido: false, errores: ["La selección contiene datos que ya no están disponibles. Actualizá el formulario."] });
        expect(mocks.transaccion).not.toHaveBeenCalled();
    });

    it("guarda la publicación y su ubicación sin exigir precio ni fotografía", async () => {
        expect(await altaPublicacionProductor(datos)).toEqual({ esValido: true, id: 42, mensaje: "Publicación creada correctamente." });
        expect(mocks.ejecutar).toHaveBeenCalledExactlyOnceWith("bloqueo del productor");
        expect(mocks.ejecutar.mock.invocationCallOrder[0]).toBeLessThan(mocks.relaciones.mock.invocationCallOrder[0]);
        expect(mocks.crearPublicacion).toHaveBeenCalledExactlyOnceWith({ tipoPublicacion: "PRODUCTOR", publicacionDisponible: true, precio: null, foto: null, cantidadUnidades: null, presentacionId: 4, categoriaId: 5, calibreId: 6 });
        expect(mocks.crearRelacion).toHaveBeenCalledExactlyOnceWith({ publicacionId: 42, productorId: 1, paisId: 7 });
        expect(mocks.crearUbicacion).toHaveBeenCalledExactlyOnceWith({ publicacionId: 74, nombreUbicacion: "Montevideo", urlMaps: "https://www.google.com/maps?q=-34.9%2C-56.2" });
        expect(mocks.guardarImagen).not.toHaveBeenCalled();
    });

    it("conserva precio, cantidad, disponibilidad y nombre de retiro", async () => {
        mocks.categoria.mockResolvedValue({ id: 5, especieId: null });
        await altaPublicacionProductor({ ...datos, precio: " 1250 ", cantidadUnidades: 0, disponibilidad: false, nombreLugar: " Ruta 5 " });
        expect(mocks.crearPublicacion).toHaveBeenCalledWith(expect.objectContaining({ precio: "1250", cantidadUnidades: 0, publicacionDisponible: false }));
        expect(mocks.crearUbicacion).toHaveBeenCalledWith(expect.objectContaining({ nombreUbicacion: "Ruta 5" }));
    });

    it("avisa sobre un duplicado del mismo Productor antes de guardar", async () => {
        mocks.relaciones.mockResolvedValue([{ publicacionId: 20 }]);
        mocks.coincidencias.mockResolvedValue([{ id: 20 }]);
        expect(await altaPublicacionProductor(datos)).toEqual({ esValido: false, errores: ["Este Productor ya tiene una publicación con la misma especie, variedad, presentación, categoría y calibre."] });
        expect(mocks.crearPublicacion).not.toHaveBeenCalled();
        expect(mocks.crearUbicacion).not.toHaveBeenCalled();
    });

    it("permite una combinación que pertenece a otro Productor", async () => {
        mocks.relaciones.mockResolvedValue([{ publicacionId: 10 }]);
        mocks.coincidencias.mockResolvedValue([{ id: 20 }]);
        expect(await altaPublicacionProductor(datos)).toMatchObject({ esValido: true });
    });

    it("propaga un fallo de la transacción sin intentar guardar la fotografía", async () => {
        const error = new Error("Base no disponible");
        mocks.crearRelacion.mockRejectedValue(error);
        await expect(altaPublicacionProductor(datos)).rejects.toBe(error);
        expect(mocks.crearUbicacion).not.toHaveBeenCalled();
        expect(mocks.guardarImagen).not.toHaveBeenCalled();
    });

    it("asocia la fotografía después de registrar la publicación", async () => {
        mocks.guardarImagen.mockResolvedValue("/foto.png");
        await altaPublicacionProductor({ ...datos, fotografia: "data:image/png;base64,YQ==" });
        expect(mocks.guardarImagen).toHaveBeenCalledExactlyOnceWith(42, "data:image/png;base64,YQ==");
        expect(mocks.actualizarPublicacion).toHaveBeenCalledExactlyOnceWith({ foto: "/foto.png" });
        expect(mocks.crearUbicacion.mock.invocationCallOrder[0]).toBeLessThan(mocks.guardarImagen.mock.invocationCallOrder[0]);
    });

    it("retira la publicación si la fotografía no es válida", async () => {
        mocks.guardarImagen.mockRejectedValue(new ErrorImagenProductor("La imagen debe ser JPEG, PNG o WebP."));
        expect(await altaPublicacionProductor({ ...datos, fotografia: "data:image/png;base64,YQ==" })).toEqual({ esValido: false, errores: ["La imagen debe ser JPEG, PNG o WebP."] });
        expect(mocks.eliminarPublicacion).toHaveBeenCalledOnce();
        expect(mocks.eliminarImagen).toHaveBeenCalledExactlyOnceWith(null);
    });

    it("limpia la publicación y el archivo si falla la asociación de la foto", async () => {
        const error = new Error("No se pudo actualizar la foto");
        mocks.guardarImagen.mockResolvedValue("/foto.png");
        mocks.actualizarPublicacion.mockRejectedValue(error);
        await expect(altaPublicacionProductor({ ...datos, fotografia: "data:image/png;base64,YQ==" })).rejects.toBe(error);
        expect(mocks.eliminarPublicacion).toHaveBeenCalledOnce();
        expect(mocks.eliminarImagen).toHaveBeenCalledExactlyOnceWith("/foto.png");
    });
});
