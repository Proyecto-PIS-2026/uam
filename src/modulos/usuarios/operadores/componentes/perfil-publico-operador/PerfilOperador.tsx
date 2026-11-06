"use client"

import EnlaceWhatsApp from "@/compartido/componentes/EnlaceWhatsApp";
import EstadoVacio from "@/compartido/componentes/EstadoVacio";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import HojasDecorativas from "../../../../../compartido/HojasDecorativas";
import type { PerfilPublicoOperador } from "../../consultas-perfil-publico";

import DescriptionOutlined from "@mui/icons-material/DescriptionOutlined";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import BotonVolver from "@/compartido/BotonVolver";
import ImagenPerfil from "@/modulos/usuarios/componentes/ImagenPerfil";
import styles from "./PerfilOperador.module.css";

type PerfilOperadorProps = {
    operador: PerfilPublicoOperador;
    hrefVolver?: string;
    textoVolver?: string;
};

const registrarContactoWhatsApp = (tipo: "OPERADOR" | "PRODUCTOR", entidadId: number) => {
    fetch("/api/estadisticas/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, entidadId }),
        keepalive: true,
    }).catch((err) => {
        console.error("Error al registrar contacto:", err);
    });
};

function formatearFecha(fecha: string): string {
    const [anio, mes, dia] = fecha.split("-");
    return `${dia}/${mes}/${anio}`;
}

function extraerLicencia(comentario: string | null | undefined) {
    const coincidencia = comentario?.match(/^Licencia:\s*(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})\s*(?:\r?\n\r?\n)?([\s\S]*)$/);
    return {
        inicio: coincidencia?.[1] ?? "",
        fin: coincidencia?.[2] ?? "",
        comentario: coincidencia?.[3]?.trim() ?? comentario?.trim() ?? "",
    };
}

export default function PerfilOperador({ operador,  hrefVolver = "/operadores", textoVolver = "Volver al listado de operadores"  }: PerfilOperadorProps) {
    const licencia = extraerLicencia(operador.comentario);
    const fechasLicencia = licencia.inicio && licencia.fin
        ? `${formatearFecha(licencia.inicio)} - ${formatearFecha(licencia.fin)}`
        : "Fechas no especificadas";
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
            <BotonVolver href={hrefVolver} className={styles.volver}>
                {textoVolver}
            </BotonVolver>
            <div className={styles.tarjetaPerfil}>
                <header className={styles.encabezado}>
                    <HojasDecorativas />
                    <div className={styles.fotoOperador}>
                        <ImagenPerfil src={operador.fotoPerfil} alt={`Foto de ${operador.nombreFantasia}`} width={96} height={96} className={styles.imagenOperador} reemplazo={<span aria-hidden="true">{inicialOperador}</span>} />
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
                    {operador.enLicencia && (
                        <>
                            <h2 className={styles.subtitulo}>
                                <DescriptionOutlined aria-hidden="true" />
                                Licencia
                            </h2>
                            <div className={styles.comentario} role="status">
                                <p className={styles.fechasLicencia}>Fecha: {fechasLicencia}</p>
                                {licencia.comentario && <p>{licencia.comentario}</p>}
                            </div>
                        </>
                    )}
                </div>
            </div>

            <EnlaceWhatsApp numero={numeroWhatsApp} mensaje={mensajeWhatsApp} onClick={() => registrarContactoWhatsApp("OPERADOR", operador.id)} className={styles.botonWhatsApp} aria-label={`Contactar a ${operador.nombreFantasia} por WhatsApp`}>
                <WhatsAppIcon className={styles.iconoWhatsApp} aria-hidden="true" />
                <span className={styles.textoWhatsApp}>Contactar por WhatsApp</span>
            </EnlaceWhatsApp>
        </section>
    );

    return contenido;
}
