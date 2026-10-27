type EntornoBaseDatos = {
    DATABASE_URL?: string;
    DATABASE_URL_TEST?: string;
};

function identificarBaseDatos(valor: string): string {
    const url = new URL(valor);
    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
        throw new Error("La URL de la base de datos debe usar PostgreSQL.");
    }
    const nombre = decodeURIComponent(url.pathname.slice(1));
    if (!nombre) throw new Error("La URL de la base de datos debe indicar una base.");
    const host = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
        ? "localhost"
        : url.hostname.toLowerCase();
    return `${host}:${url.port || "5432"}/${nombre}`;
}

export function obtenerDatabaseUrlTest(entorno: EntornoBaseDatos = {
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_URL_TEST: process.env.DATABASE_URL_TEST,
}): string {
    const urlTest = entorno.DATABASE_URL_TEST?.trim();
    if (!urlTest) throw new Error("Se requiere DATABASE_URL_TEST para ejecutar pruebas de integración.");
    const baseTest = identificarBaseDatos(urlTest);
    const urlPrincipal = entorno.DATABASE_URL?.trim();
    if (urlPrincipal && identificarBaseDatos(urlPrincipal) === baseTest) {
        throw new Error("DATABASE_URL_TEST debe apuntar a una base distinta de DATABASE_URL.");
    }
    return urlTest;
}
