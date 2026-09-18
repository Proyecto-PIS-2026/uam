import { notFound } from 'next/navigation';

import { obtenerPerfilPublicoOperador } from '@/modulos/usuarios/operadores/consultas-perfil-publico';
import { PerfilPublicoOperador } from '@/modulos/usuarios/operadores/consultas-perfil-publico'; // Solo temporal
import CatalogoOperador from '@/modulos/usuarios/operadores/componentes/CatalogoOperador';
import PerfilOperador from '@/modulos/usuarios/operadores/componentes/PerfilOperador';

// GENERE DOS PERFILES HARDCODEADOS CON IA PARA PODER VISUALIZAR LA PAGINA
const perfilesDePrueba: Record<number, PerfilPublicoOperador> = {
    1: {
        id: 1,
        nombreFantasia: "Frutas del Sur",
        whatsApp: "59800000000",
        locales: [
            { nombreNave: "Nave A", numeroLocal: "200" },
            { nombreNave: "Nave B", numeroLocal: "250" },
        ],
        publicaciones: [
            {
                id: 101,
                foto: null,
                precio: "120.00",
                especie: "Manzana",
                variedad: "Gala",
                presentacion: "Cajón",
                categoria: "I",
                calibre: "Mediano",
            },
            {
                id: 102,
                foto: null,
                precio: null,
                especie: "Pera",
                variedad: "Williams",
                presentacion: "Caja",
                categoria: "I",
                calibre: "Grande",
            },
        ],
    },
    2: {
        id: 2,
        nombreFantasia: "La Huerta",
        whatsApp: "59800000001",
        locales: [
            { nombreNave: "Nave C", numeroLocal: "15" },
        ],
        publicaciones: [
            {
                id: 201,
                foto: null,
                precio: "85.00",
                especie: "Tomate",
                variedad: "Perita",
                presentacion: "Cajón",
                categoria: "II",
                calibre: "Mediano",
            },
        ],
    },
};
// GENERE DOS PERFILES HARDCODEADOS CON IA PARA PODER VISUALIZAR LA PAGINA

type PageProps = {
    params: Promise<{ id: string; }>;
};

export default async function Page({ params }: PageProps) {
    const { id } = await params;
    const idOperador = Number(id);

    // const perfil = await obtenerPerfilPublicoOperador(idOperador); // comentado temporalmente para probar
    const perfil = perfilesDePrueba[idOperador];

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