import { obtenerOperadoresPublicos } from '@/modulos/usuarios/operadores/consultas-listado-publico';
import ListadoOperadores from '@/modulos/usuarios/operadores/componentes/listado-operadores/ListadoOperadores';

export default async function Page() {
    const operadores = await obtenerOperadoresPublicos();

    const contenido = (
        <main className="flex-1 bg-background font-sans text-foreground">
            <ListadoOperadores operadores={operadores} />
        </main>
    );

    return contenido;
}