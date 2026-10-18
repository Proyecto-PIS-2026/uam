import Link from "next/link";
import { notFound } from "next/navigation";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import { requerirOperador } from "@/modulos/identidad-acceso/autorizacion/controles";
import { obtenerPerfilProductor } from "@/modulos/usuarios/productores/consultas-productores";
import HojasDecorativas from "@/compartido/HojasDecorativas";
import ImagenPublicacion from "@/modulos/publicaciones/componentes/ImagenPublicacion";
import CatalogoOperador from "@/modulos/usuarios/operadores/componentes/perfil-publico-operador/CatalogoOperador";
import styles from "@/modulos/usuarios/operadores/componentes/perfil-publico-operador/PerfilOperador.module.css";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ nombre: string }> }) {
    await requerirOperador();
    const { nombre } = await params;
    const productor = await obtenerPerfilProductor(nombre);
    if (!productor) notFound();

    return (
        <main className="flex-1 bg-background font-sans text-foreground">
            <section className={styles.contenedor} aria-labelledby="nombre-productor">
                <Link href="/productores" className="mb-4 inline-block text-primary hover:underline">Volver a productores</Link>
                <div className={styles.tarjetaPerfil}>
                    <header className={styles.encabezado}>
                        <HojasDecorativas />
                        <div className={styles.fotoOperador}>
                            <ImagenPublicacion src={productor.fotoPerfil} alt={`Foto de ${productor.nombreFantasia}`} width={96} height={96} className={styles.imagenOperador}
                                reemplazo={<AccountCircleIcon role="img" aria-hidden={false} aria-label={`Foto por defecto de ${productor.nombreFantasia}`} sx={{ fontSize: 64 }} />} />
                        </div>
                        <div className={styles.identidad}>
                            <p className={styles.tipoPerfil}>Perfil Productor</p>
                            <h1 id="nombre-productor" className={styles.nombre}>{productor.nombreFantasia}</h1>
                        </div>
                    </header>
                    <div className={styles.tarjetaInformacion}>
                        <h2 className="mb-3 font-semibold">Puntos de retiro</h2>
                        {productor.ubicaciones.length > 0 ? (
                            <ul className={styles.listaLocales}>
                                {productor.ubicaciones.map((ubicacion) => <li key={ubicacion} className={styles.local}>{ubicacion}</li>)}
                            </ul>
                        ) : <p className="text-muted">Sin puntos de retiro publicados.</p>}
                    </div>
                </div>
            </section>
            <CatalogoOperador key={productor.id} publicaciones={productor.publicaciones} whatsAppOperador={productor.whatsApp} />
        </main>
    );
}
