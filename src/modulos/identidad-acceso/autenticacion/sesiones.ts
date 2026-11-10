import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { obtenerVersionSegundoFactor } from "./segundo-factor-criptografia";

const nombreCookieSesion = "uam_sesion";
const duracionSesionEnSegundos = 60 * 60 * 8;

export type RolUsuario = "OPERADOR" | "ADMINISTRADOR" | "PRODUCTOR";

export type DatosSesion = {
    usuarioId: number;
    rol: RolUsuario;
    expiraEn: number;
    idSesion?: string;
    segundoFactorVerificado?: true;
    versionSegundoFactor?: string;
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

export async function crearSesion(usuarioId: number, rol: DatosSesion["rol"], versionSegundoFactor?: string) {
    if (rol === "ADMINISTRADOR" && !/^[a-f0-9]{64}$/.test(versionSegundoFactor ?? "")) {
        throw new Error("Completá la verificación en dos pasos para iniciar sesión.");
    }
    const expiraEn = Math.floor(Date.now() / 1000) + duracionSesionEnSegundos;
    const valor = serializar({ usuarioId, rol, expiraEn, idSesion: randomUUID(), ...(rol === "ADMINISTRADOR" ? { segundoFactorVerificado: true as const, versionSegundoFactor } : {}) });
    const cookiesSesion = await cookies();

    cookiesSesion.set(nombreCookieSesion, valor, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: duracionSesionEnSegundos,
    });
}

export async function cerrarSesion() {
    const cookiesSesion = await cookies();
    const sesion = verificarToken(cookiesSesion.get(nombreCookieSesion)?.value);
    if (sesion) {
        // La inserción es idempotente: cerrar el mismo token desde dos solicitudes es seguro.
        // Sólo se conservan revocaciones que todavía pueden ser utilizadas.
        const plan = db.raw.sql`
            WITH vencidas AS (
                DELETE FROM "sesionRevocada" WHERE "expiraEn" <= CURRENT_TIMESTAMP
            )
            INSERT INTO "sesionRevocada" ("tokenHash", "expiraEn")
            VALUES (${sesion.tokenHash}, to_timestamp(${sesion.datos.expiraEn}::double precision))
            ON CONFLICT ("tokenHash") DO NOTHING
            RETURNING "tokenHash"
        `.returnsRow({ tokenHash: "pg/text@1" }).build();
        try {
            await db.runtime().query(plan);
        } catch (cause) {
            throw new Error("No pudimos cerrar tu sesión. Intentá nuevamente.", { cause });
        }
    }
    cookiesSesion.delete(nombreCookieSesion);
}

function verificarToken(valor: string | undefined): { datos: DatosSesion; tokenHash: string } | null {
    if (!valor) return null;

    const [contenido, firma, sobrante] = valor.split(".");
    if (!contenido || !firma || sobrante !== undefined) return null;

    const firmaEsperada = firmar(contenido);
    const firmaRecibida = Buffer.from(firma);
    const firmaCalculada = Buffer.from(firmaEsperada);
    if (
        firmaRecibida.length !== firmaCalculada.length ||
        !timingSafeEqual(firmaRecibida, firmaCalculada)
    ) {
        return null;
    }

    let datos: DatosSesion;
    try {
        datos = JSON.parse(
            Buffer.from(contenido, "base64url").toString("utf8"),
        ) as DatosSesion;
    } catch {
        return null;
    }

    if (!datos || typeof datos !== "object" || Array.isArray(datos)) return null;
    if (!Number.isSafeInteger(datos.expiraEn) || datos.expiraEn <= Math.floor(Date.now() / 1000)) return null;
    if (!Number.isSafeInteger(datos.usuarioId) || datos.usuarioId <= 0 || datos.usuarioId > 2147483647) return null;
    if (datos.idSesion !== undefined && (typeof datos.idSesion !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(datos.idSesion))) return null;
    if (
        datos.rol !== "OPERADOR" &&
        datos.rol !== "ADMINISTRADOR" &&
        datos.rol !== "PRODUCTOR"
    ) {
        return null;
    }

    // Acepta las cookies anteriores al cambio hasta que expiren o se cierren.
    // La huella corresponde al contenido firmado, no a una representación alternativa del token.
    return { datos, tokenHash: createHash("sha256").update(contenido).digest("hex") };
}

export async function obtenerSesion(): Promise<DatosSesion | null> {
    const sesion = verificarToken((await cookies()).get(nombreCookieSesion)?.value);
    if (!sesion) return null;
    const { datos, tokenHash } = sesion;

    try {
        const revocada = await db.orm.public.SesionRevocada.where({ tokenHash }).select("tokenHash").first();
        if (revocada) return null;
        const usuario = await db.orm.public.Usuario
            .where({ id: datos.usuarioId })
            .first();

        if (!usuario || !usuario.habilitado || usuario.rol !== datos.rol) {
            return null;
        }
        if (datos.rol === "ADMINISTRADOR" && (datos.segundoFactorVerificado !== true || !usuario.twoFactorEnabled || !usuario.twoFactorSecret)) {
            return null;
        }
        if (datos.rol === "ADMINISTRADOR" && datos.versionSegundoFactor !== obtenerVersionSegundoFactor(usuario.twoFactorSecret!)) {
            return null;
        }

        return datos;
    } catch (cause) {
        throw new Error("No pudimos verificar tu sesión. Intentá nuevamente.", { cause });
    }
}
