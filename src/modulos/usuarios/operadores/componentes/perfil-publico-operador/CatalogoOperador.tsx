import type { PublicacionPerfil } from "../../consultas-perfil-publico";
import TarjetaPublicacion from "./TarjetaPublicacion";
import styles from "./CatalogoOperador.module.css";

type CatalogoOperadorProps = {
    publicaciones: PublicacionPerfil[];
};

export default function CatalogoOperador({ publicaciones }: CatalogoOperadorProps) {
    const contenido = (
        <section className={styles.contenedor}>
            <div className={styles.catalogo}>
                <h2 className={styles.titulo}>Productos</h2>

                <div className={styles.placeholderFiltros}>
                    Filtros
                </div>

                <div className={styles.lista}>
                    {publicaciones.map((publicacion) => ( <TarjetaPublicacion key={publicacion.id} publicacion={publicacion}/> ))}
                </div>

                {publicaciones.length === 0 && (
                    <p className={styles.sinResultados}>
                        No hay publicaciones disponibles.
                    </p>
                )}
            </div>
        </section>
    );

    return contenido;
}