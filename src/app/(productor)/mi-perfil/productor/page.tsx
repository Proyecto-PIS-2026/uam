import Link from "next/link";
import { habilitarCambioContrasena } from "@/modulos/identidad-acceso/cambio-contrasena/configuracion";
import { notFound } from "next/navigation";
import { requerirProductor } from "@/modulos/identidad-acceso/autorizacion/controles";
import { obtenerMiPerfilProductor } from "@/modulos/usuarios/productores/perfil-propio/consultas-mi-perfil-productor";
import ImagenPerfil from "@/modulos/usuarios/componentes/ImagenPerfil";
import BotonVolver from "@/compartido/BotonVolver";
import HojasDecorativas from "@/compartido/HojasDecorativas";
import styles from "@/modulos/usuarios/productores/componentes/modificar-productor-por-admin/FormularioModificarProductor.module.css";

export const metadata = { title: "Mi perfil de Productor | UAM" };

export default async function PaginaMiPerfilProductor() {
    await requerirProductor();
    const productor = await obtenerMiPerfilProductor();
    if (!productor) notFound();
    return <main className={styles.pagina}>
        <div className={styles.contenedor}>
            <BotonVolver href="/mi-mercado/productor" className={styles.volver}>Volver a Mi mercado</BotonVolver>
            <header className={styles.encabezado}>
                <HojasDecorativas />
                <h1 className={styles.titulo}>Mi perfil</h1>
                <p className={styles.descripcion}>Consultá y actualizá los datos de tu perfil de Productor.</p>
            </header>
            <section className={styles.seccion} aria-label="Datos de mi perfil">
                <ImagenPerfil src={productor.fotoPerfil} alt={`Foto de ${productor.nombre}`} width={112} height={112} reemplazo={<span>Sin foto de perfil</span>} />
                <h2 className={styles.subtitulo}>{productor.nombre}</h2>
                <p><strong>Número de contacto:</strong> {productor.telefono ? `${productor.codigoPais} ${productor.telefono}` : "Sin número de contacto"}</p>
                <div className={styles.acciones}>
                    <Link href="/mi-perfil/productor/editar" className="boton-primario">Modificar mi perfil</Link>
                    {habilitarCambioContrasena && <Link href="/mi-perfil/cambiar-contrasena" className="boton-secundario">Cambiar contraseña</Link>}
                </div>
            </section>
        </div>
    </main>;
}
