import type { PerfilPublicoOperador } from "../../consultas-perfil-publico";

import styles from "./PerfilOperador.module.css";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";

type PerfilOperadorProps = {
    operador: PerfilPublicoOperador;
}

export default function PerfilOperador({ operador }: PerfilOperadorProps) {

    const inicialOperador = operador.nombreFantasia.trim()[0]?.toUpperCase();
    const localesPorNave: Record<string, string[]> = {};

    for (const local of operador.locales) {
        if (!localesPorNave[local.nombreNave]) {
            localesPorNave[local.nombreNave] = [];
        }
        localesPorNave[local.nombreNave].push(local.numeroLocal);
    }

    const contenido = (
        <section className={styles.contenedor} aria-labelledby="nombre-operador">
            <header className={styles.encabezado}>
                <div className={styles.fotoOperador} aria-hidden="true">{inicialOperador}</div>
                <div className={styles.identidad}>
                    <p className={styles.tipoPerfil}>Operador</p>
                    <h1 id="nombre-operador" className={styles.nombre}>{operador.nombreFantasia}</h1>
                </div>
            </header>
            <div className={styles.tarjetaInformacion}>
                <div>
                    <h2 className={styles.tituloSeccion}>Locales</h2>
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
            <a href="" target="_blank" rel="noopener noreferrer" className={styles.botonWhatsApp} aria-label={`Contactar a ${operador.nombreFantasia} por WhatsApp`}>
                <WhatsAppIcon className={styles.iconoWhatsApp} aria-hidden="true" />
                <span className={styles.textoWhatsApp}>Contactar por WhatsApp</span>
            </a>
        </section>
    );

    return contenido;
}