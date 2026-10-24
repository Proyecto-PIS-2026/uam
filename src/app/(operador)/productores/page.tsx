import { requerirConsultaProductores } from "@/modulos/identidad-acceso/autorizacion/controles";
import { autorizado } from "@/modulos/identidad-acceso/autorizacion/permisos";
import { obtenerProductoresDisponibles } from "@/modulos/usuarios/productores/acciones/consultas-productores";
import ListadoProductores from "@/modulos/usuarios/productores/componentes/listado-productores/ListadoProductores";
export const dynamic = "force-dynamic";

export default async function Page() {
    const sesion = await requerirConsultaProductores();
    const productores = await obtenerProductoresDisponibles();
    
    const contenido = (
        <main className="relative isolate flex-1 overflow-hidden bg-background font-sans text-foreground">
            <ListadoProductores productores={productores} puedeGestionar={autorizado("usuarios.cuentas.gestionar", sesion)} />
        </main>
    );
    return contenido; 
}
