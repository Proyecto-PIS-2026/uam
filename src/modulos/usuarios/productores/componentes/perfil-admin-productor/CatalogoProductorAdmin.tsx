"use client";

import { useEffect, useMemo, useState } from "react";
import { obtenerDepartamentos } from "@/compartido/departamentos-uruguay";
import { useRouter } from "next/navigation";
import { useNotificacionToast } from "@/compartido/componentes/NotificacionToast";
import EstadoVacio from "@/compartido/componentes/EstadoVacio";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import DrawerPublicacionProductor from "../../../../publicaciones/mi-mercado/componentes/DrawerPublicacionProductor";
import type { PublicacionMiMercadoProductor } from "../../../../publicaciones/mi-mercado/consultas-mi-mercado-productor";
import type { PublicacionPerfilAdminProductor } from "../../acciones/consultas-perfil-productor-admin";
import TarjetaPublicacionProductorAdmin from "./TarjetaPublicacionProductorAdmin";

type CatalogoProductorAdminProps = {
    publicaciones: PublicacionPerfilAdminProductor[];
    alCambiarDepartamentos?: (departamentos: string[]) => void;
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
        especie: { id: publicacion.especieId, nombreEspecie: publicacion.especie, fotoEspecie: null },
        variedad: publicacion.variedadId === null ? null : { id: publicacion.variedadId, nombreVariedad: publicacion.variedad },
        presentacion: publicacion.presentacionId === null ? null : { id: publicacion.presentacionId, nombrePresentacion: publicacion.presentacion },
        categoria: publicacion.categoriaId === null ? null : { id: publicacion.categoriaId, nombreCategoria: publicacion.categoria },
        calibre: publicacion.calibreId === null ? null : { id: publicacion.calibreId, codigoCalibre: publicacion.codigoCalibre, nombreCalibre: publicacion.calibre },
        ubicaciones: publicacion.ubicaciones.map((ubicacion, indice) => ({
            id: indice,
            nombreUbicacion: ubicacion.nombre,
            urlMaps: ubicacion.urlMaps,
            departamento: ubicacion.departamento ?? null,
        })),
    };
}

function paraTarjeta(publicacion: PublicacionMiMercadoProductor): PublicacionPerfilAdminProductor {
    return {
        id: publicacion.id,
        publicacionProductorId: publicacion.publicacionProductorId,
        especieId: publicacion.especie.id,
        variedadId: publicacion.variedad?.id ?? null,
        presentacionId: publicacion.presentacion?.id ?? null,
        categoriaId: publicacion.categoria?.id ?? null,
        calibreId: publicacion.calibre?.id ?? null,
        paisId: publicacion.paisId,
        pais: publicacion.pais,
        foto: publicacion.foto,
        precio: publicacion.precio,
        cantidadUnidades: publicacion.cantidadUnidades,
        fecha: publicacion.fecha,
        disponible: publicacion.publicacionDisponible,
        especie: publicacion.especie.nombreEspecie,
        variedad: publicacion.variedad?.nombreVariedad ?? "",
        presentacion: publicacion.presentacion?.nombrePresentacion ?? "",
        categoria: publicacion.categoria?.nombreCategoria ?? "",
        calibre: publicacion.calibre?.nombreCalibre ?? "",
        codigoCalibre: publicacion.calibre?.codigoCalibre ?? "",
        ubicaciones: publicacion.ubicaciones.map((ubicacion) => ({
            nombre: ubicacion.nombreUbicacion,
            urlMaps: ubicacion.urlMaps,
            departamento: ubicacion.departamento ?? null,
        })),
    };
}

export default function CatalogoProductorAdmin({ publicaciones, alCambiarDepartamentos }: CatalogoProductorAdminProps) {
    const router = useRouter();
    const { notificar } = useNotificacionToast();
    const publicacionesConsulta = useMemo(() => publicaciones.map(paraConsulta), [publicaciones]);
    const [seleccionId, setSeleccionId] = useState<number | null>(null);
    const [actualizadas, setActualizadas] = useState<{
        origen: PublicacionPerfilAdminProductor[];
        datos: PublicacionMiMercadoProductor[];
    } | null>(null);
    const publicacionesActuales = actualizadas?.origen === publicaciones ? actualizadas.datos : publicacionesConsulta;
    const seleccionada = publicacionesActuales.find((publicacion) => publicacion.id === seleccionId) ?? null;

    useEffect(() => {
        alCambiarDepartamentos?.(obtenerDepartamentos(publicacionesActuales.flatMap((publicacion) => publicacion.ubicaciones)));
    }, [publicacionesActuales, alCambiarDepartamentos]);

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
        setSeleccionId((actual) => actual === seleccionId ? null : actual);
        notificar(aviso, "success");
        router.refresh();
    }

    return (
        <>
            {publicacionesActuales.length === 0 ? (
                <EstadoVacio titulo="Sin publicaciones" descripcion="El productor no tiene publicaciones." icono={<Inventory2OutlinedIcon />} anunciar={false} />
            ) : (
                <ul className="grid grid-cols-1 gap-[var(--espacio-secciones)] md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 tarjetas-compactas">
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
