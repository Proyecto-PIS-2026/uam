import { NextResponse } from "next/server";

import { actualizarConfiguracion, obtenerConfiguracion } from "@/modulos/administracion/consulta-configuracion";

export const runtime = "nodejs";

type Contexto = {
    params: Promise<{ nombre: string }>;
};

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