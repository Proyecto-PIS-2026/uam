export type DatosModificacionOperador = {
    operadorId: number;
    nombre: string;
    telefono: string;
    contraseña: string | null;
    locales: {
        nombre: string;
        naveId: number;
        contrato: string;
    }[];
};

export type ResultadoValidacionModificacion =
    | {
          esValido: true;
          datos: DatosModificacionOperador;
      }
    | {
          esValido: false;
          errores: string[];
      };

const CODIGOS_PAIS = ["+598", "+54", "+55", "+56", "+595"];

const texto = (valor: unknown) =>
    typeof valor === "string" ? valor.trim() : "";

export function validarModificacionOperador(
    valor: unknown,
): ResultadoValidacionModificacion {
    if (
        typeof valor !== "object" ||
        valor === null ||
        Array.isArray(valor)
    ) {
        return {
            esValido: false,
            errores: ["Los datos del operador no son válidos."],
        };
    }

    const datos = valor as Record<string, unknown>;
    const errores: string[] = [];

    const operadorId = datos.operadorId;
    const nombre = texto(datos.nombre);
    const codigoPais = texto(datos.codigoPais);

    const numeroSinCodigo = texto(datos.telefono)
        .replace(/[\s-]/g, "")
        .replace(/^0+/, "");

    const telefono = codigoPais + numeroSinCodigo;

    const contraseña =
        typeof datos.contraseña === "string"
            ? datos.contraseña
            : "";

    const confirmacion =
        typeof datos.confirmacionContraseña === "string"
            ? datos.confirmacionContraseña
            : "";

    if (
        typeof operadorId !== "number" ||
        !Number.isSafeInteger(operadorId) ||
        operadorId <= 0
    ) {
        errores.push("El operador no es válido.");
    }

    if (!nombre) {
        errores.push("El nombre es obligatorio.");
    }

    if (!CODIGOS_PAIS.includes(codigoPais)) {
        errores.push("El código de país no es válido.");
    }

    if (!/^\d{7,12}$/.test(numeroSinCodigo)) {
        errores.push("El teléfono no es válido.");
    }

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

    const localesCrudos = Array.isArray(datos.locales)
        ? datos.locales
        : [];

    if (localesCrudos.length < 1) {
        errores.push("Debe haber al menos un local.");
    }

    const locales = localesCrudos.map((local, i) => {
        const l =
            typeof local === "object" && local !== null
                ? (local as Record<string, unknown>)
                : {};

        const nombreLocal = texto(l.nombre);
        const contrato = texto(l.contrato);
        const naveId = l.naveId;

        if (!nombreLocal) {
            errores.push(`Local ${i + 1}: falta el nombre.`);
        }

        if (contrato) {
            try {
                Temporal.PlainDate.from(contrato);
            } catch {
                errores.push(
                    `Local ${i + 1}: la fecha de fin de contrato no es válida.`,
                );
            }
        }

        if (
            typeof naveId !== "number" ||
            !Number.isSafeInteger(naveId) ||
            naveId <= 0
        ) {
            errores.push(
                `Local ${i + 1}: seleccioná una nave.`,
            );
        }

        return {
            nombre: nombreLocal,
            naveId: naveId as number,
            contrato,
        };
    });

    const clavesVistas = new Set<string>();

    locales.forEach((local, i) => {
        const clave = `${local.naveId}|${local.nombre}`;

        if (clavesVistas.has(clave)) {
            errores.push(
                `Local ${i + 1}: está repetido en el formulario (mismo número en la misma nave).`,
            );
        }

        clavesVistas.add(clave);
    });

    if (errores.length > 0) {
        return {
            esValido: false,
            errores,
        };
    }

    return {
        esValido: true,
        datos: {
            operadorId: operadorId as number,
            nombre,
            telefono,
            contraseña: contraseña || null,
            locales,
        },
    };
}