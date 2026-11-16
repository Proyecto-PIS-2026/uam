"use server";

import { db } from "@/infraestructura/persistencia/prisma/db";
import { exigirAdministrador } from "@/modulos/identidad-acceso/autorizacion/controles";
import { controlarSesionEnAccion } from "@/modulos/identidad-acceso/autorizacion/control-acciones";
import { bloquearCambioVigenciaPublicaciones } from "@/modulos/publicaciones/configuracion-vigencia-publicaciones";
import { calcularFechaMaximaVigencia, convertirFechaVigenciaAInstant } from "@/modulos/publicaciones/vigencia-publicacion";
import { CLAVES_VIGENCIA_PUBLICACIONES, MAXIMO_DIAS_ANTICIPACION_PUBLICACIONES } from "@/modulos/publicaciones/claves-vigencia-publicaciones";
import { CLAVES_AGING_FOTOS } from "@/modulos/publicaciones/claves-aging-fotos";
import { CLAVE_ANTICIPACION_AVISO_LOCALES, CLAVE_HABILITACION_AVISO_LOCALES, validarAnticipacionAvisoLocales } from "@/modulos/usuarios/operadores/configuracion-avisos-locales";


const clavesOrdenamiento = [
    "ordenamiento_habilitado",
    "orden_landing_page_default",
    "orden_mercado_virtual_default",
    "orden_mercado_produccion_default",
] as const;

const gruposVigencia = [
    CLAVES_AGING_FOTOS.OPERADOR,
    CLAVES_AGING_FOTOS.PRODUCTOR,
    CLAVES_VIGENCIA_PUBLICACIONES.OPERADOR,
    CLAVES_VIGENCIA_PUBLICACIONES.PRODUCTOR,
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
    CLAVE_ANTICIPACION_AVISO_LOCALES,
    CLAVE_HABILITACION_AVISO_LOCALES,
    ...clavesOrdenamiento,
    ...CLAVES_AGING_FOTOS.OPERADOR,
    ...CLAVES_AGING_FOTOS.PRODUCTOR,
    ...CLAVES_VIGENCIA_PUBLICACIONES.OPERADOR,
    ...CLAVES_VIGENCIA_PUBLICACIONES.PRODUCTOR,
]);

const clavesBooleanas = new Set<string>([
    "ordenamiento_habilitado",
    CLAVE_HABILITACION_AVISO_LOCALES,
    ...gruposVigencia.flatMap(([habilitado, , avisos]) => [habilitado, avisos]),
    "restablecimiento_contrasena_habilitado",
]);

const clavesDias = new Set<string>([
    ...gruposVigencia.flatMap(([, vigencia, , anticipacion]) => [vigencia, anticipacion]),
]);

function validarValor(nombre: string, valor: string): void {
    if (nombre === CLAVE_ANTICIPACION_AVISO_LOCALES) {
        validarAnticipacionAvisoLocales(valor);
        return;
    }
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
        if (valor !== "") {
            const esVigencia = gruposVigencia.some(([, vigencia]) => vigencia === nombre);
            validarDias(valor, esVigencia ? "vigencia" : "anticipación");
            if (Object.values(CLAVES_AGING_FOTOS).some(([, vigencia]) => vigencia === nombre) && Number(valor) > 36500) {
                throw new Error("La vigencia de las fotos no puede superar los 36500 días.");
            }
            if (Object.values(CLAVES_VIGENCIA_PUBLICACIONES).some(([, , , anticipacion]) => anticipacion === nombre) && Number(valor) > MAXIMO_DIAS_ANTICIPACION_PUBLICACIONES) {
                throw new Error(`La anticipación no puede superar los ${MAXIMO_DIAS_ANTICIPACION_PUBLICACIONES} días.`);
            }
        }
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
    for (const clave of claves) validarValor(clave, cambios[clave]);
    const habilitado = cambios[claveHabilitado] === "true";
    const esVigenciaFotos = Object.values(CLAVES_AGING_FOTOS).some((clavesFotos) => clavesFotos[1] === claveVigencia);
    const avisosActivos = (!esVigenciaFotos || habilitado) && cambios[claveAvisos] === "true";
    if (habilitado) {
        if (cambios[claveVigencia] === "") {
            throw new Error("Ingresá y guardá los días de vigencia antes de activar el vencimiento.");
        }
        validarDias(cambios[claveVigencia], "vigencia");
    }
    if (avisosActivos) {
        if (cambios[claveAnticipacion] === "") {
            throw new Error("Ingresá y guardá los días de anticipación antes de activar los avisos.");
        }
        validarDias(cambios[claveAnticipacion], "anticipación");
    }
    if (habilitado && avisosActivos && Number(cambios[claveAnticipacion]) >= Number(cambios[claveVigencia])) {
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
    const gruposModificados = gruposVigencia.filter((claves) => claves.some((clave) => Object.hasOwn(cambios, clave)));
    for (const claves of gruposModificados) {
        if (claves.every((clave) => Object.hasOwn(cambios, clave))) {
            validarVigencia(cambios, claves);
        }
    }

    const politicasModificadas = Object.entries(CLAVES_VIGENCIA_PUBLICACIONES)
        .filter(([, claves]) => claves.some((clave) => Object.hasOwn(cambios, clave)));

    await db.transaction(async (tx) => {
        let anteriores: Record<string, string> = {};
        let efectivos = cambios;
        if (gruposModificados.length > 0) {
            await bloquearCambioVigenciaPublicaciones(tx);
            const claves = gruposModificados.flatMap((grupo) => [...grupo]);
            const filas = await tx.orm.public.Configuracion
                .where((configuracion) => configuracion.nombreConfiguracion.in(claves))
                .select("nombreConfiguracion", "valorConfiguracion")
                .all();
            anteriores = Object.fromEntries(filas.map(({ nombreConfiguracion, valorConfiguracion }) => [nombreConfiguracion, valorConfiguracion]));
            for (const clave of claves) {
                if (!Object.hasOwn(anteriores, clave)) throw new Error(`No existe la configuración ${clave}.`);
            }
            efectivos = { ...anteriores, ...cambios };
            for (const grupo of gruposModificados) validarVigencia(efectivos, grupo);
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
        for (const [tipo, [claveHabilitada, claveDias]] of politicasModificadas) {
            if (efectivos[claveHabilitada] !== "true") continue;
            const diasVigencia = Number(efectivos[claveDias]);
            if (anteriores[claveHabilitada] === "true" && Number(anteriores[claveDias]) === diasVigencia) continue;
            const fechaMaxima = calcularFechaMaximaVigencia(diasVigencia);
            const limite = convertirFechaVigenciaAInstant(fechaMaxima)!.toString();
            // El cambio de política no renueva la fecha de actualización ni la disponibilidad.
            await tx.execute(db.raw.sql`
                UPDATE publicacion
                SET "fechaVigencia" = ${limite}::timestamptz
                WHERE "tipoPublicacion"::text = ${tipo}
                    AND ("fechaVigencia" IS NULL OR "fechaVigencia" > ${limite}::timestamptz)
            `.affectedCount().build());
        }
    });
}
