"use client";

import { useState } from "react";
import Image from "next/image";
import EditIcon from "@mui/icons-material/Edit";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import Link from "next/link";
import HojasDecorativas from "@/compartido/HojasDecorativas";
import BotonVolver from "@/compartido/BotonVolver";
import EstadoVacio from "@/compartido/componentes/EstadoVacio";
import type { PerfilPropioOperador } from "../../consultasPerfilPropio";
import FormularioPerfilPropio from "./FormularioPerfilPropio";
import styles from "./PerfilPropioOperador.module.css";
import { AssignmentLateOutlined, DescriptionOutlined } from "@mui/icons-material";

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

export default function PerfilPropioOperador({ perfil }: { perfil: PerfilPropioOperador }) {
    const [editando, setEditando] = useState(false);
    const [fotoPerfilFallida, setFotoPerfilFallida] = useState(false);
    const inicial = perfil.nombre.trim()[0]?.toUpperCase() ?? "?";
    const licencia = extraerLicencia(perfil.comentario);
    const fechasLicencia = licencia.inicio && licencia.fin
        ? `${formatearFecha(licencia.inicio)} - ${formatearFecha(licencia.fin)}`
        : "Fechas no especificadas";

    if (editando) return <FormularioPerfilPropio perfil={perfil} alCancelar={() => setEditando(false)} />;

    return (
        <main className={styles.pagina}>
            <BotonVolver href="/mi-mercado" className={styles.volver}>
                Volver a mi mercado
            </BotonVolver>
            <section className={styles.tarjeta} aria-labelledby="perfil-propio-titulo">
                <header className={styles.encabezado}>
                    <HojasDecorativas />
                    <div className={styles.fotoOperador}>
                        {perfil.fotoPerfil && !fotoPerfilFallida ? (
                            <Image
                                src={perfil.fotoPerfil}
                                alt={`Foto de ${perfil.nombre}`}
                                unoptimized={perfil.fotoPerfil.startsWith("/api/")}
                                width={40}
                                height={40}
                                className={styles.foto}
                                onError={() => setFotoPerfilFallida(true)}
                            />
                        ) : (
                            <AccountCircleIcon className={styles.iconoSinFoto} aria-hidden="true" />
                        )}
                    </div>
                    <div className={styles.identidad}>
                        <p className={styles.tipo}>Mi perfil</p>
                        <h1 id="perfil-propio-titulo" className={styles.nombre}>{perfil.nombre}</h1>
                        <p className={styles.usuario}>Usuario: {perfil.nombreUsuario}</p>
                    </div>
                    <div className={styles.accionesEncabezado}>
                        <p className={styles.whatsapp}>
                            <WhatsAppIcon aria-hidden="true" />
                            <span>WhatsApp: {perfil.contacto ?? "No hay un número de contacto registrado."}</span>
                        </p>
                        <button type="button" className={styles.editar} onClick={() => setEditando(true)}><EditIcon aria-hidden="true" />Editar</button>
                    </div>
                </header>
                <div className={styles.contenido}>
                    <h2 className={styles.subtitulo}>
                        <StorefrontOutlinedIcon aria-hidden="true" />
                        Locales
                    </h2>
                    {perfil.locales.length === 0 ? (
                        <EstadoVacio titulo="Sin locales registrados" descripcion="No tenés locales asociados." icono={<StorefrontOutlinedIcon />} compacto anunciar={false} />
                    ) : (
                        <ul className={styles.locales}>{perfil.locales.map((local) => (
                            <li className={styles.local} key={`${local.nave}-${local.local}`}>
                                <span>
                                    <span className={styles.nombreNave}>Nave {local.nave}</span>
                                    {" · "}Local {local.local}
                                </span>
                                <span className={styles.finContrato}>
                                    {local.finContrato
                                        ? `Vence: ${formatearFecha(local.finContrato)}`
                                        : "Sin fecha de fin"}
                                </span>
                            </li>
                        ))}</ul>
                    )}
                    <h2 className={styles.subtitulo}>
                        <DescriptionOutlined aria-hidden="true" />
                        Licencia
                    </h2>
                    {perfil.enLicencia ? (
                        <div className={styles.comentario}>
                            <p className={styles.fechasLicencia}>Fecha: {fechasLicencia}</p>
                            {licencia.comentario && <p>{licencia.comentario}</p>}
                        </div>
                    ) : (
                        <p className={styles.licenciaInactiva}>No hay licencia registrada.</p>
                    )}
                    <div className={styles.filaAcciones}>
                        <p className={styles.aviso}>
                            <WarningAmberOutlinedIcon aria-hidden="true" className={styles.iconoAviso} />
                            <span>La declaración de licencia en la aplicación no sustituye la solicitud formal ante el área jurídica de la UAM.</span>
                        </p>
                        <Link href="/mi-perfil/cambiar-contrasena" className={styles.cambiarContrasena}>
                            Cambiar contraseña
                        </Link>
                    </div>
                        
                </div>
            </section>
        </main>
    );
}
