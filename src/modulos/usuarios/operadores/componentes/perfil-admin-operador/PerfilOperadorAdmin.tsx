"use client";

import { useNotificacionToast } from "@/compartido/componentes/NotificacionToast";
import EstadoVacio from "@/compartido/componentes/EstadoVacio";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";

import { useState } from "react";
import { useRouter } from "next/navigation";
import HojasDecorativas from "../../../../../compartido/HojasDecorativas";
import BotonVolver from "@/compartido/BotonVolver";
import type { PerfilAdminOperador } from "../../consultas-perfil-admin";
import type { OpcionesEdicionPublicacion } from "@/modulos/publicaciones/operadores/tipos";

import Button from "@mui/material/Button";
import AddIcon from "@mui/icons-material/Add";
import NuevaPublicacion from "@/modulos/publicaciones/operadores/componentes/NuevaPublicacion";
import styles from "./PerfilOperadorAdmin.module.css";
import CatalogoOperadorAdmin from "./CatalogoOperadorAdmin";
import ImagenPerfil from "@/modulos/usuarios/componentes/ImagenPerfil";
import { obtenerIniciales } from "@/modulos/usuarios/obtener-iniciales";
import Link from "next/link";
import DescriptionOutlined from "@mui/icons-material/DescriptionOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import EditIcon from "@mui/icons-material/Edit";
import EventOutlinedIcon from "@mui/icons-material/EventOutlined";
import PasswordOutlinedIcon from "@mui/icons-material/PasswordOutlined";

type PerfilOperadorAdminProps = {
    operador: PerfilAdminOperador;
    opciones: OpcionesEdicionPublicacion;
    incrementoPrecio?: number;
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

export default function PerfilOperadorAdmin({ operador, opciones, incrementoPrecio }: PerfilOperadorAdminProps) {
    const inicialesOperador = obtenerIniciales(operador.nombreFantasia);
    const router = useRouter();
    const [altaAbierta, setAltaAbierta] = useState(false);
    const { notificar } = useNotificacionToast();
    const licencia = extraerLicencia(operador.comentario);
    const fechasLicencia = licencia.inicio && licencia.fin
        ? `${formatearFecha(licencia.inicio)} - ${formatearFecha(licencia.fin)}`
        : "Fechas no especificadas";

    function abrirAlta() {
        setAltaAbierta(true);
    }

    function publicacionCreada(aviso: string) {
        setAltaAbierta(false);
        notificar(aviso, "success");
        router.refresh();
    }

    const contenido = (
        <section className={styles.contenedor} aria-labelledby="nombre-operador">
            <BotonVolver href="/administracion#usuarios" className={styles.volver}>
                Volver al listado de operadores
            </BotonVolver>
            <div className={styles.tarjetaPerfil}>
                <header className={styles.encabezado}>
                    <HojasDecorativas />
                    <div className={styles.fotoOperador}>
                        <ImagenPerfil src={operador.fotoPerfil} alt={`Foto de ${operador.nombreFantasia}`} width={96} height={96} className={styles.imagenOperador} reemplazo={<span aria-hidden="true">{inicialesOperador}</span>} />
                    </div>

                    <div className={styles.identidad}>
                        <p className={styles.tipoPerfil}>Perfil Operador</p>
                        <h1 id="nombre-operador" className={styles.nombre}>{operador.nombreFantasia}</h1>
                    </div>
                </header>

                <div className={styles.tarjetaInformacion}>
                    <div className={styles.contacto}>
                        <span className={styles.iconoContacto} aria-hidden="true"><PhoneOutlinedIcon /></span>
                        <div className={styles.datosContacto}>
                            <span className={styles.etiquetaContacto}>Teléfono:</span>
                            <span className={styles.valorContacto}>{operador.whatsApp || "Sin número de contacto"}</span>
                        </div>
                    </div>
                    <div className={styles.seccionesPerfil}>
                        <section className={styles.seccionPerfil} aria-labelledby="locales-operador-admin">
                            <h2 id="locales-operador-admin" className={styles.subtitulo}>
                                <StorefrontOutlinedIcon aria-hidden="true" />Locales
                            </h2>
                            {operador.locales.length === 0 ? (
                                <EstadoVacio titulo="Sin locales registrados" descripcion="El operador no tiene locales registrados." icono={<LocationOnOutlinedIcon />} compacto anunciar={false} />
                            ) : (
                                <ul className={styles.lista}>
                                    {operador.locales.map((local) => (
                                        <li key={`${local.nombreNave}-${local.numeroLocal}`} className={styles.local}>
                                            <div className={styles.identidadLocal}>
                                                <span className={styles.nombreNave}>Nave {local.nombreNave}</span>
                                                <span className={styles.numeroLocal}>Local {local.numeroLocal}</span>
                                            </div>
                                            <p className={styles.finContrato}>
                                                <EventOutlinedIcon fontSize="small" aria-hidden="true" />
                                                <span>{local.finContrato
                                                    ? `Vence: ${formatearFecha(local.finContrato)}`
                                                    : "Sin fecha de fin"}</span>
                                            </p>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                        <section className={styles.seccionPerfil} aria-labelledby="licencia-operador-admin">
                            <h2 id="licencia-operador-admin" className={styles.subtitulo}>
                                <DescriptionOutlined aria-hidden="true" />Licencia
                            </h2>
                            {operador.enLicencia ? (
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
                        </section>
                    </div>
                    <section className={`${styles.contacto} ${styles.restablecimiento}`} aria-labelledby="restablecimiento-operador-admin">
                        <span className={styles.iconoContacto} aria-hidden="true"><PasswordOutlinedIcon /></span>
                        <div className={styles.datosContacto}>
                            <h2 id="restablecimiento-operador-admin" className={styles.etiquetaContacto}>Restablecimiento de contraseña</h2>
                            <span className={`${styles.valorContacto} ${styles.estadoRestablecimiento}`} data-estado={operador.solicitoRestablecimiento ? "solicitado" : "neutro"}>
                                {operador.solicitoRestablecimiento ? "Solicitado" : "No solicitado"}
                            </span>
                        </div>
                    </section>
                    <div className={styles.accionesPerfil}>
                        <Link
                            href={`/gestion-operadores/${operador.id}/editar`}
                            className={styles.botonEditar}
                            aria-label="Editar operador"
                            title="Editar operador"
                        >
                            <EditIcon aria-hidden="true" className={styles.iconoEditar} />
                            <span>Editar</span>
                        </Link>
                    </div>
                </div>
            </div>

            <div className={styles.filaPublicaciones}>
                <h2 className={styles.subtituloPublicaciones}>Publicaciones ({operador.publicaciones.length})</h2>
                <Button variant="contained" onClick={abrirAlta} startIcon={<AddIcon />} className={styles.botonAlta}>
                    Agregar Producto
                </Button>
            </div>

            <CatalogoOperadorAdmin operadorId={operador.id} publicaciones={operador.publicaciones} opciones={opciones} incrementoPrecio={incrementoPrecio} />

            {altaAbierta && (
                <NuevaPublicacion operadorId={operador.id} incrementoPrecio={incrementoPrecio} disponibilidadInicial={false} abierto={altaAbierta} alCerrar={() => setAltaAbierta(false)} alCrear={publicacionCreada} />
            )}
        </section>
    );

    return contenido;
}
