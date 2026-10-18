"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { ConfirmModal } from "../../../../../compartido/componentes/ConfirmModal";
import DrawerEditarPublicacion, { type PublicacionParaEditar } from "../../../../publicaciones/operadores/componentes/DrawerEditarPublicacion";
import type { OpcionesEdicionPublicacion } from "@/modulos/publicaciones/operadores/consultas-edicion-publicacion";
import type { CambiosPublicacionOperador } from "@/modulos/publicaciones/operadores/modificar-publicacion";
import type { PublicacionPerfilAdmin } from "../../consultas-perfil-admin";
import TarjetaPublicacionAdmin from "./TarjetaPublicacionAdmin";

type CatalogoOperadorAdminProps = {
    operadorId: number;
    publicaciones: PublicacionPerfilAdmin[];
    opciones: OpcionesEdicionPublicacion;
};

function paraDrawer(publicacion: PublicacionPerfilAdmin): PublicacionParaEditar {
    return {
        publicacionOperadorId: publicacion.publicacionOperadorId,
        publicacionId: publicacion.id,
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
export default function CatalogoOperadorAdmin({operadorId, publicaciones, opciones}: CatalogoOperadorAdminProps) {
    const router = useRouter();
    const [seleccionadaId, setSeleccionadaId] = useState<number | null>(null);
    const [drawerAbierto, setDrawerAbierto] = useState(false);
    const [bajaPendiente, setBajaPendiente] = useState(false);
    const [eliminando, setEliminando] = useState(false);
    const [error, setError] = useState("");

    // Se busca en las props para que, después de router.refresh(), el drawer muestre los datos guardados
    const publicacionSeleccionada = publicaciones.find((publicacion) => publicacion.id === seleccionadaId) ?? null;

    function abrirDrawer(publicacion: PublicacionPerfilAdmin) {
        setError("");
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
            throw new Error(resultado.errores?.[0] ?? "No se pudieron guardar los cambios.");
        }
        router.refresh();
    }

    async function eliminarPublicacion() {
        if (!publicacionSeleccionada || eliminando) return;
        setEliminando(true);
        setError("");
        try {
            const respuesta = await fetch(`/api/publicaciones/${publicacionSeleccionada.id}?operadorId=${operadorId}`, { method: "DELETE" });
            const resultado = await respuesta.json();
            if (!respuesta.ok) {
                throw new Error(resultado.errores?.[0] ?? "No se pudo eliminar la publicación.");
            }
            cerrarDrawer();
            router.refresh();
        } catch (error) {
            setError(error instanceof Error ? error.message : "No se pudo conectar con el servidor.");
            setBajaPendiente(false);
        } finally {
            setEliminando(false);
        }
    }

    return (
        <>
            {publicaciones.length == 0 ? (
                <p>El operador no tiene publicaciones.</p>
            ) : (
                <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
                alGuardar={guardarCambios}
                alEliminar={() => { setError(""); setBajaPendiente(true); }}
                eliminando={eliminando}
                errorConsulta={error}
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