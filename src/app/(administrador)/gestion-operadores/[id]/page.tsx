import { notFound } from "next/navigation";
import { requerirAdministrador } from "@/modulos/identidad-acceso/autorizacion/controles";

import { obtenerPerfilAdminOperador } from "../../../../modulos/usuarios/operadores/consultas-perfil-admin";
import { obtenerOpcionesEdicionPublicacion } from "../../../../modulos/publicaciones/operadores/consultas-edicion-publicacion";
import { obtenerConfiguracion } from "@/modulos/administracion/ConsultaConfiguracion";
import PerfilOperadorAdmin from "../../../../modulos/usuarios/operadores/componentes/perfil-admin-operador/PerfilOperadorAdmin";

export const dynamic = "force-dynamic"; // Consultar la base en cada visita, sin cachear la página

type PageProps = {
    params: Promise<{ id: string }>;
};

export default async function Page({ params }: PageProps) {
    await requerirAdministrador();

    const { id } = await params;
    const [perfil, opciones, incremento] = await Promise.all([
        obtenerPerfilAdminOperador(Number(id)),
        obtenerOpcionesEdicionPublicacion(),
        obtenerConfiguracion("incremento_precio"),
    ]);

    if (!perfil) {
        notFound();
    }

    return (
        <main>
            <PerfilOperadorAdmin operador={perfil} opciones={opciones} incrementoPrecio={Number(incremento)} />
        </main>
    );
}