import { notFound, redirect } from 'next/navigation';
import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { obtenerOperadorActual } from "@/modulos/usuarios/operadores/operador-actual";

import { obtenerPerfilPublicoOperador } from "../../../../modulos/usuarios/operadores/consultas-perfil-publico";
import CatalogoOperador from "../../../../modulos/usuarios/operadores/componentes/perfil-publico-operador/CatalogoOperador";
import PerfilOperador from "../../../../modulos/usuarios/operadores/componentes/perfil-publico-operador/PerfilOperador";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type PageProps = {
    params: Promise<{ nombre: string; }>;
};

export default async function Page({ params }: PageProps) {
    const sesion = await obtenerSesion();
    const { nombre: nombreCodificado } = await params;
    const nombre = decodeURIComponent(nombreCodificado);

    if (sesion?.rol === "OPERADOR") {
        const operador = await obtenerOperadorActual();
        if (operador.nombreFantasia !== nombre) {
            redirect("/mi-mercado");
        }
    }

    if (!nombre.trim()) {
        notFound();
    }

    const perfil = await obtenerPerfilPublicoOperador(nombre);

    if (!perfil) {
        notFound(); // https://nextjs.org/docs/app/api-reference/functions/not-found
    }

    const contenido = (
        <main className={styles.pagina}>
            <div className={styles.contenido}>
                <PerfilOperador operador={ perfil } />
                <CatalogoOperador key={perfil.id} publicaciones={perfil.publicaciones} whatsAppOperador={perfil.whatsApp} idOperador={perfil.id} nombreOperador={perfil.nombreFantasia} />
            </div>
        </main>
    );

    return contenido;
}