import { notFound } from "next/navigation";
import { requerirAdministrador } from "@/modulos/identidad-acceso/autorizacion/controles";

import { obtenerPerfilAdminOperador } from "../../../../modulos/usuarios/operadores/consultas-perfil-admin";
import { obtenerOpcionesEdicionPublicacion } from "../../../../modulos/publicaciones/operadores/consultas-edicion-publicacion";
import PerfilOperadorAdmin from "../../../../modulos/usuarios/operadores/componentes/perfil-admin-operador/PerfilOperadorAdmin";

export const dynamic = "force-dynamic"; // Consultar la base en cada visita, sin cachear la página

type PageProps = {
    params: Promise<{ id: string }>;
};

export default async function Page({ params }: PageProps) {
    await requerirAdministrador();

    const { id } = await params;
    const [perfil, opciones] = await Promise.all([
        obtenerPerfilAdminOperador(Number(id)),
        obtenerOpcionesEdicionPublicacion(),
    ]);

    if (!perfil) {
        notFound();
    }

    return (
        <main>
            <PerfilOperadorAdmin operador={perfil} opciones={opciones} />
        </main>
    );
}