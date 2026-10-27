export interface AlmacenamientoImagenes {
    guardar(clave: string, contenido: Buffer): Promise<void>;
    leer(clave: string): Promise<Buffer>;
    eliminar(clave: string): Promise<void>;
}

export const CATEGORIAS_IMAGEN = ["publicaciones", "operadores", "productores", "especies"] as const;
export type CategoriaImagen = typeof CATEGORIAS_IMAGEN[number];

export class ErrorImagen extends Error {}

export class ErrorImagenNoEncontrada extends Error {
    constructor() {
        super("Imagen no encontrada.");
        this.name = "ErrorImagenNoEncontrada";
    }
}

export class ErrorImagenYaExiste extends Error {
    constructor(options?: ErrorOptions) {
        super("Ya existe una imagen con esa clave.", options);
        this.name = "ErrorImagenYaExiste";
    }
}

const NOMBRE_VALIDO = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/;

export function validarDestinoImagen(categoria: string, id: number): asserts categoria is CategoriaImagen {
    if (!(CATEGORIAS_IMAGEN as readonly string[]).includes(categoria) || !Number.isSafeInteger(id) || id <= 0) {
        throw new ErrorImagen("El destino de la imagen no es válido.");
    }
}

export function claveImagen(categoria: CategoriaImagen, id: number, archivo: string): string {
    validarDestinoImagen(categoria, id);
    if (!NOMBRE_VALIDO.test(archivo)) throw new ErrorImagen("El nombre de la imagen no es válido.");
    return `${categoria}/${id}/${archivo}`;
}

export function validarClaveImagen(clave: string): void {
    const partes = clave.split("/");
    if (partes.length !== 3 || !/^[1-9]\d*$/.test(partes[1])) throw new ErrorImagen("La clave de la imagen no es válida.");
    claveImagen(partes[0] as CategoriaImagen, Number(partes[1]), partes[2]);
}

export function urlImagen(categoria: CategoriaImagen, id: number, archivo: string): string {
    claveImagen(categoria, id, archivo);
    return categoria === "publicaciones"
        ? `/api/publicaciones/imagenes/${id}/${archivo}`
        : `/api/imagenes/${categoria}/${id}/${archivo}`;
}

export function claveDesdeUrlImagen(url: string, categoria: CategoriaImagen, id: number): string | null {
    const prefijo = categoria === "publicaciones" ? `/api/publicaciones/imagenes/${id}/` : `/api/imagenes/${categoria}/${id}/`;
    if (!url.startsWith(prefijo)) return null;
    try {
        return claveImagen(categoria, id, url.slice(prefijo.length));
    } catch {
        return null;
    }
}

export function tipoContenidoImagen(archivo: string): string | null {
    if (!NOMBRE_VALIDO.test(archivo)) return null;
    if (archivo.endsWith(".jpg")) return "image/jpeg";
    if (archivo.endsWith(".png")) return "image/png";
    return "image/webp";
}
