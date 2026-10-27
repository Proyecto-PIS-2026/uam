import { db } from "@/infraestructura/persistencia/prisma/db";
import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { autorizado } from "@/modulos/identidad-acceso/autorizacion/permisos";
import { type CategoriaImagen, urlImagen } from "./almacenamiento-imagenes";
import { Temporal } from "@js-temporal/polyfill";

async function tieneLocalVigente(operadorId: number): Promise<boolean> {
    const locales = await db.orm.public.Local.select("finContrato").where({ operadorId }).all();
    const hoy = Temporal.Now.plainDateISO("America/Montevideo");
    return locales.some((local) => local.finContrato === null || Temporal.PlainDate.compare(
        local.finContrato.toZonedDateTimeISO("America/Montevideo").toPlainDate(), hoy,
    ) >= 0);
}

export async function puedeLeerImagen(categoria: CategoriaImagen, id: number, archivo: string): Promise<boolean> {
    const url = urlImagen(categoria, id, archivo);
    if (categoria === "especies") {
        const especie = await db.orm.public.Especie.select("fotoEspecie", "especieActiva").where({ id }).first();
        return especie?.especieActiva === true && especie.fotoEspecie === url;
    }
    if (categoria === "operadores") {
        const operador = await db.orm.public.Operador.select("fotoPerfil", "usuarioId").where({ id }).first();
        if (operador?.fotoPerfil !== url) return false;
        const sesion = await obtenerSesion();
        if (sesion?.rol === "OPERADOR") return sesion.usuarioId === operador.usuarioId;
        return sesion?.rol === "ADMINISTRADOR" || sesion?.usuarioId === operador.usuarioId || await tieneLocalVigente(id);
    }
    if (categoria === "productores") {
        const sesion = await obtenerSesion();
        if (!sesion) return false;
        const consultaGeneral = autorizado("productor.publicacion.consultar", sesion);
        if (!consultaGeneral && sesion.rol !== "PRODUCTOR") return false;
        const filtro = consultaGeneral ? { id } : { id, usuarioId: sesion.usuarioId };
        const productor = await db.orm.public.Productor.select("fotoPerfil").where(filtro).first();
        return productor?.fotoPerfil === url;
    }

    const publicacion = await db.orm.public.Publicacion
        .select("foto", "tipoPublicacion", "publicacionActiva", "publicacionDisponible")
        .where({ id }).first();
    if (!publicacion || publicacion.foto !== url) return false;
    const sesion = await obtenerSesion();
    if (publicacion.tipoPublicacion === "PRODUCTOR") {
        if (autorizado("productor.publicacion.consultar", sesion)) {
            return sesion?.rol === "ADMINISTRADOR" || publicacion.publicacionActiva && publicacion.publicacionDisponible;
        }
        if (sesion?.rol !== "PRODUCTOR") return false;
        const productor = await db.orm.public.Productor.select("id").where({ usuarioId: sesion.usuarioId }).first();
        if (!productor) return false;
        return !!await db.orm.public.PublicacionProductor.select("id").where({ publicacionId: id, productorId: productor.id }).first();
    }
    if (publicacion.tipoPublicacion !== "OPERADOR") return false;
    if (sesion?.rol === "ADMINISTRADOR") return true;
    const relacion = await db.orm.public.PublicacionOperador.select("operadorId").where({ publicacionId: id }).first();
    if (!relacion) return false;
    if (sesion?.rol === "OPERADOR") {
        return !!await db.orm.public.Operador.select("id").where({ id: relacion.operadorId, usuarioId: sesion.usuarioId }).first();
    }
    return publicacion.publicacionActiva && publicacion.publicacionDisponible && await tieneLocalVigente(relacion.operadorId);
}
