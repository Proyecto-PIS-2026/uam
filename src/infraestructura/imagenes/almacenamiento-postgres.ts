import { db } from "../persistencia/prisma/db";
import {
    type AlmacenamientoImagenes,
    ErrorImagenNoEncontrada,
    ErrorImagenYaExiste,
    validarClaveImagen,
} from "./almacenamiento-imagenes";

export type ClienteAlmacenamientoImagenes = Pick<typeof db, "orm">;

function esClaveDuplicada(error: unknown): boolean {
    const revisados = new Set<object>();
    while (typeof error === "object" && error !== null && !revisados.has(error)) {
        revisados.add(error);
        const dato = error as { sqlState?: string; code?: string; cause?: unknown };
        if ((dato.sqlState ?? dato.code) === "23505") return true;
        error = dato.cause;
    }
    return false;
}

export class AlmacenamientoImagenesPostgres implements AlmacenamientoImagenes {
    constructor(private readonly cliente: ClienteAlmacenamientoImagenes = db) {}

    async guardar(clave: string, contenido: Buffer): Promise<void> {
        validarClaveImagen(clave);
        try {
            await this.cliente.orm.public.Imagen.create({ clave, contenido });
        } catch (error) {
            if (esClaveDuplicada(error)) throw new ErrorImagenYaExiste({ cause: error });
            throw error;
        }
    }

    async leer(clave: string): Promise<Buffer> {
        validarClaveImagen(clave);
        const imagen = await this.cliente.orm.public.Imagen.select("contenido").where({ clave }).first();
        if (!imagen) throw new ErrorImagenNoEncontrada();
        return Buffer.from(imagen.contenido);
    }

    async eliminar(clave: string): Promise<void> {
        validarClaveImagen(clave);
        await this.cliente.orm.public.Imagen.where({ clave }).deleteAll();
    }
}
