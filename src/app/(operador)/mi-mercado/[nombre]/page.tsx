import { notFound } from "next/navigation";
import { decodificarParametroRuta } from "@/compartido/decodificar-parametro-ruta";
import VistaMiMercado from "../../../../modulos/publicaciones/mi-mercado/componentes/VistaMiMercado";
import { leerPublicacionInicialId, type ParametrosMiMercado } from "@/modulos/publicaciones/mi-mercado/parametro-publicacion";

export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: { params: Promise<{ nombre: string }>; searchParams?: Promise<ParametrosMiMercado> }) {
    const { nombre: parametroNombre } = await params;
    const nombre = decodificarParametroRuta(parametroNombre);
    if (nombre === null || !nombre.trim()) notFound();

    const publicacionInicialId = leerPublicacionInicialId((await searchParams)?.publicacion);
    return <VistaMiMercado operadorNombre={nombre} publicacionInicialId={publicacionInicialId} />;
}
