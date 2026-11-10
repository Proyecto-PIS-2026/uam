"use client";

import EnlaceWhatsApp from "@/compartido/componentes/EnlaceWhatsApp";
import HojasDecorativas from "../../../../../../compartido/HojasDecorativas";
import type { PerfilProductorPorOperador } from "../../../acciones/consultas-perfil-por-operador";
import BotonVolver from "@/compartido/BotonVolver";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import ImagenPerfil from "@/modulos/usuarios/componentes/ImagenPerfil";
import { obtenerIniciales } from "@/modulos/usuarios/obtener-iniciales";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";

import styles from "./PerfilProductor.module.css";

type PerfilProductorProps  = {
    productor: PerfilProductorPorOperador;
    hrefVolver?: string;
    textoVolver?: string;
};

const registrarContactoWhatsApp = (tipo: "OPERADOR" | "PRODUCTOR", entidadId: number) => {
    fetch("/api/estadisticas/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, entidadId }),
        keepalive: true, // Esto evita que el navegador cancele la petición al abrir WhatsApp o cerrar la ventana
    }).catch((err) => {
        console.error("Error al registrar contacto:", err);
    });
};

export default function PerfilProductor({ productor, hrefVolver = "/productores", textoVolver = "Volver al listado de productores" }: PerfilProductorProps) {
    const inicialesProductor = obtenerIniciales(productor.nombreFantasia);

    const numeroWhatsApp = productor.whatsApp.replace(/\D/g, "");
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
                        <ImagenPerfil src={productor.fotoPerfil} alt={`Foto de ${productor.nombreFantasia}`} width={96} height={96} className={styles.imagenOperador}
                            reemplazo={<span aria-hidden="true">{inicialesProductor}</span>} />
                    </div>
                    <div className={styles.identidad}>
                        <p className={styles.tipoPerfil}>Perfil Productor</p>
                        <h1 id="nombre-operador" className={styles.nombre}>{productor.nombreFantasia}</h1>
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
                    <section className={styles.seccionPerfil} aria-labelledby="departamentos-productor">
                        <h2 id="departamentos-productor" className={styles.subtitulo}>
                            <LocationOnOutlinedIcon aria-hidden="true" />Departamentos
                        </h2>
                        <p className={styles.departamentos}>{productor.departamentos.join(" · ") || "-"}</p>
                    </section>
                </div>
            </div>
            <EnlaceWhatsApp numero={numeroWhatsApp} mensaje={mensajeWhatsApp} onClick={() => registrarContactoWhatsApp("PRODUCTOR", productor.id)} className={styles.botonWhatsApp} aria-label={`Contactar a ${productor.nombreFantasia} por WhatsApp`}>
                <WhatsAppIcon className={styles.iconoWhatsApp} aria-hidden="true" />
                <span className={styles.textoWhatsApp}>Contactar por WhatsApp</span>
            </EnlaceWhatsApp>
        </section>
    );

    return contenido;
}
