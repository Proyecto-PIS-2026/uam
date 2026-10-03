import { notFound } from "next/navigation";

import { obtenerPerfilAdminOperador } from "../../../../modulos/usuarios/operadores/consultas-perfil-admin";
import PerfilOperadorAdmin from "../../../../modulos/usuarios/operadores/componentes/perfil-admin-operador/PerfilOperadorAdmin";

export const dynamic = "force-dynamic"; // Consultar la base en cada visita, sin cachear la página

type PageProps = {
    params: Promise<{ id: string }>;
};

export default async function Page({ params }: PageProps) {
    // PENDIENTE (BP-04.4): verificar que el usuario sea Administrador
    // con el mecanismo de identidad-acceso cuando esté implementado.

    const { id } = await params;
    const perfil = await obtenerPerfilAdminOperador(Number(id));

    if (!perfil) {
        notFound();
    }

    return (
        <main>
            <PerfilOperadorAdmin operador={perfil} />
        </main>
    );
}