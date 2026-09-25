import { File as NodeFile } from "node:buffer";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../../../app/api/publicaciones/imagenes/[publicacionId]/[archivo]/route";
import {
    eliminarImagenPublicacionGestionada,
    guardarImagenPublicacion,
    leerImagenPublicacion,
} from "./imagenes-publicacion";

const PNG_PEQUENO = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l8sAAAAASUVORK5CYII=",
    "base64",
);

function archivo(contenido: Buffer): File {
    return new NodeFile([contenido], "nombre-ignorado.txt", { type: "text/plain" }) as unknown as File;
}

describe("imágenes de publicaciones", () => {
    let directorioTemporal: string;

    beforeEach(async () => {
        directorioTemporal = await mkdtemp(join(tmpdir(), "uam-imagen-publicacion-"));
        vi.spyOn(process, "cwd").mockReturnValue(directorioTemporal);
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        if (directorioTemporal && resolve(directorioTemporal).startsWith(resolve(tmpdir()))) {
            await rm(directorioTemporal, { recursive: true, force: true });
        }
    });

    it("guarda la foto bajo el ID real de la publicación y permite recuperarla", async () => {
        const url = await guardarImagenPublicacion(42, archivo(PNG_PEQUENO));
        const nombreArchivo = url.split("/").at(-1)!;

        expect(url).toMatch(/^\/api\/publicaciones\/imagenes\/42\/[\da-f-]+\.png$/);
        expect(await readFile(join(directorioTemporal, "storage", "publicaciones", "42", nombreArchivo)))
            .toEqual(PNG_PEQUENO);
        expect(await leerImagenPublicacion(42, nombreArchivo)).toEqual(PNG_PEQUENO);

        const respuesta = await GET(new Request(`http://localhost${url}`), {
            params: Promise.resolve({ publicacionId: "42", archivo: nombreArchivo }),
        });
        expect(respuesta.status).toBe(200);
        expect(respuesta.headers.get("Content-Type")).toBe("image/png");
        expect(Buffer.from(await respuesta.arrayBuffer())).toEqual(PNG_PEQUENO);

        await eliminarImagenPublicacionGestionada(url, 42);
        await expect(leerImagenPublicacion(42, nombreArchivo)).rejects.toMatchObject({ code: "ENOENT" });
    });

    it("rechaza archivos inválidos y rutas que intentan salir de su carpeta", async () => {
        await expect(guardarImagenPublicacion(42, archivo(Buffer.from("no es una imagen"))))
            .rejects.toThrow("JPEG, PNG o WebP");
        await expect(guardarImagenPublicacion(42, archivo(Buffer.alloc(5 * 1024 * 1024 + 1))))
            .rejects.toThrow("5 MB");
        await expect(leerImagenPublicacion(42, "../../otro-archivo.png"))
            .rejects.toThrow("nombre de la imagen");
    });

    it("responde 404 si el ID, nombre o archivo no existen", async () => {
        const url = new Request("http://localhost/api/publicaciones/imagenes/42/imagen.png");
        const idInvalido = await GET(url, { params: Promise.resolve({ publicacionId: "../../42", archivo: "imagen.png" }) });
        const nombreInvalido = await GET(url, { params: Promise.resolve({ publicacionId: "42", archivo: "../imagen.png" }) });
        const inexistente = await GET(url, { params: Promise.resolve({ publicacionId: "42", archivo: "12345678-1234-4234-8234-123456789abc.jpg" }) });

        expect(idInvalido.status).toBe(404);
        expect(nombreInvalido.status).toBe(404);
        expect(inexistente.status).toBe(404);
    });
});
