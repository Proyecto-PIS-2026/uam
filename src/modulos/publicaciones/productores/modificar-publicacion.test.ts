import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DatosSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { modificarPublicacionProductor, obtenerPublicacionProductorEditable } from "./modificar-publicacion";

const mocks = vi.hoisted(() => {
    const consulta = () => ({ where: vi.fn().mockReturnThis(), include: vi.fn().mockReturnThis(), first: vi.fn(), update: vi.fn(), deleteAll: vi.fn(), create: vi.fn() });
    return { vinculo: consulta(), publicacion: consulta(), presentacion: consulta(), categoria: consulta(), calibre: consulta(), ubicacion: consulta(),
        transaction: vi.fn(), execute: vi.fn(), rawSql: vi.fn(), guardarImagen: vi.fn(), eliminarImagen: vi.fn() };
});
const orm = { public: { PublicacionProductor: mocks.vinculo, Publicacion: mocks.publicacion, Presentacion: mocks.presentacion,
    Categoria: mocks.categoria, Calibre: mocks.calibre, Ubicacion: mocks.ubicacion } };
vi.mock("@/infraestructura/persistencia/prisma/db", () => ({ db: { transaction: mocks.transaction, raw: { sql: mocks.rawSql } } }));
vi.mock("../operadores/imagenes-publicacion", () => ({
    ErrorImagenPublicacion: class extends Error {}, guardarImagenPublicacion: mocks.guardarImagen, eliminarImagenPublicacionGestionada: mocks.eliminarImagen,
}));

const sesion: DatosSesion = { usuarioId: 10, rol: "PRODUCTOR", expiraEn: 2000000000 };
const cambios = { precio: "125", foto: "foto-anterior.jpg", presentacionId: 8, categoriaId: 4, calibreId: 2,
    ubicaciones: [{ nombreUbicacion: "Quinta", urlMaps: "https://maps.google.com/?q=-34,-56" }] };

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
    mocks.presentacion.first.mockResolvedValue({ id: 8, variedadId: 7, presentacionActiva: true,
        variedad: { especieId: 6, variedadActiva: true, especie: { especieActiva: true } } });
    mocks.categoria.first.mockResolvedValue({ id: 4, especieId: 6 });
    mocks.calibre.first.mockResolvedValue({ id: 2 });
    mocks.publicacion.update.mockResolvedValue(undefined);
    mocks.ubicacion.deleteAll.mockResolvedValue(undefined);
    mocks.ubicacion.create.mockResolvedValue(undefined);
    mocks.guardarImagen.mockResolvedValue("data:image/png;base64,imagen");
    mocks.eliminarImagen.mockResolvedValue(undefined);
    mocks.rawSql.mockReturnValue({ returnsRow: () => ({ build: () => ({}) }) });
    mocks.transaction.mockImplementation((callback) => callback({ orm, execute: mocks.execute }));
});

describe("edición de publicaciones de productores", () => {
    it.each([0, -1, NaN, 1.5, 2147483648])("rechaza el identificador %s antes de consultar la base", async (id) => {
        await expect(modificarPublicacionProductor(sesion, id, cambios)).rejects.toMatchObject({ codigo: "DATOS_INVALIDOS" });
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("guarda solamente la publicación y ubicaciones elegidas, conservando los campos fuera de la edición", async () => {
        const resultado = await modificarPublicacionProductor(sesion, 12, { ...cambios, paisId: 99, cantidadUnidades: 999, disponible: false });
        expect(mocks.vinculo.where).toHaveBeenCalledWith({ id: 12 });
        expect(mocks.publicacion.where).toHaveBeenCalledExactlyOnceWith({ id: 20 });
        expect(mocks.publicacion.update).toHaveBeenCalledExactlyOnceWith({ precio: "125", foto: "foto-anterior.jpg", presentacionId: 8, categoriaId: 4, calibreId: 2 });
        expect(mocks.ubicacion.where).toHaveBeenCalledExactlyOnceWith({ publicacionId: 12 });
        expect(mocks.ubicacion.create).toHaveBeenCalledExactlyOnceWith({ ...cambios.ubicaciones[0], publicacionId: 12 });
        expect(resultado.publicacion).toMatchObject({ id: 20, publicacionProductorId: 12, cantidadUnidades: 10, publicacionDisponible: true, fecha: "2026-10-21T12:00:00Z" });
        expect(mocks.transaction).toHaveBeenCalledOnce();
        expect(mocks.execute.mock.invocationCallOrder[0]).toBeLessThan(mocks.vinculo.first.mock.invocationCallOrder[0]);
    });

    it("también actualiza la publicación base cuando sólo cambian las ubicaciones para renovar la fecha", async () => {
        await modificarPublicacionProductor(sesion, 12, { ...cambios, ubicaciones: [] });
        expect(mocks.publicacion.update).toHaveBeenCalledOnce();
        expect(mocks.ubicacion.deleteAll).toHaveBeenCalledOnce();
        expect(mocks.ubicacion.create).not.toHaveBeenCalled();
    });

    it("permite editar a un administrador con un usuario distinto del dueño", async () => {
        await expect(modificarPublicacionProductor({ ...sesion, usuarioId: 999, rol: "ADMINISTRADOR" }, 12, cambios)).resolves.toMatchObject({ productorId: 3 });
        expect(mocks.publicacion.update).toHaveBeenCalledOnce();
    });

    it.each([{ ...sesion, usuarioId: 999 }, { ...sesion, rol: "OPERADOR" as const }])("rechaza otro productor y otros roles sin escribir", async (sesionAjena) => {
        await expect(modificarPublicacionProductor(sesionAjena, 12, cambios)).rejects.toMatchObject({ status: 403 });
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

    it.each(["1.5", "-1", "1e3", "10000000000", "", 125, undefined])("rechaza precio inválido %s antes de escribir", async (precio) => {
        await expect(modificarPublicacionProductor(sesion, 12, { ...cambios, precio })).rejects.toMatchObject({ codigo: "DATOS_INVALIDOS" });
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it.each(["0", "9999999999", null])("acepta precio entero o sin informar %s", async (precio) => {
        await modificarPublicacionProductor(sesion, 12, { ...cambios, precio });
        expect(mocks.publicacion.update).toHaveBeenCalledWith(expect.objectContaining({ precio }));
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
        { variedadId: 999, presentacionActiva: true, variedad: { especieId: 6, variedadActiva: true, especie: { especieActiva: true } } },
        { variedadId: 7, presentacionActiva: false, variedad: { especieId: 6, variedadActiva: true, especie: { especieActiva: true } } },
        { variedadId: 7, presentacionActiva: true, variedad: { especieId: 6, variedadActiva: false, especie: { especieActiva: true } } },
        null,
    ])("impide cambiar la variedad o usar un catálogo inactivo", async (presentacion) => {
        mocks.presentacion.first.mockResolvedValue(presentacion);
        await expect(modificarPublicacionProductor(sesion, 12, cambios)).rejects.toMatchObject({ codigo: "DATOS_INVALIDOS" });
        expect(mocks.publicacion.update).not.toHaveBeenCalled();
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
        expect(mocks.eliminarImagen).toHaveBeenCalledExactlyOnceWith("data:image/png;base64,imagen", 20);
    });
});
