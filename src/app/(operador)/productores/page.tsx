import { requerirOperador } from "@/modulos/identidad-acceso/autorizacion/controles";
import { obtenerProductoresDisponibles } from "@/modulos/usuarios/productores/acciones/consultas-productores";
import ListadoProductores from "@/modulos/usuarios/productores/componentes/listado-productores/ListadoProductores";
export const dynamic = "force-dynamic";

export default async function Page() {
    await requerirOperador();
    const productores = await obtenerProductoresDisponibles();
    
    const contenido = (
        <main className="relative isolate flex-1 overflow-hidden bg-background font-sans text-foreground">
            <ListadoProductores productores={productores} />
        </main>
    );
    return contenido; 
}
