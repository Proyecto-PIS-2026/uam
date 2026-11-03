export function urlInternaNotificacion(valor: unknown): string | null {
    if (typeof valor !== "string" || valor.length > 2048 || valor !== valor.trim()) return null;
    if (!valor.startsWith("/") || valor.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(valor)) return null;
    try {
        const decodificada = decodeURIComponent(valor);
        if (decodificada.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(decodificada)) return null;
        const base = "https://notificaciones.local";
        const url = new URL(valor, base);
        if (url.origin !== base || url.username || url.password || url.pathname.startsWith("//")) return null;
        return url.pathname + url.search + url.hash;
    } catch {
        return null;
    }
}
