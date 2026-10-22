import HojasDecorativas from "../../../../../../compartido/HojasDecorativas";
import type { PerfilProductorPorOperador } from "../../../acciones/consultas-perfil-por-operador";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Image from "next/image";
import Link from "next/link";

import styles from "./PerfilProductor.module.css";

type PerfilProductorProps  = {
    productor: PerfilProductorPorOperador;
    hrefVolver?: string;
    textoVolver?: string;
};

export default function PerfilProductor({ productor, hrefVolver = "/productores", textoVolver = "Volver al listado de productores" }: PerfilProductorProps) {
    const inicialOperador = productor.nombreFantasia.trim()[0]?.toUpperCase();;

    const numeroWhatsApp = productor.whatsApp.replace(/\D/g, "");
    const mensajeWhatsApp = "Hola, vi tu perfil en Mercado UAM y quisiera hacerte una consulta.";
    const enlaceWhatsApp = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensajeWhatsApp)}`;

    const contenido = (
        <section className={styles.contenedor} aria-labelledby="nombre-operador">
            <Link href={hrefVolver} className={styles.volver}>
                <ArrowBackIcon fontSize="small" aria-hidden="true" />
                {textoVolver}
            </Link>
            <div className={styles.tarjetaPerfil}>
                <header className={styles.encabezado}>
                    <HojasDecorativas />
                    <div className={styles.fotoOperador}>
                        {productor.fotoPerfil ? (
                            <Image src={productor.fotoPerfil} alt={`Foto de ${productor.nombreFantasia}`} width={96} height={96} className={styles.imagenOperador} />
                        ) : (
                            <span aria-hidden="true">{inicialOperador}</span>
                        )}
                    </div>
                    <div className={styles.identidad}>
                        <p className={styles.tipoPerfil}>Perfil Operador</p>
                        <h1 id="nombre-operador" className={styles.nombre}>{productor.nombreFantasia}</h1>
                    </div>
                </header>
            </div>
            <a href={enlaceWhatsApp} target="_blank" rel="noopener noreferrer" className={styles.botonWhatsApp} aria-label={`Contactar a ${productor.nombreFantasia} por WhatsApp`}>
                <WhatsAppIcon className={styles.iconoWhatsApp} aria-hidden="true" />
                <span className={styles.textoWhatsApp}>Contactar por WhatsApp</span>
            </a>
        </section>
    );

    return contenido;
}