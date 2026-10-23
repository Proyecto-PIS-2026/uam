"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DrawerPublicacionProductor from "../../../../publicaciones/mi-mercado/componentes/DrawerPublicacionProductor";
import type { PublicacionMiMercadoProductor } from "../../../../publicaciones/mi-mercado/consultas-mi-mercado-productor";
import type { PublicacionPerfilAdminProductor } from "../../acciones/consultas-perfil-productor-admin";
import TarjetaPublicacionProductorAdmin from "./TarjetaPublicacionProductorAdmin";
import styles from "./PerfilProductorAdmin.module.css";

type CatalogoProductorAdminProps = {
    publicaciones: PublicacionPerfilAdminProductor[];
};

function paraConsulta(publicacion: PublicacionPerfilAdminProductor): PublicacionMiMercadoProductor {
    return {
        id: publicacion.id,
        publicacionProductorId: publicacion.publicacionProductorId,
        paisId: publicacion.paisId,
        pais: publicacion.pais,
        foto: publicacion.foto,
        precio: publicacion.precio,
        cantidadUnidades: publicacion.cantidadUnidades,
        fecha: publicacion.fecha,
        publicacionActiva: true,
        publicacionDisponible: publicacion.disponible,
        presentacion: {
            id: publicacion.presentacionId,
            nombrePresentacion: publicacion.presentacion,
            variedad: {
                id: publicacion.variedadId,
                nombreVariedad: publicacion.variedad,
                especie: {
                    id: publicacion.especieId,
                    nombreEspecie: publicacion.especie,
                    fotoEspecie: null,
                },
            },
        },
        categoria: { id: publicacion.categoriaId, nombreCategoria: publicacion.categoria },
        calibre: { id: publicacion.calibreId, codigoCalibre: publicacion.codigoCalibre, nombreCalibre: publicacion.calibre },
        ubicaciones: publicacion.ubicaciones.map((ubicacion, indice) => ({
            id: indice,
            nombreUbicacion: ubicacion.nombre,
            urlMaps: ubicacion.urlMaps,
        })),
    };
}

function paraTarjeta(publicacion: PublicacionMiMercadoProductor): PublicacionPerfilAdminProductor {
    return {
        id: publicacion.id,
        publicacionProductorId: publicacion.publicacionProductorId,
        especieId: publicacion.presentacion.variedad.especie.id,
        variedadId: publicacion.presentacion.variedad.id,
        presentacionId: publicacion.presentacion.id,
        categoriaId: publicacion.categoria.id,
        calibreId: publicacion.calibre.id,
        paisId: publicacion.paisId,
        pais: publicacion.pais,
        foto: publicacion.foto,
        precio: publicacion.precio,
        cantidadUnidades: publicacion.cantidadUnidades,
        fecha: publicacion.fecha,
        disponible: publicacion.publicacionDisponible,
        especie: publicacion.presentacion.variedad.especie.nombreEspecie,
        variedad: publicacion.presentacion.variedad.nombreVariedad,
        presentacion: publicacion.presentacion.nombrePresentacion,
        categoria: publicacion.categoria.nombreCategoria,
        calibre: publicacion.calibre.nombreCalibre,
        codigoCalibre: publicacion.calibre.codigoCalibre,
        ubicaciones: publicacion.ubicaciones.map((ubicacion) => ({
            nombre: ubicacion.nombreUbicacion,
            urlMaps: ubicacion.urlMaps,
        })),
    };
}

export default function CatalogoProductorAdmin({ publicaciones }: CatalogoProductorAdminProps) {
    const router = useRouter();
    const [mensaje, setMensaje] = useState("");
    const publicacionesConsulta = useMemo(() => publicaciones.map(paraConsulta), [publicaciones]);
    const [seleccionId, setSeleccionId] = useState<number | null>(null);
    const [actualizadas, setActualizadas] = useState<{
        origen: PublicacionPerfilAdminProductor[];
        datos: PublicacionMiMercadoProductor[];
    } | null>(null);
    const publicacionesActuales = actualizadas?.origen === publicaciones ? actualizadas.datos : publicacionesConsulta;
    const seleccionada = publicacionesActuales.find((publicacion) => publicacion.id === seleccionId) ?? null;

    function actualizarPublicacion(guardada: PublicacionMiMercadoProductor) {
        setActualizadas((anteriores) => {
            const actuales = anteriores?.origen === publicaciones ? anteriores.datos : publicacionesConsulta;
            return {
                origen: publicaciones,
                datos: actuales.map((publicacion) => publicacion.id === guardada.id ? guardada : publicacion),
            };
        });
    }

    function eliminarPublicacion(aviso: string) {
        setActualizadas((anteriores) => {
            const actuales = anteriores?.origen === publicaciones ? anteriores.datos : publicacionesConsulta;
            return {
                origen: publicaciones,
                datos: actuales.filter((publicacion) => publicacion.id !== seleccionId),
            };
        });
        setSeleccionId(null);
        setMensaje(aviso);
        router.refresh();
    }

    return (
        <>
            {mensaje && <p className={styles.mensajeExito} role="status">{mensaje}</p>}
            {publicacionesActuales.length === 0 ? (
                <p>El productor no tiene publicaciones.</p>
            ) : (
                <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    {publicacionesActuales.map((publicacion) => (
                        <li key={publicacion.id}>
                            <TarjetaPublicacionProductorAdmin
                                publicacion={paraTarjeta(publicacion)}
                                alConsultar={() => setSeleccionId(publicacion.id)}
                            />
                        </li>
                    ))}
                </ul>
            )}
            <DrawerPublicacionProductor
                publicacion={seleccionada}
                alCerrar={() => setSeleccionId(null)}
                alGuardar={actualizarPublicacion}
                alEliminada={eliminarPublicacion}
            />
        </>
    );
}
