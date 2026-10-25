import { File as NodeFile } from "node:buffer";
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    ErrorImagenPublicacion,
    eliminarImagenPublicacionGestionada,
    guardarImagenPublicacion,
    leerImagenPublicacion,
    tipoContenidoImagen,
} from "./imagenes-publicacion";
import { AlmacenamientoImagenesPostgres } from "@/infraestructura/imagenes/almacenamiento-postgres";
import { ErrorImagenNoEncontrada, ErrorImagenYaExiste } from "@/infraestructura/imagenes/almacenamiento-imagenes";
import { crearServicioImagenes } from "@/infraestructura/imagenes/imagenes";

const registros = vi.hoisted(() => ({ crear: vi.fn(), leer: vi.fn(), eliminar: vi.fn() }));
vi.mock("@/infraestructura/persistencia/prisma/db", () => ({ db: { orm: { public: { Imagen: {
    create: registros.crear,
    select: () => ({ where: (filtro: unknown) => ({ first: () => registros.leer(filtro) }) }),
    where: (filtro: unknown) => ({ deleteAll: () => registros.eliminar(filtro) }),
} } } } }));

const UUID = "12345678-1234-4234-8234-123456789abc";
const NOMBRE = `${UUID}.png`;
const URL = `/api/publicaciones/imagenes/42/${NOMBRE}`;
const CLAVE = `publicaciones/42/${NOMBRE}`;
const MAXIMO = 10 * 1024 * 1024;

function archivo(contenido: Buffer, tamano = contenido.length): File {
    const foto = new NodeFile([new Uint8Array(contenido)], "archivo.txt", { type: "text/plain" });
    Object.defineProperty(foto, "size", { value: tamano });
    return foto as unknown as File;
}

async function foto(formato: "png" | "jpeg" | "webp" = "png", width = 20, height = 10) {
    return sharp({ create: { width, height, channels: 3, background: "#229944" } }).toFormat(formato).toBuffer();
}

beforeEach(() => {
    vi.resetAllMocks();
    registros.crear.mockResolvedValue(undefined);
    registros.eliminar.mockResolvedValue(undefined);
});

describe("almacenamiento de imágenes", () => {
    it.each(["png", "jpeg", "webp"] as const)("guarda %s como bytes en PostgreSQL y devuelve una URL sin base64", async (formato) => {
        const url = await guardarImagenPublicacion(42, archivo(await foto(formato)));
        expect(url).toMatch(/^\/api\/publicaciones\/imagenes\/42\/[a-f0-9-]+\.webp$/);
        const [{ clave, contenido }] = registros.crear.mock.calls[0];
        expect(clave).toBe(`publicaciones/42/${url.split("/").at(-1)!}`);
        expect(Buffer.isBuffer(contenido)).toBe(true);
        expect((await sharp(contenido).metadata()).format).toBe("webp");
    });

    it("usa el mismo almacenamiento para el alta codificada y la edición con File", async () => {
        const contenido = await foto();
        const url = await guardarImagenPublicacion(42, `data:image/png;base64,${contenido.toString("base64")}`);
        expect(url).toContain("/api/publicaciones/imagenes/42/");
        expect(registros.crear).toHaveBeenCalledOnce();
    });

    it("reduce las dimensiones y retira los metadatos", async () => {
        const contenido = await sharp(await foto("jpeg", 2000, 1000)).withExif({ IFD0: { Artist: "Privado" } }).jpeg().toBuffer();
        await guardarImagenPublicacion(42, archivo(contenido));
        const metadata = await sharp(registros.crear.mock.calls[0][0].contenido).metadata();
        expect(metadata.width).toBe(1600);
        expect(metadata.height).toBe(800);
        expect(metadata.exif).toBeUndefined();
    });

    it("permite sustituir el adaptador sin cambiar el servicio", async () => {
        const adaptador = { guardar: vi.fn().mockResolvedValue(undefined), leer: vi.fn(), eliminar: vi.fn() };
        const servicio = crearServicioImagenes(adaptador);
        const url = await servicio.guardar("productores", 9, archivo(await foto()));
        expect(url).toContain("/api/imagenes/productores/9/");
        expect(adaptador.guardar).toHaveBeenCalledOnce();
        expect(registros.crear).not.toHaveBeenCalled();
    });

    it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])("rechaza el destino %s", async (id) => {
        await expect(guardarImagenPublicacion(id, archivo(await foto()))).rejects.toBeInstanceOf(ErrorImagenPublicacion);
        expect(registros.crear).not.toHaveBeenCalled();
    });

    it.each([
        Buffer.from("texto"),
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xd9]),
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'),
    ])("rechaza una firma engañosa o un formato no admitido", async (contenido) => {
        await expect(guardarImagenPublicacion(42, archivo(contenido))).rejects.toThrow("JPEG, PNG o WebP");
        expect(registros.crear).not.toHaveBeenCalled();
    });

    it.each([
        null,
        { size: 10 },
        archivo(Buffer.alloc(0)),
        archivo(Buffer.alloc(1), MAXIMO + 1),
        archivo(Buffer.alloc(MAXIMO + 1), 1),
    ])("rechaza entradas vacías y tamaños fuera del límite", async (entrada) => {
        await expect(guardarImagenPublicacion(42, entrada as File)).rejects.toThrow("10 MB");
        expect(registros.crear).not.toHaveBeenCalled();
    });

    it.each(["data:image/png;base64,A", "data:image/png;base64,====", "https://host/foto.png", "data:image/gif;base64,YWJj"])("rechaza codificación %s", async (entrada) => {
        await expect(guardarImagenPublicacion(42, entrada)).rejects.toBeInstanceOf(ErrorImagenPublicacion);
    });

    it("propaga el fallo de inserción sin intentar eliminar otra imagen", async () => {
        const error = new Error("Base de datos no disponible");
        registros.crear.mockRejectedValueOnce(error);
        await expect(guardarImagenPublicacion(42, archivo(await foto()))).rejects.toBe(error);
        expect(registros.eliminar).not.toHaveBeenCalled();
    });

    it.each([
        Object.assign(new Error("Existe"), { code: "23505" }),
        new Error("Inserción rechazada", { cause: Object.assign(new Error("Existe"), { sqlState: "23505" }) }),
    ])("rechaza una clave duplicada sin sobrescribirla ni eliminarla", async (error) => {
        registros.crear.mockRejectedValueOnce(error);
        await expect(new AlmacenamientoImagenesPostgres().guardar(CLAVE, Buffer.from("foto")))
            .rejects.toBeInstanceOf(ErrorImagenYaExiste);
        expect(registros.eliminar).not.toHaveBeenCalled();
    });

    it("lee los bytes de una imagen PNG conservando su URL existente", async () => {
        const contenido = await foto();
        registros.leer.mockResolvedValue({ contenido });
        await expect(leerImagenPublicacion(42, NOMBRE)).resolves.toEqual(contenido);
        expect(registros.leer).toHaveBeenCalledExactlyOnceWith({ clave: CLAVE });
    });

    it("distingue una imagen ausente de un error de lectura de PostgreSQL", async () => {
        registros.leer.mockResolvedValueOnce(null);
        await expect(leerImagenPublicacion(42, NOMBRE)).rejects.toBeInstanceOf(ErrorImagenNoEncontrada);
        const error = new Error("Conexión interrumpida");
        registros.leer.mockRejectedValueOnce(error);
        await expect(leerImagenPublicacion(42, NOMBRE)).rejects.toBe(error);
    });

    it.each([`../${NOMBRE}`, `${NOMBRE}/otro`, `..%2F${NOMBRE}`, "foto.png", `${UUID}.svg`])("impide nombres o rutas no gestionadas %s", async (nombre) => {
        await expect(leerImagenPublicacion(42, nombre)).rejects.toBeInstanceOf(ErrorImagenPublicacion);
        expect(registros.leer).not.toHaveBeenCalled();
    });

    it.each([`../${CLAVE}`, `publicaciones/42/../${NOMBRE}`, `publicaciones\\42\\${NOMBRE}`, `otro/42/${NOMBRE}`])("el adaptador también valida las claves %s", async (clave) => {
        await expect(new AlmacenamientoImagenesPostgres().leer(clave)).rejects.toBeInstanceOf(ErrorImagenPublicacion);
        expect(registros.leer).not.toHaveBeenCalled();
    });

    it("elimina exclusivamente la clave gestionada propia y tolera su ausencia", async () => {
        await expect(eliminarImagenPublicacionGestionada(URL, 42)).resolves.toBeUndefined();
        expect(registros.eliminar).toHaveBeenCalledExactlyOnceWith({ clave: CLAVE });
    });

    it.each([null, "", "/generico/acelga.jpg", "data:image/png;base64,YWJj", URL.replace("/42/", "/43/"), URL + "?a=1"])("conserva referencias que no pertenecen a la publicación %s", async (url) => {
        await eliminarImagenPublicacionGestionada(url, 42);
        expect(registros.eliminar).not.toHaveBeenCalled();
    });

    it.each([["jpg", "image/jpeg"], ["png", "image/png"], ["webp", "image/webp"]])("identifica el tipo seguro %s", (extension, tipo) => {
        expect(tipoContenidoImagen(`${UUID}.${extension}`)).toBe(tipo);
        expect(tipoContenidoImagen(`otro.${extension}`)).toBeNull();
    });
});
