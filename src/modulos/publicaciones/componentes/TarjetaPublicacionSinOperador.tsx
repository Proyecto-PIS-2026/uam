import styles from "./TarjetaPublicacionSinOperador.module.css"
import Image from "next/image";

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

interface PublicacionSinOperadorProps {
    producto: Publicacion; 
    onPublicacionClick: (id: number) => void; 
}

export function PublicacionSinOperador ({producto, onPublicacionClick}: PublicacionSinOperadorProps) {
    const contenido = (
        <div className={styles.tarjeta} onClick ={() => onPublicacionClick(producto.id)}>
            <div className={styles.imagen}> 
                {producto.foto ? <Image src={producto.foto} alt={producto.especie}/>
                : <span className={styles.sin_foto}>IMG</span>}
            </div>
            <div className={styles.contenido}> 
                <div className={styles.nombre}>
                    {producto.especie} {" "} {producto.variedad !== "-" && <>{producto.variedad}</>}
                </div>
                <div className={styles.presentacion}>
                    {producto.presentacion}
                </div>
                <div className={styles.bloque_detalle}>
                    <div className={styles.etiquetas}>
                        <span className={styles.etiqueta}>
                            {producto.calibre}
                        </span>
                        <span className={styles.etiqueta}>
                            {producto.categoria}
                        </span>
                    </div>   
                    <div className={styles.precio}>
                        {producto.precio ? <>${producto.precio}</> : "Sin precio"}
                    </div>
                </div>         
            </div>
        </div>
    );
    return contenido;
}