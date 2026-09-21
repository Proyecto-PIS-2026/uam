import styles from "./TarjetaPublicacionSinOperador.module.css"

export type Publicacion = {
    id: number; 
    precio: number | null; 
    foto: string | null; 
    especie: string; 
    variedad: string; 
    presentacion: string; 
    categoria: string; 
    calibre: string; 
}

interface PublicacionSinOperadorProps{
    producto: Publicacion; 
    onPublicacionClick: (id: number) => void; 
}

export function PublicacionSinOperador ({ producto, onPublicacionClick }: PublicacionSinOperadorProps) {
    const contenido =   (
        <div className={styles.tarjeta} onClick ={() => onPublicacionClick(producto.id)}>
            <div className={styles.imagen}>
                <img 
                    src={producto.foto !== null ? producto.foto : "/imagenes/producto-sin-foto.png"}
                />
            </div>
            <div className={styles.contenido}> 
                <div className={styles.nombre}>
                        {producto.especie}
                        {" "}
                        {producto.variedad !== "-" && <>{producto.variedad}</>}
                </div>
                <div className={styles.etiquetas}>
                    <span className={styles.etiqueta}>
                        {producto.presentacion}
                    </span>
                    <span className={styles.etiqueta}>
                        {producto.calibre}
                    </span>
                    <span className={styles.etiqueta}>
                        {producto.categoria}
                    </span>
                </div>
                <div className={styles.precio}>
                    {producto.precio !== null ? <>$ {producto.precio}</> : "Sin precio"}
                </div>
            </div>
        </div>
    );
    return contenido;
}