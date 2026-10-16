import { validarDatosOperador } from "./validarDatosOperador";

export type DatosModificacionOperador = {
    operadorId: number;
    nombre: string;
    telefono: string;
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
    if (errores.length) return { esValido: false, errores };
    return {
        esValido: true,
        datos: {
            operadorId: operadorId as number,
            nombre: comunes.nombre,
            telefono: comunes.telefono,
            contraseña: contraseña || null,
            locales: comunes.locales.map(({ numeroLocal, ...local }) => ({ nombre: numeroLocal, ...local })),
        },
    };
}
