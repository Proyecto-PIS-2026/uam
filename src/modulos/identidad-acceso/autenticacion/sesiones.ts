import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const nombreCookieSesion = "uam_sesion";
const duracionSesionEnSegundos = 60 * 60 * 8;

export type RolUsuario = "OPERADOR" | "ADMINISTRADOR" | "PRODUCTOR";

export type DatosSesion = {
    usuarioId: number;
    rol: RolUsuario;
    expiraEn: number;
};

function obtenerSecretoSesion() {
    const secreto = process.env.SESSION_SECRET;
    if (!secreto) {
        throw new Error("SESSION_SECRET no está configurado.");
    }
    return secreto;
}

function firmar(contenido: string) {
    return createHmac("sha256", obtenerSecretoSesion())
        .update(contenido)
        .digest("base64url");
}

function serializar(datos: DatosSesion) {
    const contenido = Buffer.from(JSON.stringify(datos)).toString("base64url");
    return `${contenido}.${firmar(contenido)}`;
}

export async function crearSesion(usuarioId: number, rol: DatosSesion["rol"]) {
    const expiraEn = Math.floor(Date.now() / 1000) + duracionSesionEnSegundos;
    const valor = serializar({ usuarioId, rol, expiraEn });
    const cookiesSesion = await cookies();

    cookiesSesion.set(nombreCookieSesion, valor, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: duracionSesionEnSegundos,
    });
}

export async function obtenerSesion(): Promise<DatosSesion | null> {
    const valor = (await cookies()).get(nombreCookieSesion)?.value;
    if (!valor) return null;

    const [contenido, firma] = valor.split(".");
    if (!contenido || !firma) return null;

    const firmaEsperada = firmar(contenido);
    const firmaRecibida = Buffer.from(firma, "base64url");
    const firmaCalculada = Buffer.from(firmaEsperada, "base64url");
    if (
        firmaRecibida.length !== firmaCalculada.length ||
        !timingSafeEqual(firmaRecibida, firmaCalculada)
    ) {
        return null;
    }

    try {
        const datos = JSON.parse(
            Buffer.from(contenido, "base64url").toString("utf8"),
        ) as DatosSesion;
        if (datos.expiraEn <= Math.floor(Date.now() / 1000)) return null;
        if (!Number.isSafeInteger(datos.usuarioId)) return null;
        if (
            datos.rol !== "OPERADOR" &&
            datos.rol !== "ADMINISTRADOR" &&
            datos.rol !== "PRODUCTOR"
        ) {
            return null;
        }
        return datos;
    } catch {
        return null;
    }
}
