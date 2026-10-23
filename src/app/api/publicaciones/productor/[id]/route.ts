import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { ErrorAutorizacion } from "@/modulos/identidad-acceso/autorizacion/controles";
import { bajaPublicacionProductorAutorizada, ErrorBajaPublicacionProductor } from "@/modulos/publicaciones/productores/bajaPublicacionProductorAutorizada";

export const runtime = "nodejs";
type Contexto = { params: Promise<{ id: string }> };

export async function DELETE(_solicitud: Request, contexto: Contexto) {
    try {
        const sesion = await obtenerSesion();
        if (!sesion) throw new ErrorAutorizacion(401, "Debe iniciar sesión.");
        const { id } = await contexto.params;
        const publicacionProductorId = Number(id);
        if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(publicacionProductorId) || publicacionProductorId > 2147483647) {
            return NextResponse.json({ errores: ["La publicación no es válida."] }, { status: 400 });
        }
        const { productorId } = await bajaPublicacionProductorAutorizada(sesion, publicacionProductorId);
        for (const ruta of ["/mi-mercado/productor", `/gestion-productores/${productorId}`, "/publicaciones-productor", "/inicio"]) {
            try {
                revalidatePath(ruta);
            } catch (error) {
                console.error(`No se pudo revalidar ${ruta} tras eliminar la publicación:`, error);
            }
        }
        return NextResponse.json({ mensaje: "Publicación eliminada correctamente." });
    } catch (error) {
        if (error instanceof ErrorAutorizacion) {
            return NextResponse.json({ errores: [error.message] }, { status: error.status });
        }
        if (error instanceof ErrorBajaPublicacionProductor) {
            return NextResponse.json({ errores: [error.message] }, { status: error.status });
        }
        console.error("Error al eliminar publicación del productor:", error);
        return NextResponse.json({ errores: ["No se pudo eliminar la publicación."] }, { status: 500 });
    }
}