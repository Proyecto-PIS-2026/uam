import type { DatosSesion } from "../autenticacion/sesiones";

export type RecursoConPropietario = {
    id: number;
    usuarioId: number;
};

// Reglas puras: la sesión debe estar validada y el propietario debe obtenerse
// de la base de datos. usuarioId corresponde al Usuario, no al ID del perfil
// de Operador, Productor o Publicacion. Para un alta, se usa el perfil dueño.
// Cada módulo debe invocar la regla correspondiente antes de consultar o modificar datos.
const permisos = {
    "operador.publicacion.consultar": () => true,
    "operador.catalogo.consultar": () => true,
    "preciosReferencia.consultar": () => true,
    "listaInteligente.consultar": () => true,

    "operador.mercado.acceder": (sesion: DatosSesion | null): boolean =>
        sesion?.rol === "OPERADOR",
    "operador.publicacion.consultarPropias": (sesion: DatosSesion | null, recurso: RecursoConPropietario): boolean =>
        sesion?.rol === "OPERADOR" &&
        Number.isSafeInteger(recurso.id) && recurso.id > 0 &&
        sesion.usuarioId === recurso.usuarioId,
    "operador.publicacion.crear": (sesion: DatosSesion | null, recurso: RecursoConPropietario): boolean =>
        sesion?.rol === "OPERADOR" &&
        Number.isSafeInteger(recurso.id) && recurso.id > 0 &&
        sesion.usuarioId === recurso.usuarioId,
    "operador.publicacion.modificar": (sesion: DatosSesion | null, recurso: RecursoConPropietario): boolean =>
        sesion?.rol === "OPERADOR" &&
        Number.isSafeInteger(recurso.id) && recurso.id > 0 &&
        sesion.usuarioId === recurso.usuarioId,
    "operador.publicacion.eliminar": (sesion: DatosSesion | null, recurso: RecursoConPropietario): boolean =>
        sesion?.rol === "OPERADOR" &&
        Number.isSafeInteger(recurso.id) && recurso.id > 0 &&
        sesion.usuarioId === recurso.usuarioId,

    "productor.mercado.acceder": (sesion: DatosSesion | null): boolean =>
        sesion?.rol === "PRODUCTOR",

    // Permisos sin funcionalidad implementada, falta validar
    "operador.licencias.gestionar": (sesion: DatosSesion | null, recurso: RecursoConPropietario): boolean =>
        sesion?.rol === "OPERADOR" &&
        Number.isSafeInteger(recurso.id) && recurso.id > 0 &&
        sesion.usuarioId === recurso.usuarioId,
    "operador.contacto.modificar": (sesion: DatosSesion | null, recurso: RecursoConPropietario): boolean =>
        sesion?.rol === "OPERADOR" &&
        Number.isSafeInteger(recurso.id) && recurso.id > 0 &&
        sesion.usuarioId === recurso.usuarioId,

    "productor.publicacion.consultar": (sesion: DatosSesion | null): boolean =>
        sesion?.rol === "OPERADOR",
    "productor.publicacion.crear": (sesion: DatosSesion | null, recurso: RecursoConPropietario): boolean =>
        sesion?.rol === "PRODUCTOR" &&
        Number.isSafeInteger(recurso.id) && recurso.id > 0 &&
        sesion.usuarioId === recurso.usuarioId,
    "productor.publicacion.modificar": (sesion: DatosSesion | null, recurso: RecursoConPropietario): boolean =>
        sesion?.rol === "PRODUCTOR" &&
        Number.isSafeInteger(recurso.id) && recurso.id > 0 &&
        sesion.usuarioId === recurso.usuarioId,
    "productor.publicacion.eliminar": (sesion: DatosSesion | null, recurso: RecursoConPropietario): boolean =>
        sesion?.rol === "PRODUCTOR" &&
        Number.isSafeInteger(recurso.id) && recurso.id > 0 &&
        sesion.usuarioId === recurso.usuarioId,
    "productor.contacto.modificar": (sesion: DatosSesion | null, recurso: RecursoConPropietario): boolean =>
        sesion?.rol === "PRODUCTOR" &&
        Number.isSafeInteger(recurso.id) && recurso.id > 0 &&
        sesion.usuarioId === recurso.usuarioId,
    "productor.departamento.modificar": (sesion: DatosSesion | null, recurso: RecursoConPropietario): boolean =>
        sesion?.rol === "PRODUCTOR" &&
        Number.isSafeInteger(recurso.id) && recurso.id > 0 &&
        sesion.usuarioId === recurso.usuarioId,

    "usuarios.cuentas.gestionar": (sesion: DatosSesion | null): boolean =>
        sesion?.rol === "ADMINISTRADOR",
    "usuarios.restablecimientos.gestionar": (sesion: DatosSesion | null): boolean =>
        sesion?.rol === "ADMINISTRADOR",
    "administracion.configuracion.gestionar": (sesion: DatosSesion | null): boolean =>
        sesion?.rol === "ADMINISTRADOR",
} as const;

export type Permiso = keyof typeof permisos;

export const autorizado = <P extends Permiso>(
    permiso: P,
    ...argumentos: Parameters<(typeof permisos)[P]>
): boolean => {
    if (!Object.prototype.hasOwnProperty.call(permisos, permiso)) return false;
    const regla = permisos[permiso] as (...argumentos: Parameters<(typeof permisos)[P]>) => boolean;
    if (typeof regla !== "function") return false;
    return regla(...argumentos);
};
