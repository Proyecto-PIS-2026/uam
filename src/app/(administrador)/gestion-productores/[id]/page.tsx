import { notFound } from "next/navigation";
import { requerirAdministrador } from "@/modulos/identidad-acceso/autorizacion/controles";

import { obtenerPerfilAdminProductor } from "../../../../modulos/usuarios/productores/consultas-perfil-productor-admin";
import PerfilProductorAdmin from "../../../../modulos/usuarios/productores/componentes/perfil-admin-productor/PerfilProductorAdmin";

export const dynamic = "force-dynamic"; // Consultar la base en cada visita, sin cachear la página

type PageProps = {
    params: Promise<{ id: string }>;
};

export default async function Page({ params }: PageProps) {
    await requerirAdministrador();

    const { id } = await params;
    const perfil = await obtenerPerfilAdminProductor(Number(id))

    if (!perfil) {
        notFound();
    }

    return (
        <main>
            <PerfilProductorAdmin productor={perfil} />
        </main>
    );
}