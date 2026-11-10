import { normalizarDepartamento } from "@/compartido/departamentos-uruguay";

export type UbicacionPublicacionProductor = { nombreUbicacion: string; urlMaps: string; departamento?: string | null };

type ResultadoValidacionUbicaciones =
    | { esValido: true; ubicaciones: UbicacionPublicacionProductor[] }
    | { esValido: false; error: string };

function esUrlGoogleMaps(valor: string): boolean {
    try {
        const url = new URL(valor);
        if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) return false;
        const host = url.hostname.toLowerCase();
        if (host === "maps.app.goo.gl") return url.pathname.length > 1;
        if (host === "goo.gl") return /^\/maps\/.+/.test(url.pathname);
        if (host === "maps.google.com") return true;
        return ["google.com", "www.google.com", "google.com.uy", "www.google.com.uy", "google.com.ar", "www.google.com.ar"]
            .includes(host) && /^\/maps(?:\/|$)/.test(url.pathname);
    } catch {
        return false;
    }
}

export function validarUbicacionesProductor(entrada: unknown): ResultadoValidacionUbicaciones {
    const datos = entrada ?? [];
    if (!Array.isArray(datos)) return { esValido: false, error: "Las ubicaciones no son válidas." };
    if (datos.length > 20) return { esValido: false, error: "Se permiten hasta 20 ubicaciones por publicación." };
    const ubicaciones: UbicacionPublicacionProductor[] = [];
    for (const ubicacion of datos) {
        if (!ubicacion || typeof ubicacion !== "object" || Array.isArray(ubicacion)) return { esValido: false, error: "La ubicación no es válida." };
        const { nombreUbicacion, urlMaps, departamento } = ubicacion as Record<string, unknown>;
        if (typeof nombreUbicacion !== "string" || !nombreUbicacion.trim() || nombreUbicacion.trim().length > 200) {
            return { esValido: false, error: "Cada ubicación debe tener un nombre de hasta 200 caracteres." };
        }
        if (typeof urlMaps !== "string" || urlMaps.trim().length > 2048 || !esUrlGoogleMaps(urlMaps.trim())) {
            return { esValido: false, error: "Seleccioná cada punto de retiro en el mapa antes de guardar." };
        }
        const departamentoNormalizado = normalizarDepartamento(departamento);
        if (departamento !== undefined && departamento !== null && !departamentoNormalizado) {
            return { esValido: false, error: "Seleccioná una ubicación en el mapa para identificar su departamento de Uruguay." };
        }
        ubicaciones.push({ nombreUbicacion: nombreUbicacion.trim(), urlMaps: urlMaps.trim(),
            ...(departamento !== undefined ? { departamento: departamentoNormalizado } : {}) });
    }
    return { esValido: true, ubicaciones };
}
