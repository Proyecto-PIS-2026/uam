export const LARGO_MAXIMO_COMENTARIO_LICENCIA = 500;

export function validarLargoComentarioLicencia(comentario: string): string | null {
    return comentario.trim().length > LARGO_MAXIMO_COMENTARIO_LICENCIA
        ? `El comentario de la licencia no puede superar los ${LARGO_MAXIMO_COMENTARIO_LICENCIA} caracteres.`
        : null;
}
