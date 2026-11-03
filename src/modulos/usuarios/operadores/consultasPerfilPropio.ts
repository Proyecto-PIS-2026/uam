import { db } from "@/infraestructura/persistencia/prisma/db";
import { obtenerOperadorActual } from "./operador-actual";

export type PerfilPropioOperador = {
    id: number;
    nombre: string;
    nombreUsuario: string;
    contacto: string | null;
    fotoPerfil: string | null;
    comentario: string | null;
    enLicencia: boolean;
    locales: { nave: string; local: string; finContrato: string | null }[];
};

export async function obtenerPerfilPropioOperador(): Promise<PerfilPropioOperador> {
    const operadorActual = await obtenerOperadorActual();
    const operador = await db.orm.public.Operador
        .select("id", "nombreFantasia", "whatsApp", "fotoPerfil", "comentario", "enLicencia")
        .include("usuario", (usuario) => usuario.select("username"))
        .include("locales", (locales) =>
            locales.select("numeroLocal", "finContrato").include("nave", (nave) => nave.select("nombreNave")),
        )
        .where({ id: operadorActual.id })
        .first();

    if (!operador) {
        throw new Error("No se encontró el perfil del operador autenticado.");
    }
    return {
        id: operador.id,
        nombre: operador.nombreFantasia,
        nombreUsuario: operador.usuario.username,
        contacto: operador.whatsApp.trim() || null,
        fotoPerfil: operador.fotoPerfil,
        comentario: operador.comentario,
        enLicencia: operador.enLicencia,
        locales: operador.locales
            .map((local) => ({
                nave: local.nave.nombreNave,
                local: local.numeroLocal,
                finContrato: local.finContrato
                    ? local.finContrato.toZonedDateTimeISO("America/Montevideo").toPlainDate().toString()
                    : null,
            }))
            .sort((a, b) => a.nave.localeCompare(b.nave, "es") || a.local.localeCompare(b.local, "es", { numeric: true })),
    };
}
