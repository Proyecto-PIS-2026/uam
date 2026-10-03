"use client";

import { useState } from "react";
import type { PublicacionPerfilAdmin } from "../../consultas-perfil-admin";
import DrawerPublicacionAdmin from "./DrawerPublicacionAdmin";
import TarjetaPublicacionAdmin from "./TarjetaPublicacionAdmin";
import styles from "./CatalogoOperadorAdmin.module.css";

type CatalogoOperadorAdminProps = {
    publicaciones: PublicacionPerfilAdmin[];
};

// Versión simplificada de CatalogoOperador para el administrador:
// muestra las tarjetas y abre el detalle en un drawer, sin filtros ni agrupación
export default function CatalogoOperadorAdmin({publicaciones}: CatalogoOperadorAdminProps) {
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

            <DrawerPublicacionAdmin publicacion={publicacionSeleccionada} open={drawerAbierto} onOpenChange={setDrawerAbierto} />
        </>         
    );
}
