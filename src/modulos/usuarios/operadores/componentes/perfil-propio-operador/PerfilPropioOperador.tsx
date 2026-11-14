"use client";

import { useState } from "react";
import Image from "next/image";
import { obtenerIniciales } from "@/modulos/usuarios/obtener-iniciales";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import EventOutlinedIcon from "@mui/icons-material/EventOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import Link from "next/link";
import HojasDecorativas from "@/compartido/HojasDecorativas";
import BotonVolver from "@/compartido/BotonVolver";
import EstadoVacio from "@/compartido/componentes/EstadoVacio";
import type { PerfilPropioOperador } from "../../consultasPerfilPropio";
import FormularioPerfilPropio from "./FormularioPerfilPropio";
import styles from "./PerfilPropioOperador.module.css";
import estilosFormulario from "@/modulos/usuarios/administradores/componentes/modificar-administrador/FormularioModificarAdministrador.module.css";

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

export default function PerfilPropioOperador({ perfil, cambioContrasenaHabilitado = false }: { perfil: PerfilPropioOperador; cambioContrasenaHabilitado?: boolean }) {
    const [editando, setEditando] = useState(false);
    const [fotoPerfilFallida, setFotoPerfilFallida] = useState(false);
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
                            <span className={styles.inicial} aria-hidden="true">{obtenerIniciales(perfil.nombre)}</span>
                        )}
                    </div>
                    <div className={styles.identidad}>
                        <p className={styles.tipo}>Mi perfil</p>
                        <h1 id="perfil-propio-titulo" className={styles.nombre}>{perfil.nombre}</h1>
                    </div>
                </header>
                <div className={styles.contenido}>
                    <div className={styles.datosCuenta}>
                        <div className={styles.datoCuenta}>
                            <span className={styles.iconoDato} aria-hidden="true"><PersonOutlinedIcon /></span>
                            <div className={styles.contenidoDato}>
                                <span className={styles.etiquetaDato}>Usuario:</span>
                                <span className={styles.valorDato}>{perfil.nombreUsuario}</span>
                            </div>
                        </div>
                        <div className={styles.datoCuenta}>
                            <span className={styles.iconoDato} aria-hidden="true"><PhoneOutlinedIcon /></span>
                            <div className={styles.contenidoDato}>
                                <span className={styles.etiquetaDato}>Teléfono:</span>
                                <span className={styles.valorDato}>
                                    {perfil.contacto ?? "No hay un número de contacto registrado."}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className={styles.seccionesPerfil}>
                        <section className={styles.seccionPerfil} aria-labelledby="locales-mi-perfil">
                            <h2 id="locales-mi-perfil" className={styles.subtitulo}>
                                <StorefrontOutlinedIcon aria-hidden="true" />
                                Locales
                            </h2>
                            {perfil.locales.length === 0 ? (
                                <EstadoVacio titulo="Sin locales registrados" descripcion="No tenés locales asociados." icono={<StorefrontOutlinedIcon />} compacto anunciar={false} />
                            ) : (
                                <ul className={styles.locales}>{perfil.locales.map((local) => (
                                    <li className={styles.local} key={`${local.nave}-${local.local}`}>
                                        <div className={styles.identidadLocal}>
                                            <span className={styles.nombreNave}>Nave {local.nave}</span>
                                            <span className={styles.numeroLocal}>Local {local.local}</span>
                                        </div>
                                        <p className={styles.finContrato}>
                                            <EventOutlinedIcon fontSize="small" aria-hidden="true" />
                                            <span>{local.finContrato
                                                ? `Vence: ${formatearFecha(local.finContrato)}`
                                                : "Sin fecha de fin"}</span>
                                        </p>
                                    </li>
                                ))}</ul>
                            )}
                        </section>
                        <section className={styles.seccionPerfil} aria-labelledby="licencia-mi-perfil">
                            <h2 id="licencia-mi-perfil" className={styles.subtitulo}>
                                <DescriptionOutlinedIcon aria-hidden="true" />
                                Licencia
                            </h2>
                            {perfil.enLicencia ? (
                                <div className={styles.comentario}>
                                    <p className={styles.fechasLicencia}>
                                        <EventOutlinedIcon fontSize="small" aria-hidden="true" />
                                        <span>Fecha: {fechasLicencia}</span>
                                    </p>
                                    {licencia.comentario && <p>{licencia.comentario}</p>}
                                </div>
                            ) : (
                                <p className={styles.licenciaInactiva}>No hay licencia registrada.</p>
                            )}
                            <p className={styles.aviso}>
                                <WarningAmberOutlinedIcon aria-hidden="true" className={styles.iconoAviso} />
                                <span>La gestión de licencias debe tramitarse exclusivamente a través de los mecanismos habituales de la UAM. La información exhibida en este sitio tiene carácter meramente informativo.</span>
                            </p>
                        </section>
                    </div>
                </div>
            </section>
            <div className={`${estilosFormulario.acciones} ${styles.acciones}`}>
                <button type="button" className={`${estilosFormulario.cancelar} ${styles.accion}`} onClick={() => setEditando(true)}>
                    Editar
                </button>
                {cambioContrasenaHabilitado && (
                    <Link href="/mi-perfil/cambiar-contrasena" className={`${estilosFormulario.guardar} ${styles.accion}`}>
                        Cambiar contraseña
                    </Link>
                )}
            </div>
        </main>
    );
}
