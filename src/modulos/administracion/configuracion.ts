// Modelo local de la vista: no define claves ni contratos de persistencia.
export type ClaveConfiguracion =
    "ordenamiento" | "incremento" | "lista" | "fotografias";
export type ConfiguracionPanel = Record<ClaveConfiguracion, string | null>;
export type Resultado<T> =
    { ok: true; valor: T } | { ok: false; mensaje: string };

export function validarConfiguracion(
    clave: ClaveConfiguracion,
    entrada: unknown,
): Resultado<string> {
    if (typeof entrada !== "string")
        return { ok: false, mensaje: "Ingresá un valor válido." };
    const valor = entrada.trim();
    if (clave === "ordenamiento")
        return valor === "true" || valor === "false"
            ? { ok: true, valor }
            : { ok: false, mensaje: "Seleccioná habilitado o deshabilitado." };
    if (clave === "lista") {
        if (!valor)
            return {
                ok: false,
                mensaje:
                    "Ingresá una URL. La Lista Inteligente todavía no está configurada.",
            };
        try {
            const url = new URL(valor);
            if (
                !["https:", "http:"].includes(url.protocol) ||
                !url.hostname ||
                url.username ||
                url.password
            )
                throw new Error();
            return { ok: true, valor: url.href };
        } catch {
            return {
                ok: false,
                mensaje:
                    "Ingresá una URL válida que comience con https:// o http://.",
            };
        }
    }
    const numero = Number(valor);
    if (
        !/^\d+(\.\d+)?$/.test(valor) ||
        !Number.isFinite(numero) ||
        numero <= 0
    ) {
        return { ok: false, mensaje: "Ingresá un número mayor que cero." };
    }
    if (clave === "fotografias" && !Number.isSafeInteger(numero)) {
        return {
            ok: false,
            mensaje: "Ingresá una cantidad entera de días mayor que cero.",
        };
    }
    if (
        clave === "incremento" &&
        (numero > 9_999_999_999 || (valor.split(".")[1]?.length ?? 0) > 2)
    ) {
        return {
            ok: false,
            mensaje:
                "El importe admite hasta dos decimales y un máximo de 9.999.999.999.",
        };
    }
    return { ok: true, valor: String(numero) };
}

export function estadoEnlace(
    valor: string | null,
): "ausente" | "invalido" | "valido" {
    if (valor === null || !valor.trim()) return "ausente";
    return validarConfiguracion("lista", valor).ok ? "valido" : "invalido";
}

export type OperadorAdministrable = {
    id: number;
    nombreFantasia: string;
    disponible: boolean;
    locales: { id: number; nombre: string; finContrato: string | null }[];
};
export type CuentaAdministrable = {
    id: number;
    username: string;
    rol: "OPERADOR" | "PRODUCTOR";
    twoFactorEnabled: boolean;
};
export type DatosPanel = {
    configuracion: ConfiguracionPanel;
    operadores: OperadorAdministrable[];
    cuentas: CuentaAdministrable[];
};
export type CambioOperador = {
    id: number;
    disponible: boolean;
    locales: { id: number; finContrato: string | null }[];
};
