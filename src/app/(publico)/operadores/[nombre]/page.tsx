import { notFound } from 'next/navigation';

import { obtenerPerfilPublicoOperador } from "../../../../modulos/usuarios/operadores/consultas-perfil-publico";
import CatalogoOperador from "../../../../modulos/usuarios/operadores/componentes/perfil-publico-operador/CatalogoOperador";
import PerfilOperador from "../../../../modulos/usuarios/operadores/componentes/perfil-publico-operador/PerfilOperador";

import styles from "./page.module.css";
// import HojasDecorativas from "../../../../compartido/HojasDecorativas";

export const dynamic = "force-dynamic";

type PageProps = {
    params: Promise<{ nombre: string; }>;
};

export default async function Page({ params }: PageProps) {
    const { nombre: nombreCodificado } = await params;
    const nombre = decodeURIComponent(nombreCodificado);

    if (!nombre.trim()) {
        notFound();
    }

    const perfil = await obtenerPerfilPublicoOperador(nombre);

    if (!perfil) {
        notFound(); // https://nextjs.org/docs/app/api-reference/functions/not-found
    }

    const contenido = (
        <main className={styles.pagina}>
            {/* <HojasDecorativas variante="fondo" /> */}
            <div className={styles.contenido}>
                <PerfilOperador operador={ perfil } />
                <CatalogoOperador key={perfil.id} publicaciones={perfil.publicaciones} whatsAppOperador={perfil.whatsApp} idOperador={perfil.id} nombreOperador={perfil.nombreFantasia} />
            </div>
        </main>
    );

    return contenido;
}
