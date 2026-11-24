export function usarCookiesSeguras(): boolean {
    const configuracion = process.env.AUTH_COOKIE_SECURE?.trim().toLowerCase();
    if (!configuracion) return process.env.NODE_ENV === "production";
    if (configuracion === "true") return true;
    if (configuracion === "false") return false;
    throw new Error("AUTH_COOKIE_SECURE debe ser true o false.");
}
