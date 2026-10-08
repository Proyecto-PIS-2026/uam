import HojasDecorativas from "../../../../../compartido/HojasDecorativas";
import type { PerfilAdminOperador } from "../../consultas-perfil-admin";
import type { OpcionesEdicionPublicacion } from "@/modulos/publicaciones/operadores/consultas-edicion-publicacion";

import styles from "./PerfilOperadorAdmin.module.css";
import CatalogoOperadorAdmin from "./CatalogoOperadorAdmin";
import Image from "next/image";
import Link from "next/link";

type PerfilOperadorAdminProps = {
    operador: PerfilAdminOperador;
    opciones: OpcionesEdicionPublicacion;
};

function formatearFecha(fecha: string): string {
    const [anio, mes, dia] = fecha.split("-");
    return `${dia}/${mes}/${anio}`;
}

export default function PerfilOperadorAdmin({ operador, opciones }: PerfilOperadorAdminProps) {
    const inicialOperador = operador.nombreFantasia.trim()[0]?.toUpperCase();
    const contenido = (
        <section className={styles.contenedor} aria-labelledby="nombre-operador">
            <Link href="/administracion" className={styles.volver}>
                ← Volver al listado de operadores
            </Link>
            <div className={styles.tarjetaPerfil}>
                <header className={styles.encabezado}>
                    <HojasDecorativas variante="separador" />
                    <div className={styles.fotoOperador}>
                        {operador.fotoPerfil ? (
                            <Image src={operador.fotoPerfil} alt={`Foto de ${operador.nombreFantasia}`} width={96} height={96} className={styles.imagenOperador} />
                        ) : (
                            <span aria-hidden="true">{inicialOperador}</span>
                        )}
                    </div>

                    <div className={styles.identidad}>
                        <p className={styles.tipoPerfil}>Perfil Operador</p>
                        <h1 id="nombre-operador" className={styles.nombre}>{operador.nombreFantasia}</h1>
                    </div>
                    <Link
                        href={`/gestion-operadores/${operador.id}/editar`}
                        className={styles.botonEditar}
                        aria-label="Editar operador"
                        title="Editar operador"
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
                        <span className={styles.etiqueta}>Whatsapp:</span> {operador.whatsApp}
                    </p>

                    <h2 className={styles.subtitulo}>Locales</h2>
                    {operador.locales.length === 0 ? (
                        <p className={styles.vacio}>El operador no tiene locales registrados.</p>
                    ) : (
                        <ul className={styles.lista}>
                            {operador.locales.map((local) => (
                                <li key={`${local.nombreNave}-${local.numeroLocal}`} className={styles.local}>
                                    <span>
                                        <span className={styles.nombreNave}>Nave {local.nombreNave}</span>
                                        {" · "}Local {local.numeroLocal}                                    
                                    </span>
                                    
                                    <span className={styles.finContrato}>
                                        {local.finContrato
                                            ? `Vence: ${formatearFecha(local.finContrato)}`
                                            : "Sin fecha de fin"
                                        }
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            <h2 className={styles.subtituloPublicaciones}>Publicaciones ({operador.publicaciones.length})</h2>
            <CatalogoOperadorAdmin publicaciones={operador.publicaciones} opciones={opciones} />
        </section>
    );

    return contenido;
}
