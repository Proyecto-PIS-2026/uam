"use client";

import { useNotificacionToast } from "@/compartido/componentes/NotificacionToast";

import HojasDecorativas from "../../../../../compartido/HojasDecorativas";
import BotonVolver from "@/compartido/BotonVolver";
import type { PerfilAdminProductor } from "../../acciones/consultas-perfil-productor-admin";

import Button from "@mui/material/Button";
import AddIcon from "@mui/icons-material/Add";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import EditIcon from "@mui/icons-material/Edit";
import { DrawerAltaPublicacionProductor } from "@/modulos/publicaciones/productores/AltaPublicacionProductor";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./PerfilProductorAdmin.module.css";
import CatalogoProductorAdmin from "./CatalogoProductorAdmin";
import Link from "next/link";
import ImagenPerfil from "@/modulos/usuarios/componentes/ImagenPerfil";
import { obtenerIniciales } from "@/modulos/usuarios/obtener-iniciales";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";

type PerfilProductorAdminProps = {
    productor: PerfilAdminProductor;
};


export default function PerfilProductorAdmin({ productor }: PerfilProductorAdminProps) {
    const inicialesProductor = obtenerIniciales(productor.nombreFantasia);
    const [altaAbierta, setAltaAbierta] = useState(false);
    const { notificar } = useNotificacionToast();
    const router = useRouter();
    const [departamentosActualizados, setDepartamentosActualizados] = useState<{ origen: PerfilAdminProductor["publicaciones"]; departamentos: string[] } | null>(null);
    const departamentos = departamentosActualizados?.origen === productor.publicaciones ? departamentosActualizados.departamentos : productor.departamentos;
    const actualizarDepartamentos = useCallback((nuevos: string[]) => {
        setDepartamentosActualizados({ origen: productor.publicaciones, departamentos: nuevos });
    }, [productor.publicaciones]);

    function abrirAlta() {
        setAltaAbierta(true);
    }

    function publicacionCreada(aviso: string) {
        setAltaAbierta(false);
        notificar(aviso, "success");
        router.refresh();
    }

    const contenido = (
        <section className={styles.contenedor} aria-labelledby="nombre-productor">
            <BotonVolver href="/administracion#usuarios" className={styles.volver}>
                Volver al listado de productores
            </BotonVolver>
            <div className={styles.tarjetaPerfil}>
                <header className={styles.encabezado}>
                    <HojasDecorativas />
                    <div className={styles.avatar}>
                        <ImagenPerfil src={productor.fotoPerfil} alt={`Foto de ${productor.nombreFantasia}`} width={96} height={96} className={styles.imagenAvatar}
                            reemplazo={<span aria-hidden="true">{inicialesProductor}</span>} />
                    </div>

                    <div className={styles.identidad}>
                        <p className={styles.tipoPerfil}>Perfil Productor</p>
                        <h1 id="nombre-productor" className={styles.nombre}>{productor.nombreFantasia}</h1>
                    </div>
                </header>
                <div className={styles.tarjetaInformacion}>
                    <div className={styles.contacto}>
                        <span className={styles.iconoContacto} aria-hidden="true"><PhoneOutlinedIcon /></span>
                        <div className={styles.datosContacto}>
                            <span className={styles.etiquetaContacto}>Teléfono:</span>
                            <span className={styles.valorContacto}>{productor.whatsApp || "Sin número de contacto"}</span>
                        </div>
                    </div>
                    <section className={styles.seccionPerfil} aria-labelledby="departamentos-productor-admin">
                        <h2 id="departamentos-productor-admin" className={styles.subtitulo}>
                            <LocationOnOutlinedIcon aria-hidden="true" />Departamentos
                        </h2>
                        <p className={styles.departamentos}>{departamentos.join(" · ") || "-"}</p>
                    </section>
                    <div className={styles.accionesPerfil}>
                        <Link
                            href={`/gestion-productores/${productor.id}/editar`}
                            className={styles.botonEditar}
                            aria-label="Editar productor"
                            title="Editar productor"
                        >
                            <EditIcon aria-hidden="true" className={styles.iconoEditar} />
                            <span>Editar</span>
                        </Link>
                    </div>
                </div>
            </div>

            <div className={styles.filaPublicaciones}>
                <h2 className={styles.subtituloPublicaciones}>Publicaciones ({productor.publicaciones.length})</h2>
                <Button variant="contained" onClick={abrirAlta} startIcon={<AddIcon />} className={styles.botonAlta}>
                    Agregar Producto
                </Button>
            </div>

            <CatalogoProductorAdmin publicaciones={productor.publicaciones} alCambiarDepartamentos={actualizarDepartamentos} />

            {altaAbierta && (
                <DrawerAltaPublicacionProductor productorId={productor.id} disponibilidadInicial={false} abierto={altaAbierta} alCerrar={() => setAltaAbierta(false)} alCrear={publicacionCreada} />
            )}
        </section>
    );

    return contenido;
}
