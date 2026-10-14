export const dynamic = 'force-dynamic';

import FormularioAltaUsuario from '@/modulos/usuarios/administradores/componentes/alta-usuario/FormularioAltaUsuario';
import { obtenerNaves } from '@/modulos/usuarios/operadores/consultas-naves';
import { requerirAdministrador } from '@/modulos/identidad-acceso/autorizacion/controles';


export default async function Page() {
    await requerirAdministrador();

    const naves = await obtenerNaves();

    return (
        <main className="relative isolate flex-1 overflow-hidden bg-background font-sans text-foreground">
            <div className="relative z-10">
                <FormularioAltaUsuario naves={naves} />
            </div>
        </main>
    );
}