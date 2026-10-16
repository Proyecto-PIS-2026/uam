import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { type AlmacenamientoImagenes, validarClaveImagen } from "./almacenamiento-imagenes";

export class AlmacenamientoImagenesFilesystem implements AlmacenamientoImagenes {
    private readonly directorio: string;

    constructor(directorio = join(process.cwd(), "storage")) {
        this.directorio = resolve(directorio);
    }

    private ruta(clave: string): string {
        validarClaveImagen(clave);
        return join(this.directorio, ...clave.split("/"));
    }

    async guardar(clave: string, contenido: Buffer): Promise<void> {
        const ruta = this.ruta(clave);
        await mkdir(dirname(ruta), { recursive: true });
        try {
            await writeFile(ruta, contenido, { flag: "wx", mode: 0o600 });
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
                await unlink(ruta).catch(() => undefined);
            }
            throw error;
        }
    }

    async leer(clave: string): Promise<Buffer> {
        return readFile(this.ruta(clave));
    }

    async eliminar(clave: string): Promise<void> {
        try {
            await unlink(this.ruta(clave));
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
    }
}
