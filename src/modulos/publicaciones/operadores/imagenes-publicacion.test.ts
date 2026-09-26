import { File as NodeFile } from "node:buffer";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../../../app/api/publicaciones/imagenes/[publicacionId]/[archivo]/route";
import {
    ErrorImagenPublicacion,
    eliminarImagenPublicacionGestionada,
    guardarImagenPublicacion,
    leerImagenPublicacion,
    tipoContenidoImagen,
} from "./imagenes-publicacion";

const sistemaArchivos = vi.hoisted(() => ({
    mkdir: vi.fn<(ruta: string, opciones: { recursive: boolean }) => Promise<void>>(),
    readFile: vi.fn<(ruta: string) => Promise<Buffer>>(),
    unlink: vi.fn<(ruta: string) => Promise<void>>(),
    writeFile: vi.fn<(ruta: string, contenido: Buffer, opciones: { flag: string }) => Promise<void>>(),
}));

const generarUUID = vi.hoisted(() => vi.fn(() => "12345678-1234-4234-8234-123456789abc"));

vi.mock("node:fs/promises", () => ({ ...sistemaArchivos, default: sistemaArchivos }));
vi.mock("node:crypto", () => ({ randomUUID: generarUUID, default: { randomUUID: generarUUID } }));

const UUID = "12345678-1234-4234-8234-123456789abc";
const NOMBRE_PNG = `${UUID}.png`;
const URL_PNG = `/api/publicaciones/imagenes/42/${NOMBRE_PNG}`;
const TAMANO_MAXIMO = 5 * 1024 * 1024;
const PNG_PEQUENO = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l8sAAAAASUVORK5CYII=",
    "base64",
);
const JPEG_PEQUENO = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xd9]);
const WEBP_PEQUENO = Buffer.from("RIFF0000WEBP", "ascii");
const IDS_INVALIDOS = [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1];
const NOMBRES_INVALIDOS = [
    "imagen.png",
    `../${NOMBRE_PNG}`,
    `../../${NOMBRE_PNG}`,
    `${UUID}.svg`,
    `${NOMBRE_PNG}?descargar=1`,
    `${NOMBRE_PNG}/otro`,
    `..%2F${NOMBRE_PNG}`,
];

function archivo(contenido: Buffer, tamanoDeclarado?: number): File {
    const foto = new NodeFile([contenido], "nombre-ignorado.txt", { type: "text/plain" });
    if (tamanoDeclarado !== undefined) {
        Object.defineProperty(foto, "size", { value: tamanoDeclarado });
    }
    return foto as unknown as File;
}

function rutaGuardada(nombreArchivo = NOMBRE_PNG): string {
    return join(process.cwd(), "storage", "publicaciones", "42", nombreArchivo);
}

function errorArchivo(codigo: string): NodeJS.ErrnoException {
    return Object.assign(new Error("Error del sistema de archivos"), { code: codigo });
}

beforeEach(() => {
    vi.resetAllMocks();
    generarUUID.mockReturnValue(UUID);
    sistemaArchivos.mkdir.mockResolvedValue(undefined);
    sistemaArchivos.writeFile.mockResolvedValue(undefined);
    sistemaArchivos.readFile.mockResolvedValue(PNG_PEQUENO);
    sistemaArchivos.unlink.mockResolvedValue(undefined);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("guardarImagenPublicacion", () => {
    it.each([
        { formato: "JPEG", extension: "jpg", contenido: JPEG_PEQUENO },
        { formato: "PNG", extension: "png", contenido: PNG_PEQUENO },
        { formato: "WebP", extension: "webp", contenido: WEBP_PEQUENO },
    ])("guarda $formato bajo el ID real y reconoce el formato sin confiar en el nombre o MIME", async ({ extension, contenido }) => {
        const nombreArchivo = `${UUID}.${extension}`;

        const url = await guardarImagenPublicacion(42, archivo(contenido));

        expect(url).toBe(`/api/publicaciones/imagenes/42/${nombreArchivo}`);
        expect(sistemaArchivos.mkdir).toHaveBeenCalledWith(
            join(process.cwd(), "storage", "publicaciones", "42"),
            { recursive: true },
        );
        expect(sistemaArchivos.writeFile).toHaveBeenCalledExactlyOnceWith(rutaGuardada(nombreArchivo), contenido, { flag: "wx" });
    });

    it.each(IDS_INVALIDOS)("rechaza el ID inválido %s antes de guardar", async (id) => {
        await expect(guardarImagenPublicacion(id, archivo(PNG_PEQUENO))).rejects.toBeInstanceOf(ErrorImagenPublicacion);
        expect(sistemaArchivos.mkdir).not.toHaveBeenCalled();
        expect(sistemaArchivos.writeFile).not.toHaveBeenCalled();
    });

    it.each([
        { caso: "archivo ausente", crear: () => null as unknown as File },
        { caso: "archivo sin arrayBuffer", crear: () => ({ size: 10 }) as File },
        { caso: "archivo vacío", crear: () => archivo(Buffer.alloc(0)) },
        { caso: "tamaño declarado mayor a 5 MB", crear: () => archivo(PNG_PEQUENO, TAMANO_MAXIMO + 1) },
        { caso: "contenido vacío aunque declare tamaño válido", crear: () => archivo(Buffer.alloc(0), 1) },
        { caso: "contenido mayor a 5 MB aunque declare tamaño válido", crear: () => archivo(Buffer.alloc(TAMANO_MAXIMO + 1), 1) },
    ])("rechaza $caso sin escribir archivos", async ({ crear }) => {
        await expect(guardarImagenPublicacion(42, crear())).rejects.toThrow("5 MB");
        expect(sistemaArchivos.mkdir).not.toHaveBeenCalled();
        expect(sistemaArchivos.writeFile).not.toHaveBeenCalled();
    });

    it("acepta una imagen de exactamente 5 MB", async () => {
        const contenido = Buffer.alloc(TAMANO_MAXIMO);
        PNG_PEQUENO.copy(contenido);

        await expect(guardarImagenPublicacion(42, archivo(contenido))).resolves.toBe(URL_PNG);
        expect(sistemaArchivos.writeFile).toHaveBeenCalledTimes(1);
        const [ruta, guardado, opciones] = sistemaArchivos.writeFile.mock.calls[0];
        expect(ruta).toBe(rutaGuardada());
        expect(guardado.length).toBe(TAMANO_MAXIMO);
        expect(guardado.equals(contenido)).toBe(true);
        expect(opciones).toEqual({ flag: "wx" });
    });

    it.each([
        { caso: "texto", contenido: Buffer.from("no es una imagen") },
        { caso: "PNG con firma incompleta", contenido: PNG_PEQUENO.subarray(0, 7) },
        { caso: "JPEG sin terminación", contenido: Buffer.from([0xff, 0xd8, 0xff, 0xe0]) },
        { caso: "RIFF de otro formato", contenido: Buffer.from("RIFF0000WAVE") },
    ])("rechaza $caso sin guardar", async ({ contenido }) => {
        await expect(guardarImagenPublicacion(42, archivo(contenido))).rejects.toThrow("JPEG, PNG o WebP");
        expect(sistemaArchivos.mkdir).not.toHaveBeenCalled();
        expect(sistemaArchivos.writeFile).not.toHaveBeenCalled();
    });

    it("propaga el error al leer el archivo de entrada", async () => {
        const foto = archivo(PNG_PEQUENO);
        const error = new Error("No se pudo leer la foto");
        vi.spyOn(foto, "arrayBuffer").mockRejectedValue(error);

        await expect(guardarImagenPublicacion(42, foto)).rejects.toBe(error);
        expect(sistemaArchivos.mkdir).not.toHaveBeenCalled();
        expect(sistemaArchivos.writeFile).not.toHaveBeenCalled();
    });

    it("propaga un error al crear la carpeta y no intenta escribir", async () => {
        const error = errorArchivo("EACCES");
        sistemaArchivos.mkdir.mockRejectedValueOnce(error);

        await expect(guardarImagenPublicacion(42, archivo(PNG_PEQUENO))).rejects.toBe(error);
        expect(sistemaArchivos.writeFile).not.toHaveBeenCalled();
    });

    it("propaga el error al escribir y no devuelve una URL de éxito", async () => {
        const error = errorArchivo("ENOSPC");
        sistemaArchivos.writeFile.mockRejectedValueOnce(error);

        await expect(guardarImagenPublicacion(42, archivo(PNG_PEQUENO))).rejects.toBe(error);
    });
});

describe("leerImagenPublicacion", () => {
    it("recupera el contenido desde la carpeta de la publicación", async () => {
        await expect(leerImagenPublicacion(42, NOMBRE_PNG)).resolves.toBe(PNG_PEQUENO);
        expect(sistemaArchivos.readFile).toHaveBeenCalledExactlyOnceWith(rutaGuardada());
    });

    it.each(IDS_INVALIDOS)("rechaza el ID inválido %s sin leer archivos", async (id) => {
        await expect(leerImagenPublicacion(id, NOMBRE_PNG)).rejects.toBeInstanceOf(ErrorImagenPublicacion);
        expect(sistemaArchivos.readFile).not.toHaveBeenCalled();
    });

    it.each(NOMBRES_INVALIDOS)("rechaza el nombre no gestionado %s sin leer archivos", async (nombre) => {
        await expect(leerImagenPublicacion(42, nombre)).rejects.toThrow("nombre de la imagen");
        expect(sistemaArchivos.readFile).not.toHaveBeenCalled();
    });

    it("propaga el error si el archivo no existe", async () => {
        const error = errorArchivo("ENOENT");
        sistemaArchivos.readFile.mockRejectedValueOnce(error);

        await expect(leerImagenPublicacion(42, NOMBRE_PNG)).rejects.toBe(error);
    });
});

describe("eliminarImagenPublicacionGestionada", () => {
    it("elimina una imagen gestionada de la publicación indicada", async () => {
        await eliminarImagenPublicacionGestionada(URL_PNG, 42);

        expect(sistemaArchivos.unlink).toHaveBeenCalledExactlyOnceWith(rutaGuardada());
    });

    it.each([
        null,
        "",
        "https://ejemplo.com/foto.png",
        `/api/publicaciones/imagenes/43/${NOMBRE_PNG}`,
        `/api/publicaciones/imagenes/420/${NOMBRE_PNG}`,
        `/api/publicaciones/imagenes/42/../${NOMBRE_PNG}`,
        `/api/publicaciones/imagenes/42/${NOMBRE_PNG}?descargar=1`,
        "/api/publicaciones/imagenes/42/imagen.png",
    ])("ignora la URL que no identifica una imagen gestionada propia %s", async (url) => {
        await expect(eliminarImagenPublicacionGestionada(url, 42)).resolves.toBeUndefined();
        expect(sistemaArchivos.unlink).not.toHaveBeenCalled();
    });

    it("rechaza un ID inválido aunque coincida con el prefijo de la URL", async () => {
        await expect(eliminarImagenPublicacionGestionada(`/api/publicaciones/imagenes/0/${NOMBRE_PNG}`, 0))
            .rejects.toBeInstanceOf(ErrorImagenPublicacion);
        expect(sistemaArchivos.unlink).not.toHaveBeenCalled();
    });

    it("tolera que una imagen ya haya sido eliminada", async () => {
        sistemaArchivos.unlink.mockRejectedValueOnce(errorArchivo("ENOENT"));

        await expect(eliminarImagenPublicacionGestionada(URL_PNG, 42)).resolves.toBeUndefined();
    });

    it("propaga los errores de eliminación distintos de ENOENT", async () => {
        const error = errorArchivo("EACCES");
        sistemaArchivos.unlink.mockRejectedValueOnce(error);

        await expect(eliminarImagenPublicacionGestionada(URL_PNG, 42)).rejects.toBe(error);
    });
});

describe("tipoContenidoImagen", () => {
    it.each([
        { extension: "jpg", tipo: "image/jpeg" },
        { extension: "png", tipo: "image/png" },
        { extension: "webp", tipo: "image/webp" },
    ])("devuelve el Content-Type de una imagen $extension gestionada", ({ extension, tipo }) => {
        expect(tipoContenidoImagen(`${UUID}.${extension}`)).toBe(tipo);
    });

    it.each(NOMBRES_INVALIDOS)("no reconoce el nombre no gestionado %s", (nombre) => {
        expect(tipoContenidoImagen(nombre)).toBeNull();
    });
});

describe("GET de imágenes de publicaciones", () => {
    function pedir(publicacionId = "42", nombreArchivo = NOMBRE_PNG): Promise<Response> {
        return GET(new Request(`http://localhost${URL_PNG}`), {
            params: Promise.resolve({ publicacionId, archivo: nombreArchivo }),
        });
    }

    it("entrega el contenido y los headers de una imagen existente", async () => {
        const respuesta = await pedir();

        expect(respuesta.status).toBe(200);
        expect(respuesta.headers.get("Content-Type")).toBe("image/png");
        expect(respuesta.headers.get("Content-Length")).toBe(String(PNG_PEQUENO.length));
        expect(respuesta.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
        expect(respuesta.headers.get("X-Content-Type-Options")).toBe("nosniff");
        expect(Buffer.from(await respuesta.arrayBuffer())).toEqual(PNG_PEQUENO);
    });

    it.each(["0", "-1", "1.5", "abc", "../../42", "9007199254740992"])("responde 404 para el ID inválido %s", async (id) => {
        expect((await pedir(id)).status).toBe(404);
        expect(sistemaArchivos.readFile).not.toHaveBeenCalled();
    });

    it("responde 404 para un nombre que intenta salir de la carpeta", async () => {
        expect((await pedir("42", `../${NOMBRE_PNG}`)).status).toBe(404);
        expect(sistemaArchivos.readFile).not.toHaveBeenCalled();
    });

    it("responde 404 cuando la imagen gestionada no existe", async () => {
        sistemaArchivos.readFile.mockRejectedValueOnce(errorArchivo("ENOENT"));

        expect((await pedir()).status).toBe(404);
    });

    it("propaga los errores de lectura distintos de ENOENT", async () => {
        const error = errorArchivo("EACCES");
        sistemaArchivos.readFile.mockRejectedValueOnce(error);

        await expect(pedir()).rejects.toBe(error);
    });
});
