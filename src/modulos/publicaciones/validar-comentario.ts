export const LARGO_MAXIMO_COMENTARIO = 500;

export type ResultadoValidacionComentario =
    | { esValido: true; comentario: string | null }
    | { esValido: false; error: string };

export function validarComentario(valor: unknown): ResultadoValidacionComentario {
    if (valor === undefined || valor === null) {
        return { esValido: true, comentario: null };
    }

    if (typeof valor !== "string") {
        return { esValido: false, error: "El comentario no es válido." };
    }

    const comentario = valor.trim();

    if (comentario.length > LARGO_MAXIMO_COMENTARIO) {
        return { esValido: false, error: `El comentario no puede superar los ${LARGO_MAXIMO_COMENTARIO} caracteres.` };
    }

    return { esValido: true, comentario: comentario || null };
}