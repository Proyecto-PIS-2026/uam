import { notFound } from "next/navigation";
import VistaMiMercado from "../../../../modulos/publicaciones/mi-mercado/componentes/VistaMiMercado";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ nombre: string }> }) {
    // Next entrega los parámetros de ruta ya decodificados.
    const { nombre } = await params;
    if (!nombre.trim()) notFound();

    return <VistaMiMercado operadorNombre={nombre} />;
}
