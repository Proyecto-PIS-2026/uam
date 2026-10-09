"use client";

import { useState } from "react";

import DrawerEditarPublicacion, { type PublicacionParaEditar } from "../../../../publicaciones/operadores/componentes/DrawerEditarPublicacion";
import type { OpcionesEdicionPublicacion } from "@/modulos/publicaciones/operadores/consultas-edicion-publicacion";
import type { PublicacionPerfilAdmin } from "../../consultas-perfil-admin";
import TarjetaPublicacionAdmin from "./TarjetaPublicacionAdmin";

type CatalogoOperadorAdminProps = {
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
// No se pasa alGuardar ni alEliminar: Editar y Eliminar aparecen deshabiilitados
// hasta que s eimplemente la edición de publicaciones para el Administrador.
export default function CatalogoOperadorAdmin({publicaciones, opciones}: CatalogoOperadorAdminProps) {
    const [publicacionSeleccionada, setPublicacionSeleccionada] = useState<PublicacionPerfilAdmin | null>(null);
    const [drawerAbierto, setDrawerAbierto] = useState(false);

    function abrirDrawer(publicacion: PublicacionPerfilAdmin) {
        setPublicacionSeleccionada(publicacion);
        setDrawerAbierto(true);
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
                alCerrar={() => setDrawerAbierto(false)}
                modoInicial="consulta"
                publicacion={publicacionSeleccionada ? paraDrawer (publicacionSeleccionada) : null}
                {...opciones}
            />
        </>         
    );
}
