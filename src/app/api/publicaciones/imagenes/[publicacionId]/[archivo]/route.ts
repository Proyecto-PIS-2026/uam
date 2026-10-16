import { responderImagen } from "@/infraestructura/imagenes/respuesta-imagen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_pedido: Request, contexto: {
    params: Promise<{ publicacionId: string; archivo: string }>;
}): Promise<Response> {
    const { publicacionId, archivo } = await contexto.params;
    return responderImagen("publicaciones", publicacionId, archivo);
}
