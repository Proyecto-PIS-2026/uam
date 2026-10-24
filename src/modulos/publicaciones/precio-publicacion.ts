export const MAXIMO_DIGITOS_PRECIO = 10;
export const MAXIMO_PRECIO_PUBLICACION = 9_999_999_999;
export const PRECIO_PUBLICACION_INVALIDO = "El precio debe ser un número entero positivo de hasta 10 dígitos, sin decimales.";
export const AYUDA_PRECIO_PUBLICACION = "Dejalo vacío para indicar sin precio / consultar precio.";

export function esEntradaPrecioPublicacion(valor: string): boolean {
    return valor === "" || (/^\d{1,10}$/.test(valor) && Number(valor) > 0);
}

export function precioPublicacionValido(valor: unknown): valor is string | null {
    return valor === null || (typeof valor === "string" && esEntradaPrecioPublicacion(valor.trim()));
}

export function normalizarPrecioPublicacion(valor: string | null | undefined): string | null {
    if (valor === undefined || valor === null) return null;
    if (!precioPublicacionValido(valor)) throw new Error(PRECIO_PUBLICACION_INVALIDO);
    const texto = valor.trim();
    return texto === "" ? null : String(Number(texto));
}
