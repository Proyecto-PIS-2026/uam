import Link from "next/link";
import { habilitarCambioContrasena } from "@/modulos/identidad-acceso/cambio-contrasena/configuracion";
import { notFound } from "next/navigation";
import { requerirProductor } from "@/modulos/identidad-acceso/autorizacion/controles";
import { obtenerMiPerfilProductor } from "@/modulos/usuarios/productores/perfil-propio/consultas-mi-perfil-productor";
import ImagenPerfil from "@/modulos/usuarios/componentes/ImagenPerfil";
import BotonVolver from "@/compartido/BotonVolver";
import HojasDecorativas from "@/compartido/HojasDecorativas";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import EditIcon from "@mui/icons-material/Edit";
import styles from "./PerfilPropioProductor.module.css";

export const metadata = { title: "Mi perfil de Productor | UAM" };

export default async function PaginaMiPerfilProductor() {
    await requerirProductor();
    const productor = await obtenerMiPerfilProductor();
    if (!productor) notFound();
    return <main className={styles.pagina}>
        <BotonVolver href="/mi-mercado/productor" className={styles.volver}>Volver a Mi mercado</BotonVolver>
        <section className={styles.tarjeta} aria-labelledby="perfil-propio-titulo">
            <header className={styles.encabezado}>
                <HojasDecorativas />
                <div className={styles.fotoProductor}>
                    <ImagenPerfil
                        src={productor.fotoPerfil}
                        alt={`Foto de ${productor.nombre}`}
                        width={96}
                        height={96}
                        className={styles.foto}
                        reemplazo={<AccountCircleIcon className={styles.iconoSinFoto} aria-hidden="true" />}
                    />
                </div>
                <div className={styles.identidad}>
                    <p className={styles.tipo}>Mi perfil</p>
                    <h1 id="perfil-propio-titulo" className={styles.nombre}>{productor.nombre}</h1>
                    <p className={styles.usuario}>Usuario: {productor.nombreUsuario}</p>
                </div>
                <div className={styles.accionesEncabezado}>
                    <p className={styles.contacto}>
                        <span className={styles.etiquetaContacto}>Whatsapp:</span>
                        <span>{productor.telefono
                            ? `${productor.codigoPais} ${productor.telefono}`
                            : "Sin número de contacto"}</span>
                    </p>
                    <Link href="/mi-perfil/productor/editar" className={styles.editar}>
                        <EditIcon aria-hidden="true" />
                        Editar
                    </Link>
                </div>
            </header>
            <div className={styles.contenido}>
                {habilitarCambioContrasena && (
                    <Link href="/mi-perfil/cambiar-contrasena" className={styles.cambiarContrasena}>
                        Cambiar contraseña
                    </Link>
                )}
            </div>
        </section>
    </main>;
}
