import EnlaceWhatsApp from "@/compartido/componentes/EnlaceWhatsApp";
import HojasDecorativas from "../../../../../../compartido/HojasDecorativas";
import type { PerfilProductorPorOperador } from "../../../acciones/consultas-perfil-por-operador";
import BotonVolver from "@/compartido/BotonVolver";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import ImagenPerfil from "@/modulos/usuarios/componentes/ImagenPerfil";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";

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

    const contenido = (
        <section className={styles.contenedor} aria-labelledby="nombre-operador">
            <BotonVolver href={hrefVolver} className={styles.volver}>
                {textoVolver}
            </BotonVolver>
            <div className={styles.tarjetaPerfil}>
                <header className={styles.encabezado}>
                    <HojasDecorativas />
                    <div className={styles.fotoOperador}>
                        <ImagenPerfil src={productor.fotoPerfil} alt={`Foto de ${productor.nombreFantasia}`} width={96} height={96} className={styles.imagenOperador}
                            reemplazo={<span aria-hidden="true">{inicialOperador}</span>} />
                    </div>
                    <div className={styles.identidad}>
                        <p className={styles.tipoPerfil}>Perfil Productor</p>
                        <h1 id="nombre-operador" className={styles.nombre}>{productor.nombreFantasia}</h1>
                    </div>
                </header>
                <div className={styles.tarjetaInformacion}>
                    <p className={styles.departamentos}>
                        <LocationOnOutlinedIcon fontSize="small" aria-hidden="true" />
                        <span><strong>Departamentos:</strong> {productor.departamentos.join(" · ") || "-"}</span>
                    </p>
                </div>
            </div>
            <EnlaceWhatsApp numero={numeroWhatsApp} mensaje={mensajeWhatsApp} className={styles.botonWhatsApp} aria-label={`Contactar a ${productor.nombreFantasia} por WhatsApp`}>
                <WhatsAppIcon className={styles.iconoWhatsApp} aria-hidden="true" />
                <span className={styles.textoWhatsApp}>Contactar por WhatsApp</span>
            </EnlaceWhatsApp>
        </section>
    );

    return contenido;
}
