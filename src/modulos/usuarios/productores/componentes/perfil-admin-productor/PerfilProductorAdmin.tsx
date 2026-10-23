"use client";

import HojasDecorativas from "../../../../../compartido/HojasDecorativas";
import type { PerfilAdminProductor } from "../../acciones/consultas-perfil-productor-admin";

import Button from "@mui/material/Button";
import AddIcon from "@mui/icons-material/Add";
import { DrawerAltaPublicacionProductor } from "@/modulos/publicaciones/productores/AltaPublicacionProductor";
import { useState } from "react"; 
import { useRouter } from "next/navigation";
import styles from "./PerfilProductorAdmin.module.css";
import CatalogoProductorAdmin from "./CatalogoProductorAdmin";
import Link from "next/link";
import Image from "next/image";

type PerfilProductorAdminProps = {
    productor: PerfilAdminProductor;
};


export default function PerfilProductorAdmin({ productor }: PerfilProductorAdminProps) {
    const inicialProductor = productor.nombreFantasia.trim()[0]?.toUpperCase();
    const [altaAbierta, setAltaAbierta] = useState(false);
    const [mensaje, setMensaje] = useState("");
    const router = useRouter();

    function abrirAlta() {
        setMensaje("");
        setAltaAbierta(true);
    }

    function publicacionCreada(aviso: string) {
        setAltaAbierta(false);
        setMensaje(aviso);
        router.refresh();
    }

    const contenido = (
        <section className={styles.contenedor} aria-labelledby="nombre-productor">
            <Link href="/administracion#usuarios" className={styles.volver}>
                ← Volver al listado de productores
            </Link>
            <div className={styles.tarjetaPerfil}>
                <header className={styles.encabezado}>
                    <HojasDecorativas />
                    <div className={styles.avatar}>
                        {productor.fotoPerfil ? (
                            <Image src={productor.fotoPerfil} alt={`Foto de ${productor.nombreFantasia}`} width={96} height={96} className={styles.imagenAvatar} />
                        ) : (
                            <span aria-hidden="true">{inicialProductor}</span>
                        )}
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
                        <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                        <span className={styles.textoEditar}>Editar</span>
                    </Link>
                </header>

                <div className={styles.tarjetaInformacion}>
                    <p className={styles.dato}>
                        <span className={styles.etiqueta}>Whatsapp:</span> {productor.whatsApp}
                    </p>
                </div>
            </div>

            {mensaje && <p className={styles.mensajeExito} role="status">{mensaje}</p>}

            <div className={styles.filaPublicaciones}>
                <h2 className={styles.subtituloPublicaciones}>Publicaciones ({productor.publicaciones.length})</h2>
                <Button variant="contained" onClick={abrirAlta} startIcon={<AddIcon />} className={styles.botonAlta}>
                    Agregar Producto
                </Button>
            </div>

            <CatalogoProductorAdmin publicaciones={productor.publicaciones} />

            {altaAbierta && (
                <DrawerAltaPublicacionProductor productorId={productor.id} abierto={altaAbierta} alCerrar={() => setAltaAbierta(false)} alCrear={publicacionCreada} />
            )}
        </section>
    );

    return contenido;
}