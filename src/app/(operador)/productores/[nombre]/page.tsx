import { notFound } from "next/navigation";
import { decodificarParametroRuta } from "@/compartido/decodificar-parametro-ruta";
import { requerirConsultaProductores } from "@/modulos/identidad-acceso/autorizacion/controles";
import { obtenerPerfilProductorPorOperador } from "@/modulos/usuarios/productores/acciones/consultas-perfil-por-operador";
import PerfilProductor from "@/modulos/usuarios/productores/componentes/perfil-operador-productor/perfil-productor/PerfilProductor";
import CatalogoProductor from "@/modulos/usuarios/productores/componentes/perfil-operador-productor/catalogo-productor/CatalogoProductor";

export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: { params: Promise<{ nombre: string }>; searchParams: Promise<{ origen?: string | string[] }> }) {
    await requerirConsultaProductores();
    const { nombre: parametroNombre } = await params;
    const nombre = decodificarParametroRuta(parametroNombre);
    if (nombre === null || !nombre.trim()) notFound();
    const productor = await obtenerPerfilProductorPorOperador(nombre);

    if (!productor) notFound();

    const { origen } = await searchParams;
    const desdePublicaciones = origen === "publicaciones";
    const hrefVolver = desdePublicaciones ? "/publicaciones-productor" : "/productores";
    const textoVolver = desdePublicaciones ? "Volver a Mercado Productores" : "Volver al listado de productores";

    const contenido = (
        <main className="flex-1 bg-background font-sans text-foreground">
            <PerfilProductor productor={productor} hrefVolver={hrefVolver} textoVolver={textoVolver}/>
            <CatalogoProductor
                key={productor.id}
                publicaciones={productor.publicaciones}
                idProductor={productor.id}
                nombreProductor={productor.nombreFantasia}
                whatsAppProductor={productor.whatsApp}
            />
        </main>
    );
    return contenido;
}
