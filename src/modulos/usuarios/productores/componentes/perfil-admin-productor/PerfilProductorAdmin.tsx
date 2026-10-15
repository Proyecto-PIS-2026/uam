import HojasDecorativas from "../../../../../compartido/HojasDecorativas";
import type { PerfilAdminProductor } from "../../consultas-perfil-productor-admin";

import styles from "./PerfilProductorAdmin.module.css";
import CatalogoProductorAdmin from "./CatalogoProductorAdmin";
import Link from "next/link";

type PerfilProductorAdminProps = {
    productor: PerfilAdminProductor;
};


export default function PerfilProductorAdmin({ productor }: PerfilProductorAdminProps) {
    const inicialProductor = productor.nombreUsuario.trim()[0]?.toUpperCase();
    const contenido = (
        <section className={styles.contenedor} aria-labelledby="nombre-productor">
            <Link href="/administracion#usuarios" className={styles.volver}>
                ← Volver al listado de productores
            </Link>
            <div className={styles.tarjetaPerfil}>
                <header className={styles.encabezado}>
                    <HojasDecorativas />
                    <div className={styles.avatar}>
                            <span aria-hidden="true">{inicialProductor}</span>
                    </div>

                    <div className={styles.identidad}>
                        <p className={styles.tipoPerfil}>Perfil Productor</p>
                        <h1 id="nombre-productor" className={styles.nombre}>{productor.nombreUsuario}</h1>
                    </div>
                    <Link
                        href={`/gestion-productores/${productor.id}/editar`}
                        className={styles.botonEditar}
                        aria-label="Editar productor"
                        title="Editar productor"
                    >
                        <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                        <span className={styles.textoEditar}>Editar</span>
                    </Link>
                </header>

                <div className={styles.tarjetaInformacion}>
                    <p className={styles.dato}>
                        <span className={styles.etiqueta}>Whatsapp:</span> {productor.whatsApp}
                    </p>
                </div>
            </div>

            <h2 className={styles.subtituloPublicaciones}>Publicaciones ({productor.publicaciones.length})</h2>
            <CatalogoProductorAdmin publicaciones={productor.publicaciones} />
        </section>
    );

    return contenido;
}