import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { ErrorAutorizacion } from "@/modulos/identidad-acceso/autorizacion/controles";
import { obtenerOpcionesEdicionPublicacion } from "@/modulos/publicaciones/operadores/consultas-edicion-publicacion";
import { ErrorEdicionPublicacionProductor, modificarPublicacionProductor, obtenerPublicacionProductorEditable } from "@/modulos/publicaciones/productores/modificar-publicacion";

export const runtime = "nodejs";
type Contexto = { params: Promise<{ id: string }> };

function respuestaError(error: unknown) {
    if (error instanceof ErrorAutorizacion) return NextResponse.json({ errores: [error.message] }, { status: error.status });
    if (error instanceof ErrorEdicionPublicacionProductor) {
        return NextResponse.json({ errores: [error.message] }, { status: error.codigo === "NO_ENCONTRADA" ? 404 : 400 });
    }
    console.error("Error al editar publicación del productor:", error);
    return NextResponse.json({ errores: ["No se pudo procesar la publicación."] }, { status: 500 });
}

async function contextoAutorizado(contexto: Contexto) {
    const sesion = await obtenerSesion();
    if (!sesion) throw new ErrorAutorizacion(401, "Debe iniciar sesión.");
    if (sesion.rol !== "PRODUCTOR" && sesion.rol !== "ADMINISTRADOR") throw new ErrorAutorizacion(403, "No tenés permiso para modificar esta publicación.");
    const { id } = await contexto.params;
    const publicacionProductorId = Number(id);
    if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(publicacionProductorId) || publicacionProductorId > 2147483647) {
        throw new ErrorEdicionPublicacionProductor("DATOS_INVALIDOS", "La publicación no es válida.");
    }
    return { sesion, publicacionProductorId };
}

export async function GET(_solicitud: Request, contexto: Contexto) {
    try {
        const { sesion, publicacionProductorId } = await contextoAutorizado(contexto);
        await obtenerPublicacionProductorEditable(sesion, publicacionProductorId);
        return NextResponse.json({ opciones: await obtenerOpcionesEdicionPublicacion() });
    } catch (error) {
        return respuestaError(error);
    }
}

export async function PATCH(solicitud: Request, contexto: Contexto) {
    try {
        const { sesion, publicacionProductorId } = await contextoAutorizado(contexto);
        let cambios: unknown;
        let foto: File | null;
        try {
            const formulario = await solicitud.formData();
            const datos = formulario.get("cambios");
            const archivo = formulario.get("foto");
            if (typeof datos !== "string" || typeof archivo === "string") throw new Error("Formato inválido");
            cambios = JSON.parse(datos);
            foto = archivo;
        } catch {
            throw new ErrorEdicionPublicacionProductor("DATOS_INVALIDOS", "No se pudieron leer los cambios de la publicación.");
        }
        const resultado = await modificarPublicacionProductor(sesion, publicacionProductorId, cambios, foto);
        for (const ruta of ["/mi-mercado/productor", `/gestion-productores/${resultado.productorId}`, "/publicaciones-productor", "/inicio"]) {
            try {
                revalidatePath(ruta);
            } catch (error) {
                console.error(`No se pudo revalidar ${ruta} tras guardar la publicación:`, error);
            }
        }
        return NextResponse.json({ publicacion: resultado.publicacion });
    } catch (error) {
        return respuestaError(error);
    }
}
