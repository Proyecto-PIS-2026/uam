import { lstat, readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
    type AlmacenamientoImagenes,
    type CategoriaImagen,
    CATEGORIAS_IMAGEN,
    ErrorImagenNoEncontrada,
    ErrorImagenYaExiste,
    claveDesdeUrlImagen,
    validarClaveImagen,
} from "./almacenamiento-imagenes";

export type ReferenciaImagen = { categoria: CategoriaImagen; id: number; url: string | null };
type ReferenciaLocal = ReferenciaImagen & { url: string };

export type ReporteMigracionImagenes = {
    directorio: string;
    soloVerificar: boolean;
    pendientes: string[];
    importadas: string[];
    existentes: string[];
    conflictos: string[];
    omitidas: { ruta: string; motivo: string }[];
    referenciasFaltantes: ReferenciaLocal[];
    referenciasInvalidas: ReferenciaLocal[];
};

async function leerDestino(destino: AlmacenamientoImagenes, clave: string): Promise<Buffer | null> {
    try {
        return await destino.leer(clave);
    } catch (error) {
        if (error instanceof ErrorImagenNoEncontrada) return null;
        throw error;
    }
}

async function importar(destino: AlmacenamientoImagenes, clave: string, contenido: Buffer, soloVerificar: boolean): Promise<"importadas" | "existentes" | "conflictos" | "pendientes"> {
    const existente = await leerDestino(destino, clave);
    if (existente) return existente.equals(contenido) ? "existentes" : "conflictos";
    if (soloVerificar) return "pendientes";
    try {
        await destino.guardar(clave, contenido);
        return "importadas";
    } catch (error) {
        if (!(error instanceof ErrorImagenYaExiste)) throw error;
        const concurrente = await leerDestino(destino, clave);
        if (!concurrente) throw error;
        return concurrente.equals(contenido) ? "existentes" : "conflictos";
    }
}

async function esDirectorio(ruta: string): Promise<boolean | null> {
    try {
        const estado = await lstat(ruta);
        return estado.isDirectory() && !estado.isSymbolicLink();
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
    }
}

export async function migrarImagenesFilesystem({ directorio = join(process.cwd(), "storage"), destino, referencias = [], soloVerificar = false }: {
    directorio?: string;
    destino: AlmacenamientoImagenes;
    referencias?: readonly ReferenciaImagen[];
    soloVerificar?: boolean;
}): Promise<ReporteMigracionImagenes> {
    const raiz = resolve(directorio);
    const reporte: ReporteMigracionImagenes = {
        directorio: raiz, soloVerificar, pendientes: [], importadas: [], existentes: [], conflictos: [], omitidas: [],
        referenciasFaltantes: [], referenciasInvalidas: [],
    };
    const directorioValido = await esDirectorio(raiz);
    if (directorioValido !== true) {
        reporte.omitidas.push({ ruta: raiz, motivo: directorioValido === null ? "El directorio de origen no existe." : "El origen no es un directorio regular." });
    } else {
        for (const categoria of CATEGORIAS_IMAGEN) {
            const carpeta = join(raiz, categoria);
            const categoriaValida = await esDirectorio(carpeta);
            if (categoriaValida === null) continue;
            if (!categoriaValida) {
                reporte.omitidas.push({ ruta: categoria, motivo: "La categoría no es un directorio regular." });
                continue;
            }
            const entidades = (await readdir(carpeta, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
            for (const entidad of entidades) {
                const relativa = `${categoria}/${entidad.name}`;
                if (!entidad.isDirectory() || !/^[1-9]\d*$/.test(entidad.name) || !Number.isSafeInteger(Number(entidad.name))) {
                    reporte.omitidas.push({ ruta: relativa, motivo: "El destino no es un directorio con un identificador válido." });
                    continue;
                }
                const archivos = (await readdir(join(carpeta, entidad.name), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
                for (const archivo of archivos) {
                    const clave = `${relativa}/${archivo.name}`;
                    if (!archivo.isFile()) {
                        reporte.omitidas.push({ ruta: clave, motivo: "No es un archivo regular." });
                        continue;
                    }
                    try {
                        validarClaveImagen(clave);
                    } catch {
                        reporte.omitidas.push({ ruta: clave, motivo: "La clave no corresponde a una imagen gestionada por la aplicación." });
                        continue;
                    }
                    const contenido = await readFile(join(carpeta, entidad.name, archivo.name));
                    const resultado = await importar(destino, clave, contenido, soloVerificar);
                    reporte[resultado].push(clave);
                }
            }
        }
    }

    const verificadas = new Map<string, boolean>();
    for (const referencia of referencias) {
        const { categoria, id, url } = referencia;
        if (!url || !/^\/api\/(?:publicaciones\/imagenes|imagenes)(?:\/|$)/.test(url)) continue;
        const local = { ...referencia, url };
        const clave = claveDesdeUrlImagen(url, categoria, id);
        if (!clave) {
            reporte.referenciasInvalidas.push(local);
            continue;
        }
        if (!verificadas.has(clave)) verificadas.set(clave, (await leerDestino(destino, clave)) !== null);
        if (!verificadas.get(clave)) reporte.referenciasFaltantes.push(local);
    }
    return reporte;
}
