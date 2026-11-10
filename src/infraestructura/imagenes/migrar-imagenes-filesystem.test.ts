// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
    type AlmacenamientoImagenes,
    CATEGORIAS_IMAGEN,
    ErrorImagenNoEncontrada,
    ErrorImagenYaExiste,
    urlImagen,
} from "./almacenamiento-imagenes";
import { migrarImagenesFilesystem, type ReferenciaImagen } from "./migrar-imagenes-filesystem";

const archivo = "11111111-1111-4111-8111-111111111111.webp";
const clave = `publicaciones/12/${archivo}`;
let temporal: string;
let directorio: string;
let contenido: Map<string, Buffer>;
let destino: AlmacenamientoImagenes;

async function crearArchivo(ruta: string, bytes = Buffer.from([0, 1, 2, 127, 255])) {
    const absoluta = join(directorio, ...ruta.split("/"));
    await mkdir(dirname(absoluta), { recursive: true });
    await writeFile(absoluta, bytes);
    return bytes;
}

beforeEach(async () => {
    temporal = await mkdtemp(join(tmpdir(), "uam-migrar-imagenes-"));
    directorio = join(temporal, "storage");
    await mkdir(directorio);
    contenido = new Map();
    destino = {
        leer: vi.fn(async (clave) => {
            const bytes = contenido.get(clave);
            if (!bytes) throw new ErrorImagenNoEncontrada();
            return Buffer.from(bytes);
        }),
        guardar: vi.fn(async (clave, bytes) => {
            if (contenido.has(clave)) throw new ErrorImagenYaExiste();
            contenido.set(clave, Buffer.from(bytes));
        }),
        eliminar: vi.fn(),
    };
});

afterEach(async () => {
    await rm(temporal, { recursive: true, force: true });
});

describe("migración de imágenes del filesystem", () => {
    it("copia las cuatro categorías conservando bytes, claves, URLs y originales", async () => {
        const referencias: ReferenciaImagen[] = [];
        const originales = new Map<string, Buffer>();
        for (const [indice, categoria] of CATEGORIAS_IMAGEN.entries()) {
            const nombre = archivo.replace(".webp", [".webp", ".jpg", ".png", ".webp"][indice]);
            const clave = `${categoria}/12/${nombre}`;
            originales.set(clave, await crearArchivo(clave));
            referencias.push({ categoria, id: 12, url: urlImagen(categoria, 12, nombre) });
        }
        const referenciasOriginales = structuredClone(referencias);

        const reporte = await migrarImagenesFilesystem({ directorio, destino, referencias });

        expect(reporte.importadas).toEqual([...originales.keys()]);
        expect(reporte.referenciasFaltantes).toEqual([]);
        expect(reporte.referenciasInvalidas).toEqual([]);
        expect(referencias).toEqual(referenciasOriginales);
        for (const [clave, bytes] of originales) {
            expect(contenido.get(clave)).toEqual(bytes);
            expect(await readFile(join(directorio, ...clave.split("/")))).toEqual(bytes);
        }
        expect(destino.eliminar).not.toHaveBeenCalled();
    });

    it("es idempotente y no vuelve a escribir imágenes con el mismo contenido", async () => {
        await crearArchivo(clave);
        await migrarImagenesFilesystem({ directorio, destino });
        const reporte = await migrarImagenesFilesystem({ directorio, destino });
        expect(reporte.importadas).toEqual([]);
        expect(reporte.existentes).toEqual([clave]);
        expect(reporte.conflictos).toEqual([]);
        expect(destino.guardar).toHaveBeenCalledOnce();
        expect(destino.eliminar).not.toHaveBeenCalled();
    });

    it("informa un conflicto sin sobrescribir PostgreSQL ni borrar el archivo fuente", async () => {
        const original = await crearArchivo(clave);
        contenido.set(clave, Buffer.from("otra imagen"));
        const reporte = await migrarImagenesFilesystem({ directorio, destino });
        expect(reporte.conflictos).toEqual([clave]);
        expect(reporte.importadas).toEqual([]);
        expect(contenido.get(clave)).toEqual(Buffer.from("otra imagen"));
        expect(await readFile(join(directorio, clave))).toEqual(original);
        expect(destino.guardar).not.toHaveBeenCalled();
        expect(destino.eliminar).not.toHaveBeenCalled();
    });

    it.each([true, false])("relee y compara si otra importación se adelanta (idéntica: %s)", async (identica) => {
        const original = await crearArchivo(clave);
        vi.mocked(destino.guardar).mockImplementationOnce(async (clave) => {
            contenido.set(clave, identica ? original : Buffer.from("contenido concurrente"));
            throw new ErrorImagenYaExiste();
        });
        const reporte = await migrarImagenesFilesystem({ directorio, destino });
        expect(reporte[identica ? "existentes" : "conflictos"]).toEqual([clave]);
        expect(reporte.importadas).toEqual([]);
        expect(destino.guardar).toHaveBeenCalledOnce();
        expect(await readFile(join(directorio, clave))).toEqual(original);
    });

    it("inventaría las referencias faltantes de todas las categorías aunque no exista storage", async () => {
        const referencias = CATEGORIAS_IMAGEN.map((categoria) => ({ categoria, id: 12, url: urlImagen(categoria, 12, archivo) }));
        const reporte = await migrarImagenesFilesystem({ directorio: join(temporal, "inexistente"), destino, referencias });
        expect(reporte.referenciasFaltantes).toEqual(referencias);
        expect(reporte.omitidas).toEqual([expect.objectContaining({ motivo: "El directorio de origen no existe." })]);
        expect(destino.guardar).not.toHaveBeenCalled();
    });

    it("reconoce referencias ya importadas aunque el archivo fuente no esté presente", async () => {
        contenido.set(clave, Buffer.from("importada antes"));
        const referencia: ReferenciaImagen = { categoria: "publicaciones", id: 12, url: urlImagen("publicaciones", 12, archivo) };
        const reporte = await migrarImagenesFilesystem({ directorio, destino, referencias: [referencia, referencia] });
        expect(reporte.referenciasFaltantes).toEqual([]);
        expect(destino.leer).toHaveBeenCalledExactlyOnceWith(clave);
        expect(destino.guardar).not.toHaveBeenCalled();
    });

    it("ignora assets estáticos, URLs externas y base64, e inventaría las rutas locales inválidas", async () => {
        const referencias: ReferenciaImagen[] = [
            ...[null, "", "/imagenes/pera.webp", "https://ejemplo.test/api/publicaciones/imagenes/12/foto.webp", "//ejemplo.test/imagen.webp", "data:image/png;base64,YQ=="]
                .map((url) => ({ categoria: "publicaciones" as const, id: 12, url })),
            { categoria: "publicaciones", id: 12, url: `/api/publicaciones/imagenes/99/${archivo}` },
            { categoria: "operadores", id: 12, url: "/api/imagenes/operadores/12/../secreto.webp" },
        ];
        await crearArchivo(`public/imagenes/${archivo}`);
        const reporte = await migrarImagenesFilesystem({ directorio, destino, referencias });
        expect(reporte.referenciasInvalidas).toEqual(referencias.slice(-2));
        expect(reporte.referenciasFaltantes).toEqual([]);
        expect(reporte.importadas).toEqual([]);
        expect(destino.leer).not.toHaveBeenCalled();
        expect(destino.guardar).not.toHaveBeenCalled();
        expect(await readFile(join(directorio, "public/imagenes", archivo))).toBeDefined();
    });

    it("omite identificadores y nombres inválidos y subdirectorios sin recorrerlos", async () => {
        for (const ruta of [`publicaciones/0/${archivo}`, `publicaciones/01/${archivo}`, `publicaciones/9007199254740992/${archivo}`, "publicaciones/12/foto.webp", `publicaciones/12/anidadas/${archivo}`]) {
            await crearArchivo(ruta);
        }
        const reporte = await migrarImagenesFilesystem({ directorio, destino });
        expect(reporte.omitidas).toHaveLength(5);
        expect(reporte.importadas).toEqual([]);
        expect(destino.guardar).not.toHaveBeenCalled();
    });

    it("no sigue enlaces de categorías hacia archivos fuera del origen", async () => {
        const externa = join(temporal, "otra-carpeta");
        await mkdir(join(externa, "12"), { recursive: true });
        await writeFile(join(externa, "12", archivo), "no importar");
        await symlink(externa, join(directorio, "publicaciones"), "junction");
        const reporte = await migrarImagenesFilesystem({ directorio, destino });
        expect(reporte.omitidas).toEqual([{ ruta: "publicaciones", motivo: "La categoría no es un directorio regular." }]);
        expect(reporte.importadas).toEqual([]);
        expect(destino.guardar).not.toHaveBeenCalled();
    });

    it("propaga fallos del destino en vez de informarlos como referencias faltantes", async () => {
        const error = new Error("Base de datos no disponible");
        vi.mocked(destino.leer).mockRejectedValue(error);
        await expect(migrarImagenesFilesystem({
            directorio, destino, referencias: [{ categoria: "publicaciones", id: 12, url: urlImagen("publicaciones", 12, archivo) }],
        })).rejects.toBe(error);
        expect(destino.guardar).not.toHaveBeenCalled();
    });

    it("conserva originales ante un fallo al insertar y permite reintentar", async () => {
        const original = await crearArchivo(clave);
        vi.mocked(destino.guardar).mockRejectedValueOnce(new Error("Falló la escritura"));
        await expect(migrarImagenesFilesystem({ directorio, destino })).rejects.toThrow("Falló la escritura");
        expect(await readFile(join(directorio, clave))).toEqual(original);
        expect(destino.eliminar).not.toHaveBeenCalled();
        const reporte = await migrarImagenesFilesystem({ directorio, destino });
        expect(reporte.importadas).toEqual([clave]);
        expect(contenido.get(clave)).toEqual(original);
    });

    it("verifica pendientes, conflictos y referencias sin escribir ni borrar contenido", async () => {
        const original = await crearArchivo(clave);
        const otraClave = `operadores/12/${archivo}`;
        await crearArchivo(otraClave, Buffer.from("original distinto"));
        contenido.set(otraClave, Buffer.from("imagen ya guardada"));
        const referencia: ReferenciaImagen = { categoria: "publicaciones", id: 12, url: urlImagen("publicaciones", 12, archivo) };

        const reporte = await migrarImagenesFilesystem({ directorio, destino, referencias: [referencia], soloVerificar: true });

        expect(reporte.soloVerificar).toBe(true);
        expect(reporte.pendientes).toEqual([clave]);
        expect(reporte.conflictos).toEqual([otraClave]);
        expect(reporte.referenciasFaltantes).toEqual([referencia]);
        expect(reporte.importadas).toEqual([]);
        expect(destino.guardar).not.toHaveBeenCalled();
        expect(destino.eliminar).not.toHaveBeenCalled();
        expect(contenido.size).toBe(1);
        expect(await readFile(join(directorio, clave))).toEqual(original);
    });
});
