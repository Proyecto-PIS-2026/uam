import { notFound } from "next/navigation";

import FormularioModificarOperador from "@/modulos/usuarios/administradores/componentes/modificar-operador/FormularioModificarOperador";
import { obtenerNaves } from "@/modulos/usuarios/administradores/componentes/modificar-operador/obtenerNaves";
import { obtenerOperadorParaModificar } from "@/modulos/usuarios/administradores/componentes/modificar-operador/obtenerOperadorParaModificar";

export const dynamic = "force-dynamic";

type PageProps = {
    params: Promise<{ id: string }>;
};

export default async function Page({ params }: PageProps) {
    // TODO(BP-04.4): verificar que el usuario autenticado
    // sea ADMINISTRADOR antes de permitir la modificación.

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
        <main>
            <FormularioModificarOperador
                operador={operador}
                naves={naves}
            />
        </main>
    );
}