import { notFound } from "next/navigation";
import { requerirAdministrador } from "@/modulos/identidad-acceso/autorizacion/controles";

import FormularioModificarOperador from "@/modulos/usuarios/operadores/componentes/modificar-operador-por-admin/FormularioModificarOperador";
import { obtenerNaves } from "@/modulos/usuarios/operadores/consultas-naves";
import { obtenerOperadorParaModificar } from "@/modulos/usuarios/operadores/consultas-modificacion-operador";

export const dynamic = "force-dynamic";

type PageProps = {
    params: Promise<{ id: string }>;
};

export default async function Page({ params }: PageProps) {
    await requerirAdministrador();

    const { id } = await params;
    const operadorId = Number(id);

    const [operador, naves] = await Promise.all([
        obtenerOperadorParaModificar(operadorId),
        obtenerNaves(),
    ]);

    if (!operador) {
        notFound();
    }

    return (
        <main className="flex-1">
            <FormularioModificarOperador
                operador={operador}
                naves={naves}
            />
        </main>
    );
}
