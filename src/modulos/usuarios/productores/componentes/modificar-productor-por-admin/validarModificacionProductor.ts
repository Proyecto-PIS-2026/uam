export type DatosModificacionProductor = {
    productorId: number;
    nombre: string;
    telefono: string;
    contraseña: string | null;
};

export type ResultadoValidacionModificacionProductor =
    | {
          esValido: true;
          datos: DatosModificacionProductor;
      }
    | {
          esValido: false;
          errores: string[];
      };

const CODIGOS_PAIS = ["+598", "+54", "+55", "+56", "+595"];
const REGLAS_TELEFONO: Record<string, RegExp> = {
    "+598": /^9\d{7}$/,
    "+54": /^\d{10,11}$/,
    "+55": /^\d{10,11}$/,
    "+56": /^9\d{8}$/,
    "+595": /^9\d{8}$/,
};

const texto = (valor: unknown) =>
    typeof valor === "string" ? valor.trim() : "";

export function validarModificacionProductor(
    valor: unknown,
): ResultadoValidacionModificacionProductor {
    if (
        typeof valor !== "object" ||
        valor === null ||
        Array.isArray(valor)
    ) {
        return {
            esValido: false,
            errores: ["Los datos del productor no son válidos."],
        };
    }

    const datos = valor as Record<string, unknown>;
    const errores: string[] = [];

    const productorId = datos.productorId;
    const nombre = texto(datos.nombre);
    const codigoPais = texto(datos.codigoPais);

    const numeroSinCodigo = texto(datos.telefono)
        .replace(/[\s().-]/g, "")
        .replace(/^0+/, "");

    const contraseña =
        typeof datos.contraseña === "string"
            ? datos.contraseña
            : "";

    const confirmacion =
        typeof datos.confirmacionContraseña === "string"
            ? datos.confirmacionContraseña
            : "";

    if (
        typeof productorId !== "number" ||
        !Number.isSafeInteger(productorId) ||
        productorId <= 0
    ) {
        errores.push("El productor no es válido.");
    }

    if (!nombre) {
        errores.push("El nombre es obligatorio.");
    }

    if (!CODIGOS_PAIS.includes(codigoPais)) {
        errores.push("El código de país no es válido.");
    }
    const reglaTelefono = REGLAS_TELEFONO[codigoPais];
    if (reglaTelefono && !reglaTelefono.test(numeroSinCodigo)) errores.push("El teléfono no es válido.");

    if (contraseña || confirmacion) {
        if (contraseña.length < 8) {
            errores.push(
                "La contraseña debe tener al menos 8 caracteres.",
            );
        }

        if (contraseña !== confirmacion) {
            errores.push("Las contraseñas no coinciden.");
        }
    }

    if (errores.length > 0) {
        return {
            esValido: false,
            errores,
        };
    }

    return {
        esValido: true,
        datos: {
            productorId: productorId as number,
            nombre,
            telefono: codigoPais + numeroSinCodigo,
            contraseña: contraseña || null,
        },
    };
}