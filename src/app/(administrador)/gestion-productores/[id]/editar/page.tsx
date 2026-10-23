import { notFound } from "next/navigation";
import { requerirAdministrador } from "@/modulos/identidad-acceso/autorizacion/controles";

import FormularioModificarProductor from "@/modulos/usuarios/productores/componentes/modificar-productor-por-admin/FormularioModificarProductor";
import { obtenerProductorParaModificar } from "@/modulos/usuarios/productores/componentes/modificar-productor-por-admin/obtenerProductorParaModificar";

export const dynamic = "force-dynamic";

type PageProps = {
    params: Promise<{ id: string }>;
};

export default async function Page({ params }: PageProps) {
    await requerirAdministrador();

    const { id } = await params;
    const productorId = Number(id);

    const productor = await obtenerProductorParaModificar(productorId);

    if (!productor) {
        notFound();
    }

    return (
        <main>
            <FormularioModificarProductor productor={productor} />
        </main>
    );
}