import { CLAVES_AGING_FOTOS } from "@/modulos/publicaciones/claves-aging-fotos";
import { CLAVES_VIGENCIA_PUBLICACIONES, MAXIMO_DIAS_ANTICIPACION_PUBLICACIONES } from "@/modulos/publicaciones/claves-vigencia-publicaciones";
import { CLAVE_ANTICIPACION_AVISO_LOCALES, CLAVE_HABILITACION_AVISO_LOCALES, DIAS_ANTICIPACION_AVISO_LOCALES, validarAnticipacionAvisoLocales } from "@/modulos/usuarios/operadores/configuracion-avisos-locales";

const gruposVigencia = [
    { claves: CLAVES_AGING_FOTOS.OPERADOR, fotos: true },
    { claves: CLAVES_AGING_FOTOS.PRODUCTOR, fotos: true },
    { claves: CLAVES_VIGENCIA_PUBLICACIONES.OPERADOR, fotos: false },
    { claves: CLAVES_VIGENCIA_PUBLICACIONES.PRODUCTOR, fotos: false },
];

const ordenes = ["mas_vendidas", "nombre_asc", "nombre_desc", "menor_precio", "mayor_precio", "mas_actualizadas"];

export function normalizarConfiguracion(configuracion: Record<string, string | null>): Record<string, string> {
    const valores: Record<string, string> = {
        url_lista_inteligente: configuracion.url_lista_inteligente ?? "",
        incremento_precio: configuracion.incremento_precio ?? "",
        ordenamiento_habilitado: String(configuracion.ordenamiento_habilitado === "true"),
        restablecimiento_contrasena_habilitado: String(configuracion.restablecimiento_contrasena_habilitado === "true"),
        [CLAVE_HABILITACION_AVISO_LOCALES]: String(configuracion[CLAVE_HABILITACION_AVISO_LOCALES] !== "false"),
        [CLAVE_ANTICIPACION_AVISO_LOCALES]: configuracion[CLAVE_ANTICIPACION_AVISO_LOCALES] ?? String(DIAS_ANTICIPACION_AVISO_LOCALES),
    };
    for (const clave of ["orden_landing_page_default", "orden_mercado_virtual_default", "orden_mercado_produccion_default"]) {
        const valor = configuracion[clave] ?? "";
        const permitidos = clave === "orden_landing_page_default" ? ordenes.slice(0, 3) : ordenes;
        valores[clave] = permitidos.includes(valor) ? valor : "mas_vendidas";
    }
    for (const { claves: [habilitado, vigencia, avisos, anticipacion] } of gruposVigencia) {
        valores[habilitado] = String(configuracion[habilitado] === "true");
        valores[avisos] = String(configuracion[avisos] === "true");
        valores[vigencia] = configuracion[vigencia] ?? "";
        valores[anticipacion] = configuracion[anticipacion] ?? "";
    }
    return valores;
}

export function validarBorradorConfiguracion(valores: Record<string, string>, cambios: Record<string, string>) {
    const errores: Record<string, boolean> = {};
    const normalizados = { ...cambios };
    let mensaje = "";
    let faltantes = false;
    function invalidar(clave: string, detalle: string) {
        errores[clave] = true;
        if (!mensaje) mensaje = detalle;
        if (!valores[clave]?.trim()) faltantes = true;
    }
    function validarDias(clave: string, etiqueta: string, requerido: boolean, maximo?: number) {
        const valor = valores[clave];
        if (!requerido && valor === "") return;
        if (!/^[0-9]+$/.test(valor) || !Number.isSafeInteger(Number(valor)) || Number(valor) <= 0) {
            invalidar(clave, `La ${etiqueta} debe ser un número entero mayor que cero.`);
        } else if (maximo !== undefined && Number(valor) > maximo) {
            invalidar(clave, `La ${etiqueta} no puede superar los ${maximo} días.`);
        } else if (Object.hasOwn(cambios, clave)) {
            normalizados[clave] = String(Number(valor));
        }
    }
    if (Object.hasOwn(cambios, "url_lista_inteligente")) {
        const valor = valores.url_lista_inteligente;
        try {
            const url = new URL(valor);
            if (valor !== valor.trim() || !["http:", "https:"].includes(url.protocol) || !url.hostname || !url.pathname.toLowerCase().endsWith(".pdf")) throw new Error();
        } catch {
            invalidar("url_lista_inteligente", "La URL de la Lista Inteligente no es válida. Debe ser un enlace HTTP o HTTPS a un archivo PDF.");
        }
    }
    if (Object.hasOwn(cambios, "incremento_precio")) {
        const valor = valores.incremento_precio;
        if (!/^[0-9]+$/.test(valor) || !Number.isSafeInteger(Number(valor)) || Number(valor) <= 0) {
            invalidar("incremento_precio", "El importe debe ser un número entero mayor que cero.");
        } else {
            normalizados.incremento_precio = String(Number(valor));
        }
    }
    for (const { claves, fotos } of gruposVigencia) {
        if (!claves.some((clave) => Object.hasOwn(cambios, clave))) continue;
        const [habilitado, vigencia, avisos, anticipacion] = claves;
        const activo = valores[habilitado] === "true";
        const notifica = (!fotos || activo) && valores[avisos] === "true";
        validarDias(vigencia, "vigencia", activo, fotos ? 36500 : undefined);
        validarDias(anticipacion, "anticipación", notifica, fotos ? undefined : MAXIMO_DIAS_ANTICIPACION_PUBLICACIONES);
        if (activo && notifica && !errores[vigencia] && !errores[anticipacion] && Number(valores[anticipacion]) >= Number(valores[vigencia])) {
            invalidar(anticipacion, "La anticipación debe ser menor que la vigencia.");
        }
    }
    if (Object.hasOwn(cambios, CLAVE_ANTICIPACION_AVISO_LOCALES)
        || Object.hasOwn(cambios, CLAVE_HABILITACION_AVISO_LOCALES) && valores[CLAVE_HABILITACION_AVISO_LOCALES] === "true") {
        try {
            validarAnticipacionAvisoLocales(valores[CLAVE_ANTICIPACION_AVISO_LOCALES]);
            if (Object.hasOwn(cambios, CLAVE_ANTICIPACION_AVISO_LOCALES)) {
                normalizados[CLAVE_ANTICIPACION_AVISO_LOCALES] = String(Number(valores[CLAVE_ANTICIPACION_AVISO_LOCALES]));
            }
        } catch (error) {
            invalidar(CLAVE_ANTICIPACION_AVISO_LOCALES, error instanceof Error ? error.message : "La anticipación del aviso de locales no es válida.");
        }
    }
    return { errores, cambios: normalizados, mensaje: faltantes ? "Faltan completar campos." : mensaje };
}
