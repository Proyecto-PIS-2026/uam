import { notFound } from "next/navigation";
import VistaMiMercado from "../../../../modulos/publicaciones/mi-mercado/componentes/VistaMiMercado";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ nombre: string }> }) {
    const { nombre: nombreCodificado } = await params;
    let nombre: string;
    try {
        nombre = decodeURIComponent(nombreCodificado);
    } catch {
        notFound();
    }
    if (!nombre.trim()) notFound();

    return <VistaMiMercado operadorNombre={nombre} />;
}
