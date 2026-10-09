
import { NextResponse } from "next/server";

import {
    actualizarConfiguracion,
    obtenerConfiguracion,
} from "@/modulos/administracion/consulta-configuracion";

export const runtime = "nodejs";

type Contexto = {
    params: Promise<{ nombre: string }>;
};

const CONFIGURACIONES_PERMITIDAS = [
    "url_lista_inteligente",
    "incremento_precio",
    "vigencia_fotografias",
    "ordenamiento_habilitado",
];

function validarConfiguracion(nombre: string, valor: string): string | null {
    if (!CONFIGURACIONES_PERMITIDAS.includes(nombre)) {
        return "La configuración indicada no es válida.";
    }

    if (nombre === "url_lista_inteligente") {
        if (valor === "") {
            return null;
        }

        if (valor !== valor.trim()) {
            return "La URL no puede contener espacios al principio o al final.";
        }

        try {
            const url = new URL(valor);

            if (
                url.protocol !== "http:" &&
                url.protocol !== "https:"
            ) {
                return "La URL debe comenzar con http:// o https://.";
            }

            if (!url.hostname) {
                return "La URL de la Lista Inteligente no es válida.";
            }
        } catch {
            return "La URL de la Lista Inteligente no es válida.";
        }

        return null;
    }

    if (
        nombre === "incremento_precio" ||
        nombre === "vigencia_fotografias"
    ) {
        if (!/^[0-9]+$/.test(valor)) {
            return "El valor debe ser un número entero positivo.";
        }

        const numero = Number(valor);

        if (!Number.isSafeInteger(numero) || numero <= 0) {
            return "El valor debe ser un número entero mayor a cero.";
        }

        return null;
    }

    if (nombre === "ordenamiento_habilitado") {
        if (valor !== "true" && valor !== "false") {
            return "El ordenamiento debe estar habilitado o deshabilitado.";
        }

        return null;
    }

    return "La configuración indicada no es válida.";
}

export async function GET(
    _solicitud: Request,
    contexto: Contexto,
) {
    const { nombre } = await contexto.params;

    try {
        const valor = await obtenerConfiguracion(nombre);

        if (valor === null) {
            return NextResponse.json(
                { errores: ["No se encontró la configuración."] },
                { status: 404 },
            );
        }

        return NextResponse.json({
            nombre,
            valor,
        });
    } catch (error) {
        console.error("Error al obtener la configuración:", error);

        return NextResponse.json(
            { errores: ["No se pudo obtener la configuración."] },
            { status: 500 },
        );
    }
}

export async function PATCH(
    solicitud: Request,
    contexto: Contexto,
) {
    const { nombre } = await contexto.params;

    let cuerpo: unknown;

    try {
        cuerpo = await solicitud.json();
    } catch {
        return NextResponse.json(
            { errores: ["Los datos no son válidos."] },
            { status: 400 },
        );
    }

    if (
        typeof cuerpo !== "object" ||
        cuerpo === null ||
        Array.isArray(cuerpo)
    ) {
        return NextResponse.json(
            { errores: ["Los datos no son válidos."] },
            { status: 400 },
        );
    }

    const { valor } = cuerpo as Record<string, unknown>;

    if (typeof valor !== "string") {
        return NextResponse.json(
            { errores: ["El valor no es válido."] },
            { status: 400 },
        );
    }

    const errorValidacion = validarConfiguracion(nombre, valor);

    if (errorValidacion !== null) {
        return NextResponse.json(
            { errores: [errorValidacion] },
            { status: 400 },
        );
    }

    try {
        const valorGuardado = await actualizarConfiguracion(
            nombre,
            valor,
        );

        return NextResponse.json({
            nombre,
            valor: valorGuardado,
            mensaje: "Configuración modificada correctamente.",
        });
    } catch (error) {
        console.error("Error al modificar la configuración:", error);

        return NextResponse.json(
            { errores: ["No se pudo modificar la configuración."] },
            { status: 500 },
        );
    }
}
