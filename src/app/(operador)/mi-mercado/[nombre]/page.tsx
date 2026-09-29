import { notFound } from "next/navigation";
import VistaMiMercado from "../../../../modulos/publicaciones/mi-mercado/componentes/VistaMiMercado";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ nombre: string }> }) {
    const { nombre: nombreCodificado } = await params;
    const nombre = decodeURIComponent(nombreCodificado);
    if (!nombre.trim()) notFound();

    return <VistaMiMercado operadorNombre={nombre} />;
}
