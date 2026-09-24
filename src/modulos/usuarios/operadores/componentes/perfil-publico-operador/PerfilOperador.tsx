import type { PerfilPublicoOperador } from "../../consultas-perfil-publico";

import styles from "./PerfilOperador.module.css";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import Image from "next/image";

type PerfilOperadorProps = {
    operador: PerfilPublicoOperador;
};

export default function PerfilOperador({ operador }: PerfilOperadorProps) {
    const inicialOperador = operador.nombreFantasia.trim()[0]?.toUpperCase();
    const localesPorNave: Record<string, string[]> = {};

    for (const local of operador.locales) {
        if (!localesPorNave[local.nombreNave]) {
            localesPorNave[local.nombreNave] = [];
        }

        localesPorNave[local.nombreNave].push(local.numeroLocal);
    }

    const numeroWhatsApp = operador.whatsApp.replace(/\D/g, "");
    const mensajeWhatsApp = "Hola, vi tu perfil en Mercado UAM y quisiera hacerte una consulta.";
    const enlaceWhatsApp = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensajeWhatsApp)}`;

    const contenido = (
        <section className={styles.contenedor} aria-labelledby="nombre-operador">
            <div className={styles.tarjetaPerfil}>
                <header className={styles.encabezado}>
                    <div className={styles.fotoOperador}>
                        {operador.fotoPerfil ? (
                            <Image src={operador.fotoPerfil} alt={`Foto de ${operador.nombreFantasia}`} width={96} height={96} className={styles.imagenOperador} />
                        ) : (
                            <span aria-hidden="true">{inicialOperador}</span>
                        )}
                    </div>

                    <div className={styles.identidad}>
                        <p className={styles.tipoPerfil}>Perfil Operador</p>
                        <h1 id="nombre-operador" className={styles.nombre}>{operador.nombreFantasia}</h1>
                    </div>
                </header>

                <div className={styles.tarjetaInformacion}>
                    <ul className={styles.listaLocales}>
                        {Object.entries(localesPorNave).map(([nombreNave, locales]) => (
                            <li key={nombreNave} className={styles.local}>
                                <span className={styles.nombreNave}>Nave {nombreNave}</span>
                                <span className={styles.separadorLocal} aria-hidden="true">-</span>
                                <span className={styles.numeroLocal}>
                                    {locales.length > 1 ? "Locales" : "Local"}{" "}{locales.join(", ")}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            <a href={enlaceWhatsApp} target="_blank" rel="noopener noreferrer" className={styles.botonWhatsApp} aria-label={`Contactar a ${operador.nombreFantasia} por WhatsApp`}>
                <WhatsAppIcon className={styles.iconoWhatsApp} aria-hidden="true" />
                <span className={styles.textoWhatsApp}>Contactar por WhatsApp</span>
            </a>
        </section>
    );

    return contenido;
}