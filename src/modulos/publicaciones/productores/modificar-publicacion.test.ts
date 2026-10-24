import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DatosSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { modificarPublicacionProductor, obtenerPublicacionProductorEditable } from "./modificar-publicacion";

const mocks = vi.hoisted(() => {
    const consulta = () => ({ where: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), include: vi.fn().mockReturnThis(), first: vi.fn(), all: vi.fn(), update: vi.fn(), deleteAll: vi.fn(), create: vi.fn() });
    return { vinculo: consulta(), publicacion: consulta(), presentacion: consulta(), categoria: consulta(), calibre: consulta(), pais: consulta(), ubicacion: consulta(),
        transaction: vi.fn(), execute: vi.fn(), rawSql: vi.fn(), guardarImagen: vi.fn(), eliminarImagen: vi.fn() };
});
const orm = { public: { PublicacionProductor: mocks.vinculo, Publicacion: mocks.publicacion, Presentacion: mocks.presentacion,
    Categoria: mocks.categoria, Calibre: mocks.calibre, Pais: mocks.pais, Ubicacion: mocks.ubicacion } };
vi.mock("@/infraestructura/persistencia/prisma/db", () => ({ db: {
    transaction: mocks.transaction, raw: { sql: mocks.rawSql }, orm: { public: { Publicacion: mocks.publicacion } },
} }));
vi.mock("../operadores/imagenes-publicacion", () => ({
    ErrorImagenPublicacion: class extends Error {}, guardarImagenPublicacion: mocks.guardarImagen, eliminarImagenPublicacionGestionada: mocks.eliminarImagen,
}));

const sesion: DatosSesion = { usuarioId: 10, rol: "PRODUCTOR", expiraEn: 2000000000 };
const cambios = { precio: "125", foto: "foto-anterior.jpg", presentacionId: 8, categoriaId: 4, calibreId: 2,
    ubicaciones: [{ nombreUbicacion: "Quinta", urlMaps: "https://maps.google.com/?q=-34,-56" }] };
const fotoNueva = "/api/publicaciones/imagenes/20/12345678-1234-4234-8234-123456789abc.webp";

function relacion() {
    return { id: 12, publicacionId: 20, productorId: 3, paisId: 1, pais: { nombrePais: "Uruguay" },
        productor: { id: 3, usuarioId: 10, nombreFantasia: "Quinta Norte" },
        ubicaciones: [{ id: 40, ...cambios.ubicaciones[0] }],
        publicacion: { id: 20, tipoPublicacion: "PRODUCTOR", foto: "foto-anterior.jpg", precio: "125", cantidadUnidades: 10,
            fecha: { toString: () => "2026-10-21T12:00:00Z" }, publicacionActiva: true, publicacionDisponible: true,
            presentacion: { id: 8, variedadId: 7, nombrePresentacion: "Caja", variedad: { id: 7, nombreVariedad: "Gala",
                especie: { id: 6, nombreEspecie: "Manzana", fotoEspecie: null } } },
            categoria: { id: 4, nombreCategoria: "Primera" }, calibre: { id: 2, codigoCalibre: "M", nombreCalibre: "Mediano" } } };
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.vinculo.first.mockResolvedValue(relacion());
    mocks.vinculo.all.mockResolvedValue([]);
    mocks.presentacion.first.mockResolvedValue({ id: 8, variedadId: 7, presentacionActiva: true,
        variedad: { especieId: 6, variedadActiva: true, especie: { especieActiva: true } } });
    mocks.categoria.first.mockResolvedValue({ id: 4, especieId: 6 });
    mocks.calibre.first.mockResolvedValue({ id: 2 });
    mocks.pais.first.mockResolvedValue({ id: 2 });
    mocks.vinculo.update.mockResolvedValue(undefined);
    mocks.publicacion.update.mockResolvedValue(undefined);
    mocks.publicacion.first.mockResolvedValue(null);
    mocks.ubicacion.deleteAll.mockResolvedValue(undefined);
    mocks.ubicacion.create.mockResolvedValue(undefined);
    mocks.guardarImagen.mockResolvedValue(fotoNueva);
    mocks.eliminarImagen.mockResolvedValue(undefined);
    mocks.rawSql.mockReturnValue({ returnsRow: () => ({ build: () => ({}) }) });
    mocks.transaction.mockImplementation((callback) => callback({ orm, execute: mocks.execute }));
});

describe("edición de publicaciones de productores", () => {
    it.each([0, -1, NaN, 1.5, 2147483648])("rechaza el identificador %s antes de consultar la base", async (id) => {
        await expect(modificarPublicacionProductor(sesion, id, cambios)).rejects.toMatchObject({ codigo: "DATOS_INVALIDOS" });
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("conserva país, unidades y disponibilidad cuando el payload anterior los omite", async () => {
        const resultado = await modificarPublicacionProductor(sesion, 12, cambios);
        expect(mocks.vinculo.where).toHaveBeenCalledWith({ id: 12 });
        expect(mocks.publicacion.where).toHaveBeenCalledExactlyOnceWith({ id: 20 });
        expect(mocks.publicacion.update).toHaveBeenCalledExactlyOnceWith({ precio: "125", foto: "foto-anterior.jpg", presentacionId: 8, categoriaId: 4, calibreId: 2 });
        expect(mocks.ubicacion.where).toHaveBeenCalledExactlyOnceWith({ publicacionId: 12 });
        expect(mocks.ubicacion.create).toHaveBeenCalledExactlyOnceWith({ ...cambios.ubicaciones[0], publicacionId: 12 });
        expect(resultado.publicacion).toMatchObject({ id: 20, publicacionProductorId: 12, paisId: 1, cantidadUnidades: 10, publicacionDisponible: true, fecha: "2026-10-21T12:00:00Z" });
        expect(mocks.pais.first).not.toHaveBeenCalled();
        expect(mocks.vinculo.update).not.toHaveBeenCalled();
        expect(mocks.transaction).toHaveBeenCalledOnce();
        expect(mocks.rawSql.mock.calls[0][0].join("?")).toContain("pg_advisory_xact_lock(1720, ?)");
        expect(mocks.rawSql.mock.calls[0][1]).toBe(3);
        expect(mocks.rawSql.mock.calls[1][0].join("?")).toContain('WHERE id = ? FOR UPDATE');
        expect(mocks.execute.mock.invocationCallOrder[1]).toBeLessThan(mocks.vinculo.first.mock.invocationCallOrder[1]);
    });

    it("persiste país, unidades y disponibilidad y devuelve los datos releídos del servidor", async () => {
        const anterior = relacion();
        mocks.vinculo.first.mockResolvedValueOnce(anterior).mockResolvedValueOnce(anterior).mockResolvedValueOnce({
            ...anterior, paisId: 2, pais: { nombrePais: "Argentina" },
            publicacion: { ...anterior.publicacion, cantidadUnidades: 0, publicacionDisponible: false },
        });

        const resultado = await modificarPublicacionProductor(sesion, 12, { ...cambios, paisId: 2, cantidadUnidades: 0, disponible: false });

        expect(mocks.pais.where).toHaveBeenCalledExactlyOnceWith({ id: 2 });
        expect(mocks.vinculo.update).toHaveBeenCalledExactlyOnceWith({ paisId: 2 });
        expect(mocks.vinculo.where.mock.calls.at(-2)?.[0]).toEqual({ id: 12 });
        expect(mocks.publicacion.update).toHaveBeenCalledExactlyOnceWith({
            precio: "125", foto: "foto-anterior.jpg", presentacionId: 8, categoriaId: 4, calibreId: 2,
            cantidadUnidades: 0, publicacionDisponible: false,
        });
        expect(resultado.publicacion).toMatchObject({ paisId: 2, pais: "Argentina", cantidadUnidades: 0, publicacionDisponible: false });
    });

    it.each([null, 0, 2147483647])("acepta unidades %s sin cambiar país o disponibilidad omitidos", async (cantidadUnidades) => {
        await modificarPublicacionProductor(sesion, 12, { ...cambios, cantidadUnidades });

        const escritura = mocks.publicacion.update.mock.calls[0][0];
        expect(escritura).toMatchObject({ cantidadUnidades });
        expect(escritura).not.toHaveProperty("publicacionDisponible");
        expect(mocks.vinculo.update).not.toHaveBeenCalled();
    });

    it.each([false, true])("acepta disponible=%s sin modificar las unidades omitidas", async (disponible) => {
        await modificarPublicacionProductor(sesion, 12, { ...cambios, disponible });

        const escritura = mocks.publicacion.update.mock.calls[0][0];
        expect(escritura).toMatchObject({ publicacionDisponible: disponible });
        expect(escritura).not.toHaveProperty("cantidadUnidades");
        expect(mocks.vinculo.update).not.toHaveBeenCalled();
    });

    it.each([
        { paisId: 0 }, { paisId: -1 }, { paisId: 1.5 }, { paisId: 2147483648 }, { paisId: "2" }, { paisId: null },
        { cantidadUnidades: -1 }, { cantidadUnidades: 1.5 }, { cantidadUnidades: 2147483648 }, { cantidadUnidades: "10" }, { cantidadUnidades: NaN }, { cantidadUnidades: true },
        { disponible: null }, { disponible: 0 }, { disponible: "false" },
    ])("rechaza los campos nuevos malformados antes de iniciar la transacción: %j", async (dato) => {
        await expect(modificarPublicacionProductor(sesion, 12, { ...cambios, ...dato })).rejects.toMatchObject({ codigo: "DATOS_INVALIDOS" });
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("rechaza un país inexistente antes de escribir o guardar imágenes", async () => {
        mocks.pais.first.mockResolvedValue(null);

        await expect(modificarPublicacionProductor(sesion, 12, { ...cambios, paisId: 99 }, new File(["foto"], "foto.png", { type: "image/png" })))
            .rejects.toMatchObject({ codigo: "DATOS_INVALIDOS", message: "El país no existe." });
        expect(mocks.pais.where).toHaveBeenCalledWith({ id: 99 });
        expect(mocks.vinculo.update).not.toHaveBeenCalled();
        expect(mocks.publicacion.update).not.toHaveBeenCalled();
        expect(mocks.ubicacion.deleteAll).not.toHaveBeenCalled();
        expect(mocks.guardarImagen).not.toHaveBeenCalled();
    });

    it("también actualiza la publicación base cuando sólo cambian las ubicaciones para renovar la fecha", async () => {
        await modificarPublicacionProductor(sesion, 12, { ...cambios, ubicaciones: [] });
        expect(mocks.publicacion.update).toHaveBeenCalledOnce();
        expect(mocks.ubicacion.deleteAll).toHaveBeenCalledOnce();
        expect(mocks.ubicacion.create).not.toHaveBeenCalled();
    });

    it("permite editar a un administrador con un usuario distinto del dueño", async () => {
        await expect(modificarPublicacionProductor({ ...sesion, usuarioId: 999, rol: "ADMINISTRADOR" }, 12, { ...cambios, paisId: 2, cantidadUnidades: 0, disponible: false })).resolves.toMatchObject({ productorId: 3 });
        expect(mocks.publicacion.update).toHaveBeenCalledOnce();
        expect(mocks.vinculo.update).toHaveBeenCalledExactlyOnceWith({ paisId: 2 });
    });

    it.each([{ ...sesion, usuarioId: 999 }, { ...sesion, rol: "OPERADOR" as const }])("rechaza otro productor y otros roles sin escribir", async (sesionAjena) => {
        await expect(modificarPublicacionProductor(sesionAjena, 12, { ...cambios, paisId: 2, cantidadUnidades: 0, disponible: false })).rejects.toMatchObject({ status: 403 });
        expect(mocks.vinculo.update).not.toHaveBeenCalled();
        expect(mocks.publicacion.update).not.toHaveBeenCalled();
        expect(mocks.ubicacion.deleteAll).not.toHaveBeenCalled();
    });

    it("protege también la consulta de opciones de una publicación ajena", async () => {
        // La dependencia de DB se pasa explícitamente para probar el control sin consultar otra fuente.
        await expect(obtenerPublicacionProductorEditable({ ...sesion, usuarioId: 999 }, 12, { orm } as unknown as Parameters<typeof obtenerPublicacionProductorEditable>[2]))
            .rejects.toMatchObject({ status: 403 });
    });

    it.each([null, { ...relacion(), publicacion: { ...relacion().publicacion, tipoPublicacion: "OPERADOR" } }])("rechaza una publicación ausente o de operador", async (valor) => {
        mocks.vinculo.first.mockResolvedValue(valor);
        await expect(modificarPublicacionProductor(sesion, 12, cambios)).rejects.toMatchObject({ codigo: "NO_ENCONTRADA" });
        expect(mocks.publicacion.update).not.toHaveBeenCalled();
    });

    it.each(["0", "000", "1.5", "-1", "1e3", "10000000000", 125, undefined])("rechaza precio inválido %s antes de escribir", async (precio) => {
        await expect(modificarPublicacionProductor(sesion, 12, { ...cambios, precio })).rejects.toMatchObject({ codigo: "DATOS_INVALIDOS" });
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it.each(["1", "9999999999", null])("acepta precio entero o sin informar %s", async (precio) => {
        await modificarPublicacionProductor(sesion, 12, { ...cambios, precio });
        expect(mocks.publicacion.update).toHaveBeenCalledWith(expect.objectContaining({ precio }));
    });

    it.each(["", "   "])("guarda null al vaciar el precio con %j", async (precio) => {
        await modificarPublicacionProductor(sesion, 12, { ...cambios, precio });
        expect(mocks.publicacion.update).toHaveBeenCalledWith(expect.objectContaining({ precio: null }));
    });

    it.each(["https://example.com/maps/123", "javascript:alert(1)", "https://www.google.com.ejemplo.com/maps/123", "https://www.google.com/search?q=maps", "https://maps.app.goo.gl@ejemplo.com/abc"])("rechaza enlaces ajenos a Maps: %s", async (urlMaps) => {
        await expect(modificarPublicacionProductor(sesion, 12, { ...cambios, ubicaciones: [{ nombreUbicacion: "Quinta", urlMaps }] }))
            .rejects.toMatchObject({ codigo: "DATOS_INVALIDOS" });
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it.each(["https://maps.app.goo.gl/abc", "https://goo.gl/maps/abc", "https://maps.google.com/?q=-34,-56", "https://www.google.com/maps/place/Quinta"])("acepta un enlace Google Maps %s", async (urlMaps) => {
        await modificarPublicacionProductor(sesion, 12, { ...cambios, ubicaciones: [{ nombreUbicacion: " Quinta ", urlMaps }] });
        expect(mocks.ubicacion.create).toHaveBeenCalledWith({ nombreUbicacion: "Quinta", urlMaps, publicacionId: 12 });
    });

    it.each([
        { presentacionId: 0 }, { categoriaId: "4" }, { calibreId: 1.1 }, { calibreId: 2147483648 }, { foto: 45 }, { ubicaciones: null },
        { ubicaciones: [{ nombreUbicacion: " ", urlMaps: "https://maps.google.com" }] },
    ])("rechaza datos malformados %j", async (dato) => {
        await expect(modificarPublicacionProductor(sesion, 12, { ...cambios, ...dato })).rejects.toMatchObject({ codigo: "DATOS_INVALIDOS" });
    });

    it.each([
        { caso: "otra variedad de la misma especie", especieId: 6, categoriaEspecieId: 6 },
        { caso: "otra especie con su categoría", especieId: 9, categoriaEspecieId: 9 },
        { caso: "otra especie con categoría general", especieId: 9, categoriaEspecieId: null },
    ])("permite cambiar a $caso", async ({ especieId, categoriaEspecieId }) => {
        mocks.presentacion.first.mockResolvedValue({ id: 80, variedadId: 70, presentacionActiva: true,
            variedad: { especieId, variedadActiva: true, especie: { especieActiva: true } } });
        mocks.categoria.first.mockResolvedValue({ id: 40, especieId: categoriaEspecieId });

        await modificarPublicacionProductor(sesion, 12, { ...cambios, presentacionId: 80, categoriaId: 40 });

        expect(mocks.presentacion.where).toHaveBeenCalledWith({ id: 80 });
        expect(mocks.publicacion.update).toHaveBeenCalledWith(expect.objectContaining({ presentacionId: 80, categoriaId: 40 }));
    });

    it.each([
        { variedadId: 7, presentacionActiva: false, variedad: { especieId: 6, variedadActiva: true, especie: { especieActiva: true } } },
        { variedadId: 7, presentacionActiva: true, variedad: { especieId: 6, variedadActiva: false, especie: { especieActiva: true } } },
        { variedadId: 70, presentacionActiva: true, variedad: { especieId: 9, variedadActiva: true, especie: { especieActiva: false } } },
        null,
    ])("rechaza una presentación inexistente o un catálogo inactivo", async (presentacion) => {
        mocks.presentacion.first.mockResolvedValue(presentacion);
        await expect(modificarPublicacionProductor(sesion, 12, cambios)).rejects.toMatchObject({ codigo: "DATOS_INVALIDOS" });
        expect(mocks.publicacion.update).not.toHaveBeenCalled();
    });

    it("rechaza conservar una categoría de la especie anterior al cambiar de especie", async () => {
        mocks.presentacion.first.mockResolvedValue({ id: 80, variedadId: 70, presentacionActiva: true,
            variedad: { especieId: 9, variedadActiva: true, especie: { especieActiva: true } } });

        await expect(modificarPublicacionProductor(sesion, 12, { ...cambios, presentacionId: 80, paisId: 2, cantidadUnidades: 0, disponible: false }))
            .rejects.toMatchObject({ codigo: "DATOS_INVALIDOS", message: "La categoría no corresponde a la especie de la publicación." });
        expect(mocks.publicacion.update).not.toHaveBeenCalled();
        expect(mocks.vinculo.update).not.toHaveBeenCalled();
        expect(mocks.ubicacion.deleteAll).not.toHaveBeenCalled();
    });

    it("rechaza categorías de otra especie y calibres inexistentes", async () => {
        mocks.categoria.first.mockResolvedValue({ id: 4, especieId: 99 });
        await expect(modificarPublicacionProductor(sesion, 12, cambios)).rejects.toMatchObject({ codigo: "DATOS_INVALIDOS" });
        mocks.categoria.first.mockResolvedValue({ id: 4, especieId: null });
        mocks.calibre.first.mockResolvedValue(null);
        await expect(modificarPublicacionProductor(sesion, 12, cambios)).rejects.toMatchObject({ codigo: "DATOS_INVALIDOS" });
        expect(mocks.publicacion.update).not.toHaveBeenCalled();
    });

    it("conserva la foto vigente ante una URL vieja o una URL externa enviada", async () => {
        await modificarPublicacionProductor(sesion, 12, { ...cambios, foto: "https://otra-foto.com/externa.jpg" });
        expect(mocks.publicacion.update).toHaveBeenCalledWith(expect.objectContaining({ foto: "foto-anterior.jpg" }));
        expect(mocks.eliminarImagen).not.toHaveBeenCalled();
    });

    it("rechaza convertir la publicación en un duplicado de otra del mismo productor incluso al cambiar de especie", async () => {
        mocks.presentacion.first.mockResolvedValue({ id: 80, variedadId: 70, presentacionActiva: true,
            variedad: { especieId: 9, variedadActiva: true, especie: { especieActiva: true } } });
        mocks.categoria.first.mockResolvedValue({ id: 40, especieId: 9 });
        mocks.vinculo.all.mockResolvedValue([{ id: 13, publicacion: { presentacionId: 80, categoriaId: 40, calibreId: 2 } }]);

        await expect(modificarPublicacionProductor(sesion, 12, { ...cambios, presentacionId: 80, categoriaId: 40, paisId: 2, cantidadUnidades: 0, disponible: false })).rejects.toMatchObject({
            codigo: "DATOS_INVALIDOS", message: expect.stringContaining("ya tiene una publicación"),
        });
        expect(mocks.vinculo.where).toHaveBeenCalledWith({ productorId: 3 });
        expect(mocks.publicacion.update).not.toHaveBeenCalled();
        expect(mocks.vinculo.update).not.toHaveBeenCalled();
        expect(mocks.ubicacion.deleteAll).not.toHaveBeenCalled();
        expect(mocks.guardarImagen).not.toHaveBeenCalled();
    });

    it("no considera duplicada la propia publicación que está editando", async () => {
        mocks.vinculo.all.mockResolvedValue([{ id: 12, publicacion: { presentacionId: 8, categoriaId: 4, calibreId: 2 } }]);

        await expect(modificarPublicacionProductor(sesion, 12, cambios)).resolves.toMatchObject({ productorId: 3 });
    });

    it("quita la fotografía sólo con null y limpia la anterior tras guardar", async () => {
        await modificarPublicacionProductor(sesion, 12, { ...cambios, foto: null });
        expect(mocks.publicacion.update).toHaveBeenCalledWith(expect.objectContaining({ foto: null }));
        expect(mocks.eliminarImagen).toHaveBeenCalledExactlyOnceWith("foto-anterior.jpg", 20);
    });

    it("reemplaza la foto con un archivo validado y descarta el nuevo si falla la transacción", async () => {
        mocks.ubicacion.create.mockRejectedValueOnce(new Error("Error DB"));
        const archivo = new File(["imagen"], "foto.png", { type: "image/png" });
        await expect(modificarPublicacionProductor(sesion, 12, cambios, archivo)).rejects.toThrow("Error DB");
        expect(mocks.guardarImagen).toHaveBeenCalledExactlyOnceWith(20, archivo);
        expect(mocks.eliminarImagen).toHaveBeenCalledExactlyOnceWith(fotoNueva, 20);
    });

    it("conserva la imagen nueva si el commit fue confirmado aunque se perdió su respuesta", async () => {
        mocks.transaction.mockImplementation(async (callback) => {
            await callback({ orm, execute: mocks.execute });
            throw new Error("Se perdió la respuesta del commit");
        });
        mocks.publicacion.first.mockResolvedValue({ foto: fotoNueva });

        await expect(modificarPublicacionProductor(sesion, 12, cambios, new File(["imagen"], "foto.png")))
            .rejects.toThrow("Se perdió la respuesta del commit");

        expect(mocks.publicacion.update).toHaveBeenCalledWith(expect.objectContaining({ foto: fotoNueva }));
        expect(mocks.eliminarImagen).not.toHaveBeenCalled();
    });
});
