import EnlaceWhatsApp from "@/compartido/componentes/EnlaceWhatsApp";
import EstadoVacio from "@/compartido/componentes/EstadoVacio";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import HojasDecorativas from "../../../../../compartido/HojasDecorativas";
import type { PerfilPublicoOperador } from "../../consultas-perfil-publico";

import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Image from "next/image";
import Link from "next/link";

import styles from "./PerfilOperador.module.css";

type PerfilOperadorProps = {
    operador: PerfilPublicoOperador;
    hrefVolver?: string;
    textoVolver?: string;
};

export default function PerfilOperador({ operador,  hrefVolver = "/operadores", textoVolver = "Volver al listado de operadores"  }: PerfilOperadorProps) {
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
                    {operador.locales.length === 0 ? (
                        <EstadoVacio titulo="Sin locales registrados" descripcion="El operador no tiene locales registrados." icono={<LocationOnOutlinedIcon />} compacto anunciar={false} />
                    ) : (
                        <ul className={styles.listaLocales}>
                            {Object.entries(localesPorNave).map(([nombreNave, locales]) => (
                                <li key={nombreNave} className={styles.local}>
                                    <span className={styles.nombreNave}>{nombreNave === "Tinglado" ? nombreNave : `Nave ${nombreNave}`}</span>
                                    <span className={styles.separadorLocal} aria-hidden="true">-</span>
                                    <span className={styles.numeroLocal}>{locales.length > 1 ? "Locales" : "Local"}{" "}{locales.join(", ")}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            <EnlaceWhatsApp numero={numeroWhatsApp} mensaje={mensajeWhatsApp} className={styles.botonWhatsApp} aria-label={`Contactar a ${operador.nombreFantasia} por WhatsApp`}>
                <WhatsAppIcon className={styles.iconoWhatsApp} aria-hidden="true" />
                <span className={styles.textoWhatsApp}>Contactar por WhatsApp</span>
            </EnlaceWhatsApp>
        </section>
    );

    return contenido;
}
