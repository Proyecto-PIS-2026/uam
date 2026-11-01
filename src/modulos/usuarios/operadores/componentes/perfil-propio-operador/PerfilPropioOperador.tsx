"use client";

import { useState } from "react";
import Image from "next/image";
import EditIcon from "@mui/icons-material/Edit";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import Link from "next/link";
import HojasDecorativas from "@/compartido/HojasDecorativas";
import BotonVolver from "@/compartido/BotonVolver";
import EstadoVacio from "@/compartido/componentes/EstadoVacio";
import type { PerfilPropioOperador } from "../../consultasPerfilPropio";
import FormularioPerfilPropio from "./FormularioPerfilPropio";
import styles from "./PerfilPropioOperador.module.css";

export default function PerfilPropioOperador({ perfil }: { perfil: PerfilPropioOperador }) {
    const [editando, setEditando] = useState(false);
    const [fotoPerfilFallida, setFotoPerfilFallida] = useState(false);
    const inicial = perfil.nombre.trim()[0]?.toUpperCase() ?? "?";

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
                        <p className={styles.whatsapp}>WhatsApp: {perfil.contacto ?? "No hay un número de contacto registrado."}</p>
                        <button type="button" className={styles.editar} onClick={() => setEditando(true)}><EditIcon aria-hidden="true" />Editar</button>
                    </div>
                </header>
                <div className={styles.contenido}>
                    <h2 className={styles.subtitulo}>Locales</h2>
                    {perfil.locales.length === 0 ? (
                        <EstadoVacio titulo="Sin locales registrados" descripcion="No tenés locales asociados." icono={<LocationOnOutlinedIcon />} compacto anunciar={false} />
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
                    <h2 className={styles.subtitulo}>Licencia</h2>
                    <p className={perfil.enLicencia ? styles.licenciaActiva : styles.licenciaInactiva}>
                        {perfil.enLicencia ? "El operador se encuentra en licencia." : "No hay licencia registrada."}
                    </p>
                    {perfil.comentario && (
                        <>
                            <h2 className={styles.subtitulo}>Mensaje de recomendación</h2>
                            <p className={styles.comentario}>{perfil.comentario}</p>
                        </>
                    )}
                     <p className={styles.aviso}>
                        <WarningAmberOutlinedIcon aria-hidden="true" className={styles.iconoAviso} />
                        <span>La declaración de licencia en la aplicación no sustituye la solicitud formal ante el área jurídica de la UAM.</span>
                    </p>
                     <Link href="/cambiar-contrasena" className={styles.cambiarContrasena}>
                         Cambiar contraseña
                     </Link>
                </div>
            </section>
        </main>
    );
}
