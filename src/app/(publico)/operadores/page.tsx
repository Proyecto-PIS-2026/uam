export const dynamic = 'force-dynamic';

import { redirigirOperadorAMiMercado } from '@/modulos/identidad-acceso/autorizacion/controles';
import { obtenerOperadoresPublicos } from '@/modulos/usuarios/operadores/consultas-listado-publico';
import ListadoOperadores from '@/modulos/usuarios/operadores/componentes/listado-operadores/ListadoOperadores';

export default async function Page() {
    await redirigirOperadorAMiMercado();
    const operadores = await obtenerOperadoresPublicos();

    const contenido = (
        <main className="relative isolate flex-1 overflow-hidden bg-background font-sans text-foreground">
            <div className="relative z-10">
                <ListadoOperadores operadores={operadores} />
            </div>
        </main>
    );

    return contenido;
}