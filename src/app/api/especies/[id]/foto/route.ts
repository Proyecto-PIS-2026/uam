import { NextResponse } from "next/server";

import {
    eliminarFotoEspecie,
    ErrorImagenEspecie,
    guardarFotoEspecie,
} from "@/modulos/administracion/imagenes-especies";

export const runtime = "nodejs";

type Contexto = {
    params: Promise<{ id: string }>;
};

export async function PATCH(
    solicitud: Request,
    contexto: Contexto,
) {
    const { id: identificador } = await contexto.params;
    const especieId = Number(identificador);

    if (
        !Number.isSafeInteger(especieId) ||
        especieId <= 0
    ) {
        return NextResponse.json(
            { errores: ["La especie no es válida."] },
            { status: 400 },
        );
    }

    let archivo: File;

    try {
        const formulario = await solicitud.formData();
        const fotografia = formulario.get("fotografia");

        if (
            !(fotografia instanceof File) ||
            fotografia.size === 0
        ) {
            return NextResponse.json(
                { errores: ["La fotografía no es válida."] },
                { status: 400 },
            );
        }

        archivo = fotografia;
    } catch {
        return NextResponse.json(
            { errores: ["No se pudo leer la fotografía."] },
            { status: 400 },
        );
    }

    try {
        const fotoEspecie = await guardarFotoEspecie(
            especieId,
            archivo,
        );

        return NextResponse.json({
            fotoEspecie,
            mensaje: "Fotografía modificada correctamente.",
        });
    } catch (error) {
        if (error instanceof ErrorImagenEspecie) {
            return NextResponse.json(
                { errores: [error.message] },
                { status: 400 },
            );
        }

        console.error(
            "Error al modificar la fotografía de la especie:",
            error,
        );

        return NextResponse.json(
            {
                errores: [
                    "No se pudo modificar la fotografía de la especie.",
                ],
            },
            { status: 500 },
        );
    }
}

export async function DELETE(
    _solicitud: Request,
    contexto: Contexto,
) {
    const { id: identificador } = await contexto.params;
    const especieId = Number(identificador);

    if (
        !Number.isSafeInteger(especieId) ||
        especieId <= 0
    ) {
        return NextResponse.json(
            { errores: ["La especie no es válida."] },
            { status: 400 },
        );
    }

    try {
        await eliminarFotoEspecie(especieId);

        return NextResponse.json({
            mensaje: "Fotografía eliminada correctamente.",
        });
    } catch (error) {
        if (error instanceof ErrorImagenEspecie) {
            return NextResponse.json(
                { errores: [error.message] },
                { status: 400 },
            );
        }

        console.error(
            "Error al eliminar la fotografía de la especie:",
            error,
        );

        return NextResponse.json(
            {
                errores: [
                    "No se pudo eliminar la fotografía de la especie.",
                ],
            },
            { status: 500 },
        );
    }
}