import { notFound } from "next/navigation";
import { decodificarParametroRuta } from "@/compartido/decodificar-parametro-ruta";
import VistaMiMercado from "../../../../modulos/publicaciones/mi-mercado/componentes/VistaMiMercado";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ nombre: string }> }) {
    const { nombre: parametroNombre } = await params;
    const nombre = decodificarParametroRuta(parametroNombre);
    if (nombre === null || !nombre.trim()) notFound();

    return <VistaMiMercado operadorNombre={nombre} />;
}
