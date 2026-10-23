/**
 * Next 16.3 vuelve a codificar los segmentos dinámicos antes de entregarlos a
 * las páginas. Se deshace esa codificación una sola vez en la entrada de la ruta;
 * las consultas y componentes reciben el nombre original, incluso si tiene %20.
 */
export function decodificarParametroRuta(valor: string): string | null {
    try {
        return decodeURIComponent(valor);
    } catch {
        return null;
    }
}
