// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorImagenNoEncontrada } from "@/infraestructura/imagenes/almacenamiento-imagenes";

const mocks = vi.hoisted(() => ({
    puedeLeerImagen: vi.fn(),
    leer: vi.fn(),
}));

vi.mock("@/infraestructura/imagenes/acceso-imagenes", () => ({
    puedeLeerImagen: mocks.puedeLeerImagen,
}));
vi.mock("@/infraestructura/imagenes/imagenes", () => ({
    imagenes: { leer: mocks.leer },
}));

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
        mocks.puedeLeerImagen.mockResolvedValue(true);
        mocks.leer.mockResolvedValue(Buffer.from([1, 2, 3]));
    });

    it.each([
        ["png", "image/png"],
        ["jpg", "image/jpeg"],
        ["webp", "image/webp"],
    ])("devuelve una imagen %s autorizada sin almacenarla en caché compartida", async (extension, tipo) => {
        const nombreArchivo = archivo.replace(".png", `.${extension}`);

        const respuesta = await solicitarImagen("15", nombreArchivo);

        expect(respuesta.status).toBe(200);
        expect(respuesta.headers.get("Content-Type")).toBe(tipo);
        expect(respuesta.headers.get("Content-Length")).toBe("3");
        expect(respuesta.headers.get("Cache-Control")).toBe("private, no-store");
        expect(respuesta.headers.get("Vary")).toBe("Cookie");
        expect(respuesta.headers.get("X-Content-Type-Options")).toBe("nosniff");
        expect(Array.from(new Uint8Array(await respuesta.arrayBuffer()))).toEqual([1, 2, 3]);
        expect(mocks.puedeLeerImagen).toHaveBeenCalledExactlyOnceWith("publicaciones", 15, nombreArchivo);
        expect(mocks.leer).toHaveBeenCalledExactlyOnceWith("publicaciones", 15, nombreArchivo);
    });

    it("devuelve 404 sin consultar los bytes cuando no se autoriza la foto solicitada", async () => {
        mocks.puedeLeerImagen.mockResolvedValue(false);

        const respuesta = await solicitarImagen();

        expect(respuesta.status).toBe(404);
        expect(await respuesta.text()).toBe("Imagen no encontrada");
        expect(respuesta.headers.get("Cache-Control")).toBe("private, no-store");
        expect(respuesta.headers.get("Vary")).toBe("Cookie");
        expect(mocks.leer).not.toHaveBeenCalled();
    });

    it.each(["abc", "0", "-1", "1.5", "9007199254740992"])("rechaza un ID inválido, %s", async (id) => {
        const respuesta = await solicitarImagen(id);

        expect(respuesta.status).toBe(404);
        expect(mocks.puedeLeerImagen).not.toHaveBeenCalled();
        expect(mocks.leer).not.toHaveBeenCalled();
    });

    it.each(["foto.png", "../foto.png", archivo.replace(".png", ".svg")])(
        "rechaza un archivo inválido antes de consultar permisos o almacenamiento, %s", async (nombreArchivo) => {
            const respuesta = await solicitarImagen("15", nombreArchivo);

            expect(respuesta.status).toBe(404);
            expect(mocks.puedeLeerImagen).not.toHaveBeenCalled();
            expect(mocks.leer).not.toHaveBeenCalled();
        },
    );

    it("devuelve 404 cuando no existe la imagen autorizada en PostgreSQL", async () => {
        mocks.leer.mockRejectedValue(new ErrorImagenNoEncontrada());

        const respuesta = await solicitarImagen();

        expect(respuesta.status).toBe(404);
        expect(await respuesta.text()).toBe("Imagen no encontrada");
    });

    it("propaga un fallo de PostgreSQL sin convertirlo en imagen no encontrada", async () => {
        const error = new Error("Error de conexión a PostgreSQL");
        mocks.leer.mockRejectedValue(error);

        await expect(solicitarImagen()).rejects.toBe(error);
    });

    it("no lee la imagen cuando falla la consulta de permisos", async () => {
        const error = new Error("Consulta de permisos fallida");
        mocks.puedeLeerImagen.mockRejectedValue(error);

        await expect(solicitarImagen()).rejects.toBe(error);
        expect(mocks.leer).not.toHaveBeenCalled();
    });
});
