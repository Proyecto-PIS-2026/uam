import { notFound } from 'next/navigation';

import { obtenerPerfilPublicoOperador } from '@/modulos/usuarios/operadores/consultas-perfil-publico';
import CatalogoOperador from '@/modulos/usuarios/operadores/componentes/CatalogoOperador';
import PerfilOperador from '@/modulos/usuarios/operadores/componentes/PerfilOperador';

type PageProps = {
    params: Promise<{ id: string; }>;
};

export default async function Page({ params }: PageProps) {
    const { id } = await params;
    const idOperador = Number(id);

    const perfil = await obtenerPerfilPublicoOperador(idOperador);

    if (!perfil) {
        notFound(); // https://nextjs.org/docs/app/api-reference/functions/not-found
    }

    const contenido = (
        <main className='bg-white'>
            <PerfilOperador operador={ perfil } />
            <CatalogoOperador publicaciones={ perfil.publicaciones } />
        </main>
    );

    return contenido;
}