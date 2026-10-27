"use client";

import NotificacionToast, { useNotificacionToast } from "@/compartido/componentes/NotificacionToast";

import HojasDecorativas from "../../../../../compartido/HojasDecorativas";
import BotonVolver from "@/compartido/BotonVolver";
import type { PerfilAdminProductor } from "../../acciones/consultas-perfil-productor-admin";

import Button from "@mui/material/Button";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import { DrawerAltaPublicacionProductor } from "@/modulos/publicaciones/productores/AltaPublicacionProductor";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./PerfilProductorAdmin.module.css";
import CatalogoProductorAdmin from "./CatalogoProductorAdmin";
import Link from "next/link";
import ImagenPerfil from "@/modulos/usuarios/componentes/ImagenPerfil";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";

type PerfilProductorAdminProps = {
    productor: PerfilAdminProductor;
};


export default function PerfilProductorAdmin({ productor }: PerfilProductorAdminProps) {
    const inicialProductor = productor.nombreFantasia.trim()[0]?.toUpperCase();
    const [altaAbierta, setAltaAbierta] = useState(false);
    const { notificacion, notificar, cerrarNotificacion } = useNotificacionToast();
    const router = useRouter();
    const [departamentosActualizados, setDepartamentosActualizados] = useState<{ origen: PerfilAdminProductor["publicaciones"]; departamentos: string[] } | null>(null);
    const departamentos = departamentosActualizados?.origen === productor.publicaciones ? departamentosActualizados.departamentos : productor.departamentos;
    const actualizarDepartamentos = useCallback((nuevos: string[]) => {
        setDepartamentosActualizados({ origen: productor.publicaciones, departamentos: nuevos });
    }, [productor.publicaciones]);

    function abrirAlta() {
        cerrarNotificacion();
        setAltaAbierta(true);
    }

    function publicacionCreada(aviso: string) {
        setAltaAbierta(false);
        notificar(aviso, "success");
        router.refresh();
    }

    const contenido = (
        <section className={styles.contenedor} aria-labelledby="nombre-productor">
            <NotificacionToast notificacion={notificacion} alCerrar={cerrarNotificacion} />
            <BotonVolver href="/administracion#usuarios" className={styles.volver}>
                Volver al listado de productores
            </BotonVolver>
            <div className={styles.tarjetaPerfil}>
                <header className={styles.encabezado}>
                    <HojasDecorativas />
                    <div className={styles.avatar}>
                        <ImagenPerfil src={productor.fotoPerfil} alt={`Foto de ${productor.nombreFantasia}`} width={96} height={96} className={styles.imagenAvatar}
                            reemplazo={<span aria-hidden="true">{inicialProductor}</span>} />
                    </div>

                    <div className={styles.identidad}>
                        <p className={styles.tipoPerfil}>Perfil Productor</p>
                        <h1 id="nombre-productor" className={styles.nombre}>{productor.nombreFantasia}</h1>
                    </div>
                    <Link
                        href={`/gestion-productores/${productor.id}/editar`}
                        className={styles.botonEditar}
                        aria-label="Editar productor"
                        title="Editar productor"
                    >
                        <EditIcon aria-hidden="true" className={styles.iconoEditar} />
                        <span>Editar</span>
                    </Link>
                </header>

                <div className={styles.tarjetaInformacion}>
                    <p className={`${styles.dato} ${styles.departamentos}`}>
                        <LocationOnOutlinedIcon fontSize="small" aria-hidden="true" />
                        <span><span className={styles.etiqueta}>Departamentos:</span> {departamentos.join(" · ") || "-"}</span>
                    </p>
                    <p className={styles.dato}>
                        <span className={styles.etiqueta}>Whatsapp:</span> {productor.whatsApp}
                    </p>
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
