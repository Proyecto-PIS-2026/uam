import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirOperador } from "@/modulos/identidad-acceso/autorizacion/controles";
import { obtenerPerfilProductorPorOperador } from "@/modulos/usuarios/productores/acciones/consultas-perfil-por-operador";
import PerfilProductor from "@/modulos/usuarios/productores/componentes/perfil-operador-productor/perfil-productor/PerfilProductor";
import CatalogoProductor from "@/modulos/usuarios/productores/componentes/perfil-operador-productor/catalogo-productor/CatalogoProductor";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ nombre: string }> }) {
    await requerirOperador();
const { nombre } = await params;
const nombreDecodificado = decodeURIComponent(nombre);
const productor = await obtenerPerfilProductorPorOperador(nombreDecodificado);
    
    if (!productor) notFound();
    const contenido = (
        <main className="flex-1 bg-background font-sans text-foreground">
            <div className="contenedor-pagina">
                <Link href="/productores" className="mb-4 inline-block text-primary hover:underline">
                    Volver a productores
                </Link>
            </div>
            <PerfilProductor productor={productor} />
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
