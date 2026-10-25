import { notFound, redirect } from 'next/navigation';
import { decodificarParametroRuta } from "@/compartido/decodificar-parametro-ruta";
import { redirigirProductorAMiMercado } from "@/modulos/identidad-acceso/autorizacion/controles";
import { obtenerOperadorActual } from "@/modulos/usuarios/operadores/operador-actual";

import { obtenerPerfilPublicoOperador } from "../../../../modulos/usuarios/operadores/consultas-perfil-publico";
import CatalogoOperador from "../../../../modulos/usuarios/operadores/componentes/perfil-publico-operador/CatalogoOperador";
import PerfilOperador from "../../../../modulos/usuarios/operadores/componentes/perfil-publico-operador/PerfilOperador";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type PageProps = {
    params: Promise<{ nombre: string; }>;
    searchParams: Promise<{ origen?: string | string[] }>;
};

export default async function Page({ params, searchParams }: PageProps) {
    const sesion = await redirigirProductorAMiMercado();
    const { nombre: parametroNombre } = await params;
    const nombre = decodificarParametroRuta(parametroNombre);
    if (nombre === null || !nombre.trim()) notFound();

    const { origen } = await searchParams;
    const desdePublicaciones = origen === "publicaciones";
    const hrefVolver = desdePublicaciones ? "/publicaciones" : "/operadores";
    const textoVolver = desdePublicaciones ? "Volver al Mercado" : "Volver al listado de operadores";

    if (sesion?.rol === "OPERADOR") {
        const operador = await obtenerOperadorActual();
        if (operador.nombreFantasia !== nombre) {
            redirect("/mi-mercado");
        }
    }

    const perfil = await obtenerPerfilPublicoOperador(nombre);

    if (!perfil) {
        notFound(); // https://nextjs.org/docs/app/api-reference/functions/not-found
    }

    const contenido = (
        <main className={styles.pagina}>
            <div className={styles.contenido}>
                <PerfilOperador operador={perfil} hrefVolver={hrefVolver} textoVolver={textoVolver}/>
                <CatalogoOperador key={perfil.id} publicaciones={perfil.publicaciones} whatsAppOperador={perfil.whatsApp} idOperador={perfil.id} nombreOperador={perfil.nombreFantasia} />
            </div>
        </main>
    );

    return contenido;
}
