import { db } from "@/infraestructura/persistencia/prisma/db";
import type { DatosSesion, RolUsuario } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import type { NotificacionesUsuario } from "./tipos";
import { urlInternaNotificacion } from "./validacion-url";

export type DestinatariosNotificacion = {
    texto: string;
    url?: string | null;
    usuarios?: number[];
    roles?: RolUsuario[];
};

export class ErrorNotificaciones extends Error {
    constructor(public readonly status: 400 | 401 | 404, mensaje: string) {
        super(mensaje);
        this.name = "ErrorNotificaciones";
    }
}

const ROLES: readonly RolUsuario[] = ["ADMINISTRADOR", "OPERADOR", "PRODUCTOR"];

function esId(valor: unknown): valor is number {
    return typeof valor === "number" && Number.isSafeInteger(valor) && valor > 0 && valor <= 2147483647;
}

function exigirUsuario(sesion: DatosSesion | null): number {
    if (!sesion || !esId(sesion.usuarioId) || !ROLES.includes(sesion.rol) || !Number.isFinite(sesion.expiraEn) || sesion.expiraEn <= Date.now() / 1000) {
        throw new ErrorNotificaciones(401, "Iniciá sesión para consultar tus notificaciones.");
    }
    return sesion.usuarioId;
}

export function validarIdNotificacion(valor: string): number {
    const id = Number(valor);
    if (!/^[1-9]\d*$/.test(valor) || !esId(id)) {
        throw new ErrorNotificaciones(400, "La notificación no es válida.");
    }
    return id;
}

function validarEnvio(entrada: DestinatariosNotificacion) {
    if (!entrada || typeof entrada !== "object" || Array.isArray(entrada)) {
        throw new ErrorNotificaciones(400, "Los datos de la notificación no son válidos.");
    }
    if (typeof entrada.texto !== "string" || !entrada.texto.trim() || entrada.texto.trim().length > 2000 || entrada.texto.includes("\u0000")) {
        throw new ErrorNotificaciones(400, "El texto debe tener entre 1 y 2000 caracteres.");
    }
    const usuarios = entrada.usuarios === undefined ? [] : entrada.usuarios;
    const roles = entrada.roles === undefined ? [] : entrada.roles;
    if (!Array.isArray(usuarios) || usuarios.some((id) => !esId(id))) {
        throw new ErrorNotificaciones(400, "Los usuarios destinatarios no son válidos.");
    }
    if (!Array.isArray(roles) || roles.some((rol) => !ROLES.includes(rol))) {
        throw new ErrorNotificaciones(400, "Los roles destinatarios no son válidos.");
    }
    const url = entrada.url == null ? null : urlInternaNotificacion(entrada.url);
    if (entrada.url != null && url === null) {
        throw new ErrorNotificaciones(400, "La URL debe ser una ruta interna válida.");
    }
    return { texto: entrada.texto.trim(), url, usuarios: [...new Set(usuarios)], roles: [...new Set(roles)] };
}

export async function enviarNotificacion(entrada: DestinatariosNotificacion, cliente?: Pick<typeof db, "orm">): Promise<{ enviadas: number }> {
    const { texto, url, usuarios, roles } = validarEnvio(entrada);
    if (usuarios.length === 0 && roles.length === 0) return { enviadas: 0 };
    const crearNotificaciones = async (tx: Pick<typeof db, "orm">) => {
        const destinatarios = new Set<number>();
        if (usuarios.length > 0) {
            const existentes = await tx.orm.public.Usuario.select("id").where((usuario) => usuario.id.in(usuarios)).all();
            for (const usuario of existentes) destinatarios.add(usuario.id);
        }
        if (roles.length > 0) {
            const existentes = await tx.orm.public.Usuario.select("id").where((usuario) => usuario.rol.in(roles)).all();
            for (const usuario of existentes) destinatarios.add(usuario.id);
        }
        for (const usuarioId of destinatarios) {
            await tx.orm.public.Notificacion.create({ titulo: "Notificación", descripcion: texto, url, usuarioId });
        }
        return { enviadas: destinatarios.size };
    };
    return cliente ? crearNotificaciones(cliente) : db.transaction(crearNotificaciones);
}

export async function consultarNotificaciones(sesion: DatosSesion | null): Promise<NotificacionesUsuario> {
    const usuarioId = exigirUsuario(sesion);
    const filas = await db.orm.public.Notificacion.where({ usuarioId })
        .orderBy([(notificacion) => notificacion.fecha.desc(), (notificacion) => notificacion.id.desc()]).all();
    const notificaciones = filas.map((fila) => ({
        id: fila.id,
        texto: fila.descripcion.trim() || fila.titulo,
        url: urlInternaNotificacion(fila.url),
        leida: fila.vista,
        fecha: fila.fecha.toString(),
    }));
    return { notificaciones, noLeidas: notificaciones.filter((notificacion) => !notificacion.leida).length };
}

export async function contarNotificacionesNoLeidas(sesion: DatosSesion | null): Promise<number> {
    const usuarioId = exigirUsuario(sesion);
    return contarNoLeidas(usuarioId, db);
}

async function contarNoLeidas(usuarioId: number, cliente: Pick<typeof db, "orm">): Promise<number> {
    const { noLeidas } = await cliente.orm.public.Notificacion.where({ usuarioId, vista: false })
        .aggregate((agregado) => ({ noLeidas: agregado.count() }));
    return noLeidas;
}

async function modificarNotificacion(sesion: DatosSesion | null, id: number, eliminar: boolean): Promise<number> {
    const usuarioId = exigirUsuario(sesion);
    if (!esId(id)) throw new ErrorNotificaciones(400, "La notificación no es válida.");
    return db.transaction(async (tx) => {
        const consulta = tx.orm.public.Notificacion.where({ id, usuarioId }).select("id");
        const modificada = eliminar ? await consulta.delete() : await consulta.update({ vista: true });
        if (!modificada) throw new ErrorNotificaciones(404, "La notificación no existe.");
        return contarNoLeidas(usuarioId, tx);
    });
}

export async function marcarNotificacionLeida(sesion: DatosSesion | null, id: number): Promise<number> {
    return modificarNotificacion(sesion, id, false);
}

export async function eliminarNotificacion(sesion: DatosSesion | null, id: number): Promise<number> {
    return modificarNotificacion(sesion, id, true);
}

export async function marcarTodasNotificacionesLeidas(sesion: DatosSesion | null): Promise<number> {
    const usuarioId = exigirUsuario(sesion);
    return db.transaction(async (tx) => {
        await tx.orm.public.Notificacion.where({ usuarioId, vista: false }).updateAndCount({ vista: true });
        return contarNoLeidas(usuarioId, tx);
    });
}

export async function eliminarTodasNotificaciones(sesion: DatosSesion | null): Promise<number> {
    const usuarioId = exigirUsuario(sesion);
    return db.transaction(async (tx) => {
        await tx.orm.public.Notificacion.where({ usuarioId }).deleteAndCount();
        return contarNoLeidas(usuarioId, tx);
    });
}
