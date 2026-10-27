import { responderImagen } from "@/infraestructura/imagenes/respuesta-imagen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_pedido: Request, contexto: {
    params: Promise<{ categoria: string; id: string; archivo: string }>;
}): Promise<Response> {
    const { categoria, id, archivo } = await contexto.params;
    if (categoria === "publicaciones") return new Response("Imagen no encontrada", { status: 404 });
    return responderImagen(categoria, id, archivo);
}
