import { notFound } from "next/navigation";
import { requerirProductor } from "@/modulos/identidad-acceso/autorizacion/controles";
import { obtenerMiPerfilProductor } from "@/modulos/usuarios/productores/perfil-propio/consultas-mi-perfil-productor";
import FormularioModificarProductor from "@/modulos/usuarios/productores/componentes/modificar-productor-por-admin/FormularioModificarProductor";

export const metadata = { title: "Modificar mi perfil | UAM" };

export default async function PaginaModificarMiPerfilProductor() {
    await requerirProductor();
    const productor = await obtenerMiPerfilProductor();
    if (!productor) notFound();
    return <FormularioModificarProductor productor={productor} perfilPropio />;
}
