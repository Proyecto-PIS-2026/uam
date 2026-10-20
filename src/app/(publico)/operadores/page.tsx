export const dynamic = 'force-dynamic';

import { redirigirOperadorAMiMercado } from '@/modulos/identidad-acceso/autorizacion/controles';
import { obtenerOperadoresPublicos } from '@/modulos/usuarios/operadores/consultas-listado-publico';
import ListadoOperadores from '@/modulos/usuarios/operadores/componentes/listado-operadores/ListadoOperadores';
import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";

export default async function Page() {
    await redirigirOperadorAMiMercado();
    const sesion = await obtenerSesion();
    const esAdmin = sesion?.rol === "ADMINISTRADOR";
    const operadores = await obtenerOperadoresPublicos();

    const contenido = (
        <main className="relative isolate flex-1 overflow-hidden bg-background font-sans text-foreground">
            <div className="relative z-10">
                <ListadoOperadores operadores={operadores} esAdmin={esAdmin} />
            </div>
        </main>
    );

    return contenido;
}