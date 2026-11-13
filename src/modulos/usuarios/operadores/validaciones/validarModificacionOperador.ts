import { validarDatosOperador } from "./validarDatosOperador";
import { Temporal } from "@js-temporal/polyfill";

export type DatosModificacionOperador = {
    operadorId: number;
    nombre: string;
    telefono: string;
    enLicencia: boolean;
    inicioLicencia: string | null;
    finLicencia: string | null;
    comentario: string | null;
    contraseña: string | null;
    locales: { nombre: string; naveId: number; contrato: string }[];
};

export type ResultadoValidacionModificacion =
    | { esValido: true; datos: DatosModificacionOperador }
    | { esValido: false; errores: string[] };

export function validarModificacionOperador(valor: unknown): ResultadoValidacionModificacion {
    if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
        return { esValido: false, errores: ["Los datos del operador no son válidos."] };
    }
    const datos = valor as Record<string, unknown>;
    const errores: string[] = [];
    const operadorId = datos.operadorId;
    if (typeof operadorId !== "number" || !Number.isSafeInteger(operadorId) || operadorId <= 0) {
        errores.push("El operador no es válido.");
    }
    const comunes = validarDatosOperador(datos, "nombre", errores);
    const contraseña = typeof datos.contraseña === "string" ? datos.contraseña : "";
    const confirmacion = typeof datos.confirmacionContraseña === "string" ? datos.confirmacionContraseña : "";
    if (contraseña || confirmacion) {
        if (contraseña.length < 8) errores.push("La contraseña debe tener al menos 8 caracteres.");
        if (contraseña !== confirmacion) errores.push("Las contraseñas no coinciden.");
    }
    const enLicencia = datos.enLicencia === true;
    const inicioLicencia = typeof datos.inicioLicencia === "string" && /^\d{4}-\d{2}-\d{2}$/.test(datos.inicioLicencia) ? datos.inicioLicencia : null;
    const finLicencia = typeof datos.finLicencia === "string" && /^\d{4}-\d{2}-\d{2}$/.test(datos.finLicencia) ? datos.finLicencia : null;
    if (enLicencia && (!inicioLicencia || !finLicencia)) errores.push("Ingresá las fechas de inicio y fin de la licencia.");
    if (enLicencia && inicioLicencia && finLicencia) {
        try {
            const inicio = Temporal.PlainDate.from(inicioLicencia);
            const fin = Temporal.PlainDate.from(finLicencia);
            if (Temporal.PlainDate.compare(inicio, fin) > 0) errores.push("La fecha de inicio no puede ser posterior a la fecha de fin.");
        } catch {
            errores.push("Las fechas de licencia no son válidas.");
        }
    }
    const comentarioIngresado = typeof datos.comentario === "string" ? datos.comentario.trim() : "";
    if (errores.length) return { esValido: false, errores };
    return {
        esValido: true,
        datos: {
            operadorId: operadorId as number,
            nombre: comunes.nombre,
            telefono: comunes.telefono,
            enLicencia,
            inicioLicencia,
            finLicencia,
            comentario: enLicencia && inicioLicencia && finLicencia
                ? `Licencia: ${inicioLicencia} - ${finLicencia}\n\n${comentarioIngresado}`
                : null,
            contraseña: contraseña || null,
            locales: comunes.locales.map(({ numeroLocal, ...local }) => ({ nombre: numeroLocal, ...local })),
        },
    };
}
