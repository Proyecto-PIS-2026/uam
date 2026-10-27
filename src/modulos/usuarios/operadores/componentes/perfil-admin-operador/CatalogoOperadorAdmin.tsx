"use client";

import NotificacionToast, { useNotificacionToast } from "@/compartido/componentes/NotificacionToast";
import EstadoVacio from "@/compartido/componentes/EstadoVacio";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmModal } from "@/compartido/componentes/ConfirmModal";
import { useActualizacionesPublicaciones } from "@/modulos/publicaciones/tiempo-real/use-actualizaciones-publicaciones";

import DrawerEditarPublicacion from "../../../../publicaciones/operadores/componentes/DrawerEditarPublicacion";
import type { CambiosPublicacionOperador, PublicacionParaEditar } from "../../../../publicaciones/operadores/tipos";
import type { OpcionesEdicionPublicacion } from "@/modulos/publicaciones/operadores/tipos";
import type { PublicacionPerfilAdmin } from "../../consultas-perfil-admin";
import TarjetaPublicacionAdmin from "./TarjetaPublicacionAdmin";

type CatalogoOperadorAdminProps = {
    operadorId: number;
    publicaciones: PublicacionPerfilAdmin[];
    opciones: OpcionesEdicionPublicacion;
    incrementoPrecio?: number;
};

function paraDrawer(publicacion: PublicacionPerfilAdmin): PublicacionParaEditar {
    return {
        publicacionOperadorId: publicacion.publicacionOperadorId,
        publicacionId: publicacion.id,
        version: publicacion.version,
        especieId: publicacion.especieId,
        variedadId: publicacion.variedadId,
        especie: publicacion.especie,
        variedad: publicacion.variedad,
        presentacion: publicacion.presentacion,
        categoria: publicacion.categoria,
        calibre: publicacion.calibre,
        precio: publicacion.precio,
        cantidadUnidades: publicacion.cantidadUnidades,
        fecha: publicacion.fecha,
        foto: publicacion.foto,
        categoriaId: publicacion.categoriaId,
        calibreId: publicacion.calibreId,
        presentacionId: publicacion.presentacionId,
        paisId: publicacion.paisId,
        disponible: publicacion.disponible,
    };
}

// Muestra las tarjetas y abre el detalle en el drawer de publicaciones, en modo consulta.
// El Administrador puede editar y eliminar las publicaciones del operador, pero no
// tiene la modificación rápida de precio de Mi Mercado.
export default function CatalogoOperadorAdmin({operadorId, publicaciones, opciones, incrementoPrecio}: CatalogoOperadorAdminProps) {
    const router = useRouter();
    useActualizacionesPublicaciones(() => router.refresh(), { operadorPublicoId: operadorId });
    const [seleccionadaId, setSeleccionadaId] = useState<number | null>(null);
    const [drawerAbierto, setDrawerAbierto] = useState(false);
    const [bajaPendiente, setBajaPendiente] = useState(false);
    const [eliminando, setEliminando] = useState(false);
    const { notificacion, notificar, cerrarNotificacion } = useNotificacionToast();

    // Se busca en las props para que, después de router.refresh(), el drawer muestre los datos guardados
    const publicacionSeleccionada = publicaciones.find((publicacion) => publicacion.id === seleccionadaId) ?? null;

    function abrirDrawer(publicacion: PublicacionPerfilAdmin) {
        cerrarNotificacion();
        setSeleccionadaId(publicacion.id);
        setDrawerAbierto(true);
    }

    function cerrarDrawer() {
        setDrawerAbierto(false);
        setBajaPendiente(false);
    }

    async function guardarCambios(publicacionOperadorId: number, cambios: CambiosPublicacionOperador, fotoNueva: File | null) {
        if (!publicacionSeleccionada || publicacionSeleccionada.publicacionOperadorId !== publicacionOperadorId) {
            throw new Error("La publicación seleccionada cambió.");
        }

        const formulario = new FormData();
        formulario.set("cambios", JSON.stringify(cambios));
        if (fotoNueva) formulario.set("fotografia", fotoNueva);

        const respuesta = await fetch(`/api/publicaciones/${publicacionSeleccionada.id}?operadorId=${operadorId}`, { method: "PATCH", body: formulario });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            if (respuesta.status === 409) router.refresh();
            throw new Error(resultado.errores?.[0] ?? "No se pudieron guardar los cambios.");
        }
        router.refresh();
    }

    async function eliminarPublicacion() {
        if (!publicacionSeleccionada || eliminando) return;
        setEliminando(true);
        cerrarNotificacion();
        try {
            const respuesta = await fetch(`/api/publicaciones/${publicacionSeleccionada.id}?operadorId=${operadorId}`, { method: "DELETE" });
            const resultado = await respuesta.json();
            if (!respuesta.ok) {
                throw new Error(resultado.errores?.[0] ?? "No se pudo eliminar la publicación.");
            }
            cerrarDrawer();
            router.refresh();
        } catch (error) {
            notificar(error instanceof Error ? error.message : "No se pudo conectar con el servidor.", "error");
            setBajaPendiente(false);
        } finally {
            setEliminando(false);
        }
    }

    return (
        <>
            <NotificacionToast notificacion={notificacion} alCerrar={cerrarNotificacion} />
            {publicaciones.length == 0 ? (
                <EstadoVacio titulo="Sin publicaciones" descripcion="El operador no tiene publicaciones." icono={<Inventory2OutlinedIcon />} anunciar={false} />
            ) : (
                <ul className="grid grid-cols-1 gap-[var(--espacio-secciones)] md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 tarjetas-compactas">
                    {publicaciones.map((publicacion) => (
                        <li key={publicacion.id}>
                            <TarjetaPublicacionAdmin publicacion={publicacion} onSeleccionar={abrirDrawer} />
                        </li>
                    ))}
                </ul>
            )}

            <DrawerEditarPublicacion
                abierto={drawerAbierto}
                alCerrar={cerrarDrawer}
                modoInicial="consulta"
                publicacion={publicacionSeleccionada ? paraDrawer (publicacionSeleccionada) : null}
                incrementoPrecio={incrementoPrecio}
                alGuardar={guardarCambios}
                alEliminar={() => { cerrarNotificacion(); setBajaPendiente(true); }}
                eliminando={eliminando}
                {...opciones}
            >
                <ConfirmModal
                    abierto={bajaPendiente}
                    titulo="Eliminar publicación"
                    descripcion={publicacionSeleccionada ? `¿Querés eliminar la publicación de ${publicacionSeleccionada.especie}? Esta acción no se puede deshacer.` : ""}
                    textoConfirmar="Sí, eliminar"
                    procesando={eliminando}
                    alCancelar={() => { if (!eliminando) setBajaPendiente(false); }}
                    alConfirmar={() => void eliminarPublicacion()}
                />
            </DrawerEditarPublicacion>
        </>
    );
}
