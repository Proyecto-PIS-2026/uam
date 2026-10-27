export function decodificarParametroRuta(valor: string): string | null {
    try {
        return decodeURIComponent(valor);
    } catch {
        return null;
    }
}
