// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    obtenerSesion: vi.fn(),
    obtenerOperadorAutorizado: vi.fn(),
    leerImagenPublicacion: vi.fn(),
    select: vi.fn(),
    where: vi.fn(),
    first: vi.fn(),
    buscarPublicacion: vi.fn(),
    seleccionarPublicacion: vi.fn(),
    filtrarPublicacion: vi.fn(),
}));

vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({
    obtenerSesion: mocks.obtenerSesion,
}));
vi.mock("@/modulos/usuarios/operadores/operador-actual", () => ({
    obtenerOperadorAutorizado: mocks.obtenerOperadorAutorizado,
}));
vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
    db: { orm: { public: {
        PublicacionOperador: { select: mocks.select },
        Publicacion: { select: mocks.seleccionarPublicacion },
    } } },
}));
vi.mock("@/modulos/publicaciones/operadores/imagenes-publicacion", async (importOriginal) => {
    const modulo = await importOriginal<typeof import("@/modulos/publicaciones/operadores/imagenes-publicacion")>();
    return { ...modulo, leerImagenPublicacion: mocks.leerImagenPublicacion };
});

import { ErrorAutorizacion } from "@/modulos/identidad-acceso/autorizacion/controles";
import { GET } from "./route";

const archivo = "12345678-1234-4123-8123-123456789abc.png";

function solicitarImagen(publicacionId = "15", nombreArchivo = archivo) {
    return GET(new Request(`http://localhost/api/publicaciones/imagenes/${publicacionId}/${nombreArchivo}`), {
        params: Promise.resolve({ publicacionId, archivo: nombreArchivo }),
    });
}

describe("GET /api/publicaciones/imagenes/[publicacionId]/[archivo]", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.obtenerSesion.mockResolvedValue(null);
        mocks.obtenerOperadorAutorizado.mockResolvedValue({ id: 3, usuarioId: 10, nombreFantasia: "Propio" });
        mocks.select.mockReturnValue({ where: mocks.where });
        mocks.where.mockReturnValue({ first: mocks.first });
        mocks.first.mockResolvedValue({ id: 25 });
        mocks.seleccionarPublicacion.mockReturnValue({ where: mocks.filtrarPublicacion });
        mocks.filtrarPublicacion.mockReturnValue({ first: mocks.buscarPublicacion });
        mocks.buscarPublicacion.mockResolvedValue({ id: 15 });
        mocks.leerImagenPublicacion.mockResolvedValue(Buffer.from([1, 2, 3]));
    });

    it.each([null, "ADMINISTRADOR", "PRODUCTOR"] as const)("conserva las imágenes públicas para %s y varía la caché por sesión", async (rol) => {
        mocks.obtenerSesion.mockResolvedValue(rol ? { usuarioId: 10, rol, expiraEn: 2000000000 } : null);

        const respuesta = await solicitarImagen();

        expect(respuesta.status).toBe(200);
        expect(respuesta.headers.get("Content-Type")).toBe("image/png");
        expect(respuesta.headers.get("Content-Length")).toBe("3");
        expect(respuesta.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
        expect(respuesta.headers.get("Vary")).toBe("Cookie");
        expect(Array.from(new Uint8Array(await respuesta.arrayBuffer()))).toEqual([1, 2, 3]);
        expect(mocks.leerImagenPublicacion).toHaveBeenCalledExactlyOnceWith(15, archivo);
        expect(mocks.obtenerOperadorAutorizado).not.toHaveBeenCalled();
        expect(mocks.select).not.toHaveBeenCalled();
    });

    it("permite al operador ver fotos propias y evita almacenarlas en caché compartida", async () => {
        mocks.obtenerSesion.mockResolvedValue({ usuarioId: 10, rol: "OPERADOR", expiraEn: 2000000000 });

        const respuesta = await solicitarImagen();

        expect(respuesta.status).toBe(200);
        expect(mocks.obtenerOperadorAutorizado).toHaveBeenCalledExactlyOnceWith();
        expect(mocks.select).toHaveBeenCalledExactlyOnceWith("id");
        expect(mocks.where).toHaveBeenCalledExactlyOnceWith({ publicacionId: 15, operadorId: 3 });
        expect(mocks.leerImagenPublicacion).toHaveBeenCalledExactlyOnceWith(15, archivo);
        expect(respuesta.headers.get("Cache-Control")).toBe("private, no-store");
        expect(respuesta.headers.get("Vary")).toBe("Cookie");
    });

    it("rechaza una foto ajena sin leer el archivo", async () => {
        mocks.obtenerSesion.mockResolvedValue({ usuarioId: 10, rol: "OPERADOR", expiraEn: 2000000000 });
        mocks.first.mockResolvedValue(null);

        const respuesta = await solicitarImagen();

        expect(respuesta.status).toBe(403);
        expect(await respuesta.text()).toBe("La publicación no corresponde al operador autenticado.");
        expect(respuesta.headers.get("Cache-Control")).toBe("private, no-store");
        expect(respuesta.headers.get("Vary")).toBe("Cookie");
        expect(mocks.leerImagenPublicacion).not.toHaveBeenCalled();
    });

    it.each([401, 403] as const)("devuelve %s si no puede validar el operador propio", async (status) => {
        mocks.obtenerSesion.mockResolvedValue({ usuarioId: 10, rol: "OPERADOR", expiraEn: 2000000000 });
        mocks.obtenerOperadorAutorizado.mockRejectedValue(new ErrorAutorizacion(status, "Acceso denegado."));

        const respuesta = await solicitarImagen();

        expect(respuesta.status).toBe(status);
        expect(await respuesta.text()).toBe("Acceso denegado.");
        expect(mocks.select).not.toHaveBeenCalled();
        expect(mocks.leerImagenPublicacion).not.toHaveBeenCalled();
    });

    it.each(["abc", "0", "-1", "1.5", "9007199254740992"])("rechaza un ID inválido: %s", async (id) => {
        const respuesta = await solicitarImagen(id);

        expect(respuesta.status).toBe(404);
        expect(mocks.obtenerSesion).not.toHaveBeenCalled();
        expect(mocks.leerImagenPublicacion).not.toHaveBeenCalled();
    });

    it("rechaza un nombre de archivo inválido antes de leer sesión o disco", async () => {
        const respuesta = await solicitarImagen("15", "foto.png");

        expect(respuesta.status).toBe(404);
        expect(mocks.obtenerSesion).not.toHaveBeenCalled();
        expect(mocks.leerImagenPublicacion).not.toHaveBeenCalled();
    });

    it("devuelve 404 cuando no existe el archivo", async () => {
        mocks.leerImagenPublicacion.mockRejectedValue(Object.assign(new Error("No existe"), { code: "ENOENT" }));

        const respuesta = await solicitarImagen();

        expect(respuesta.status).toBe(404);
        expect(await respuesta.text()).toBe("Imagen no encontrada");
    });

    it.each([null, "OPERADOR"] as const)("devuelve 404 para una publicación eliminada aunque quede su archivo, sesión %s", async (rol) => {
        mocks.obtenerSesion.mockResolvedValue(rol ? { usuarioId: 10, rol, expiraEn: 2000000000 } : null);
        mocks.buscarPublicacion.mockResolvedValue(null);

        const respuesta = await solicitarImagen();

        expect(respuesta.status).toBe(404);
        expect(respuesta.headers.get("Cache-Control")).toBe("private, no-store");
        expect(mocks.leerImagenPublicacion).not.toHaveBeenCalled();
    });

    it("propaga los demás errores de lectura", async () => {
        const error = new Error("Error de lectura");
        mocks.leerImagenPublicacion.mockRejectedValue(error);

        await expect(solicitarImagen()).rejects.toBe(error);
    });
});