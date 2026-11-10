import { Temporal } from "@js-temporal/polyfill";

export type LocalOperadorValidado = {
    numeroLocal: string;
    naveId: number;
    contrato: string;
};

const REGLAS_TELEFONO: Record<string, RegExp> = {
    "+598": /^9\d{7}$/,
    "+54": /^\d{10,11}$/,
    "+55": /^\d{10,11}$/,
    "+56": /^9\d{8}$/,
    "+595": /^9\d{8}$/,
};

export const textoOperador = (valor: unknown): string =>
    typeof valor === "string" ? valor.trim() : "";

export function validarDatosOperador(
    datos: Record<string, unknown>,
    campoNumeroLocal: "numeroLocal" | "nombre",
    errores: string[],
) {
    const nombre = textoOperador(datos.nombre);
    const codigoPais = textoOperador(datos.codigoPais);
    const numero = textoOperador(datos.telefono).replace(/[\s().-]/g, "").replace(/^0+/, "");
    const reglaTelefono = Object.hasOwn(REGLAS_TELEFONO, codigoPais) ? REGLAS_TELEFONO[codigoPais] : undefined;

    if (!nombre) errores.push("El nombre es obligatorio.");
    if (nombre === "." || nombre === "..") errores.push('El nombre no puede ser "." ni "..".');
    if (nombre.includes("%")) errores.push("El nombre del operador no puede contener %.");
    if (!reglaTelefono) errores.push("El código de país no es válido.");
    if (reglaTelefono && !reglaTelefono.test(numero)) errores.push("El teléfono no es válido.");

    const localesCrudos = Array.isArray(datos.locales) ? datos.locales : [];
    if (!localesCrudos.length) errores.push("Debe haber al menos un local.");
    const clavesVistas = new Set<string>();
    const locales: LocalOperadorValidado[] = localesCrudos.map((valor, indice) => {
        const local = valor && typeof valor === "object" && !Array.isArray(valor)
            ? valor as Record<string, unknown>
            : {};
        const numeroLocal = textoOperador(local[campoNumeroLocal]);
        const contrato = textoOperador(local.contrato);
        const naveId = local.naveId;
        if (!numeroLocal) errores.push(`Local ${indice + 1}: falta el número.`);
        else if (!/^[0-9]+$/.test(numeroLocal)) errores.push(`Local ${indice + 1}: el número debe contener solo dígitos.`);
        if (contrato) {
            try {
                Temporal.PlainDate.from(contrato);
            } catch {
                errores.push(`Local ${indice + 1}: la fecha de fin de contrato no es válida.`);
            }
        }
        if (typeof naveId !== "number" || !Number.isSafeInteger(naveId) || naveId <= 0) {
            errores.push(`Local ${indice + 1}: seleccioná una nave.`);
        }
        const clave = `${naveId}|${numeroLocal}`;
        if (clavesVistas.has(clave)) {
            errores.push(`Local ${indice + 1}: está repetido en el formulario (mismo número en la misma nave).`);
        }
        clavesVistas.add(clave);
        return { numeroLocal, naveId: naveId as number, contrato };
    });
    return { nombre, telefono: codigoPais + numero, locales };
}
