import { obtenerOperadoresPublicos } from '@/modulos/usuarios/operadores/consultas-listado-publico';
import ListadoOperadores from '@/modulos/usuarios/operadores/componentes/listado-operadores/ListadoOperadores';
import HojasDecorativas from '@/compartido/HojasDecorativas';

export default async function Page() {
    const operadores = await obtenerOperadoresPublicos();

    const contenido = (
        <main className="relative isolate flex-1 overflow-hidden bg-background font-sans text-foreground">
            <HojasDecorativas variante="fondo" />
            <div className="relative z-10">
                <ListadoOperadores operadores={operadores} />
            </div>
        </main>
    );

    return contenido;
}
