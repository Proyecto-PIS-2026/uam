"use server";

import { db } from "@/infraestructura/persistencia/prisma/db";
import { exigirAdministrador } from "@/modulos/identidad-acceso/autorizacion/controles";
import { controlarSesionEnAccion } from "@/modulos/identidad-acceso/autorizacion/control-acciones";
import { bloquearCambioVigenciaPublicaciones } from "@/modulos/publicaciones/configuracion-vigencia-publicaciones";
import { calcularFechaMaximaVigencia, convertirFechaVigenciaAInstant } from "@/modulos/publicaciones/vigencia-publicacion";


const clavesOrdenamiento = [
    "ordenamiento_habilitado",
    "orden_landing_page_default",
    "orden_mercado_virtual_default",
    "orden_mercado_produccion_default",
] as const;

const clavesVigenciaFotos = [
    "aging_fotos_habilitado",
    "vigencia_fotos",
    "aviso_vencimiento_fotos_habilitado",
    "anticipacion_aviso_fotos",
] as const;

const clavesVigenciaPublicacionesProductor = [
    "vigencia_publicaciones_productor_habilitada",
    "vigencia_publicaciones_productor",
    "aviso_vencimiento_publicaciones_productor_habilitado",
    "anticipacion_aviso_publicaciones_productor",
] as const;

const gruposVigencia = [
    clavesVigenciaFotos,
    clavesVigenciaPublicacionesProductor,
] as const;

const ordenesLanding = [
    "nombre_asc",
    "nombre_desc",
    "mas_vendidas",
];

const ordenesMercados = [
    ...ordenesLanding,
    "menor_precio",
    "mayor_precio",
    "mas_actualizadas",
];

const clavesPermitidas = new Set<string>([
    "url_lista_inteligente",
    "incremento_precio",
    "restablecimiento_contrasena_habilitado",
    ...clavesOrdenamiento,
    ...clavesVigenciaFotos,
    ...clavesVigenciaPublicacionesProductor,
]);

const clavesBooleanas = new Set<string>([
    "ordenamiento_habilitado",
    "aging_fotos_habilitado",
    "aviso_vencimiento_fotos_habilitado",
    "vigencia_publicaciones_productor_habilitada",
    "aviso_vencimiento_publicaciones_productor_habilitado",
    "restablecimiento_contrasena_habilitado",
]);

const clavesDias = new Set<string>([
    "vigencia_fotos",
    "anticipacion_aviso_fotos",
    "vigencia_publicaciones_productor",
    "anticipacion_aviso_publicaciones_productor",
]);

function validarValor(nombre: string, valor: string): void {
    if (nombre === "url_lista_inteligente") {
        if (!valor.trim()) {
            throw new Error("La URL de la Lista Inteligente no puede estar vacía.");
        }
        if (valor !== valor.trim()) {
            throw new Error("La URL no puede contener espacios al principio o al final.");
        }
        let url: URL;
        try {
            url = new URL(valor);
        } catch {
            throw new Error("La URL de la Lista Inteligente no es válida.");
        }
        if (!["http:", "https:"].includes(url.protocol) || !url.hostname) {
            throw new Error("La URL debe comenzar con http:// o https://.");
        }
        if (!url.pathname.toLowerCase().endsWith(".pdf")) {
            throw new Error("La URL de la Lista Inteligente debe corresponder a un archivo PDF.");
        }
        return;
    }
    if (nombre === "incremento_precio") {
        if (!/^[0-9]+$/.test(valor) || Number(valor) <= 0) {
            throw new Error("El importe debe ser un número entero mayor que cero.");
        }
        if (!Number.isSafeInteger(Number(valor))) {
            throw new Error("El importe ingresado es demasiado grande.");
        }
        return;
    }
    if (clavesBooleanas.has(nombre)) {
        if (valor !== "true" && valor !== "false") {
            throw new Error("El estado de la configuración no es válido.");
        }
        return;
    }
    if (nombre === "orden_landing_page_default") {
        if (!ordenesLanding.includes(valor)) {
            throw new Error("El orden de la página de inicio debe ser A–Z, Z–A o Más vendidas.");
        }
        return;
    }
    if (nombre === "orden_mercado_virtual_default" || nombre === "orden_mercado_produccion_default") {
        if (!ordenesMercados.includes(valor)) {
            throw new Error("El orden seleccionado para el mercado no es válido.");
        }
        return;
    }
    if (clavesDias.has(nombre)) {
        return;
    }
    throw new Error("La configuración indicada no es válida.");
}

function validarDias(valor: string, campo: "vigencia" | "anticipación"): void {
    if (!/^[0-9]+$/.test(valor) || Number(valor) <= 0) {
        throw new Error(`La ${campo} debe ser un número entero mayor que cero.`);
    }
    if (!Number.isSafeInteger(Number(valor))) {
        throw new Error(`La ${campo} ingresada es demasiado grande.`);
    }
}

function validarVigencia(cambios: Record<string, string>, claves: readonly [string, string, string, string]): void {
    const [claveHabilitado, claveVigencia, claveAvisos, claveAnticipacion] = claves;
    const configuracionCompleta = claves.every((clave) => Object.hasOwn(cambios, clave));
    if (!configuracionCompleta) {
        throw new Error("Las cuatro opciones de vigencia deben guardarse juntas.");
    }
    const habilitado = cambios[claveHabilitado] === "true";
    const avisosActivos = habilitado && cambios[claveAvisos] === "true";
    if (habilitado) {
        validarDias(cambios[claveVigencia], "vigencia");
        if (claveVigencia === "vigencia_fotos" && Number(cambios[claveVigencia]) > 36500) {
            throw new Error("La vigencia de las fotos no puede superar los 36500 días.");
        }
    }
    if (avisosActivos) {
        validarDias(cambios[claveAnticipacion], "anticipación");
    }
    if (avisosActivos && Number(cambios[claveAnticipacion]) >= Number(cambios[claveVigencia])) {
        throw new Error("La anticipación debe ser menor que la vigencia.");
    }
}

export async function guardarConfiguraciones(cambios: Record<string, string>): Promise<void> {
    await controlarSesionEnAccion(exigirAdministrador);
    if (!cambios || typeof cambios !== "object" || Array.isArray(cambios)) {
        throw new Error("Las configuraciones no son válidas.");
    }
    const entradas = Object.entries(cambios);
    if (entradas.length === 0) {
        throw new Error("No hay configuraciones para guardar.");
    }
    for (const [nombre, valor] of entradas) {
        if (
            !clavesPermitidas.has(nombre) ||
            typeof valor !== "string"
        ) {
            throw new Error("La configuración indicada no es válida.");
        }
        validarValor(nombre, valor);
    }
    const modificaOrdenamiento = clavesOrdenamiento.some((clave) => Object.hasOwn(cambios, clave));
    if (modificaOrdenamiento && !clavesOrdenamiento.every((clave) => Object.hasOwn(cambios, clave))) {
        throw new Error("Las cuatro opciones de ordenamiento deben guardarse juntas.");
    }
    for (const claves of gruposVigencia) {
        const modificaGrupo = claves.some((clave) => Object.hasOwn(cambios, clave));
        if (modificaGrupo) {
            validarVigencia(cambios, claves);
        }
    }

    const modificaVigenciaProductor = clavesVigenciaPublicacionesProductor.some((clave) => Object.hasOwn(cambios, clave));
    const diasVigencia = cambios.vigencia_publicaciones_productor_habilitada === "true"
        ? Number(cambios.vigencia_publicaciones_productor)
        : null;

    await db.transaction(async (tx) => {
        if (modificaVigenciaProductor) {
            await bloquearCambioVigenciaPublicaciones(tx);
        }
        for (const [nombre, valor] of entradas) {
            const actualizada = await tx.orm.public.Configuracion
                .where({ nombreConfiguracion: nombre })
                .select("nombreConfiguracion")
                .update({ valorConfiguracion: valor });

            if (!actualizada) {
                throw new Error(`No existe la configuración ${nombre}.`);
            }
        }
        if (diasVigencia !== null) {
            const fechaMaxima = calcularFechaMaximaVigencia(diasVigencia);
            const limite = convertirFechaVigenciaAInstant(fechaMaxima)!.toString();
            // El cambio de política no renueva la fecha de actualización ni la disponibilidad.
            await tx.execute(db.raw.sql`
                UPDATE publicacion
                SET "fechaVigencia" = ${limite}::timestamptz
                WHERE "tipoPublicacion" = 'PRODUCTOR'
                    AND ("fechaVigencia" IS NULL OR "fechaVigencia" > ${limite}::timestamptz)
            `.affectedCount().build());
        }
    });
}
