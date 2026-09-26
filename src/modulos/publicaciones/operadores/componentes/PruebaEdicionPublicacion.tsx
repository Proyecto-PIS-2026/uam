"use client";

import { useEffect, useRef, useState } from "react";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import Image from "next/image";
import DrawerEditarPublicacion, { type OpcionEdicion, type PublicacionParaEditar } from "./DrawerEditarPublicacion";
import type { CambiosPublicacionOperador } from "../modificar-publicacion";
import type { OpcionesEdicionPublicacion } from "../consultas-edicion-publicacion";
import styles from "./PruebaEdicionPublicacion.module.css";

// ESTOS ARCHIVOS SE VAN A BORRAR, ES SOLO PARA PROBAR EL DRAWER MIENTRAS NO ESTA LA VISTA

type PruebaEdicionPublicacionProps = {
    opciones: OpcionesEdicionPublicacion;
};

function crearPublicacionInicial(opciones: OpcionesEdicionPublicacion): PublicacionParaEditar | null {
    const calibre = opciones.calibres.find((opcion) => opcion.nombre === "G - GRANDE") ?? opciones.calibres[0];
    if (!calibre) return null;

    let primeraPublicacion: PublicacionParaEditar | null = null;

    for (const presentacion of opciones.presentaciones) {
        const variedad = opciones.variedades.find((opcion) => opcion.id === presentacion.variedadId);
        if (!variedad) continue;
        const especie = opciones.especies.find((opcion) => opcion.id === variedad.especieId);
        if (!especie) continue;
        const categoriasCompatibles = opciones.categorias.filter((opcion) => opcion.especieId === null || opcion.especieId === especie.id);
        const categoria = categoriasCompatibles.find((opcion) => opcion.nombre === "I") ?? categoriasCompatibles[0];
        if (!categoria) continue;

        const publicacion: PublicacionParaEditar = {
            publicacionOperadorId: 13,
            publicacionId: 52,
            especieId: especie.id,
            variedadId: variedad.id,
            especie: especie.nombre,
            variedad: variedad.nombre,
            precio: "180.00",
            foto: null,
            categoriaId: categoria.id,
            calibreId: calibre.id,
            presentacionId: presentacion.id,
            disponible: true,
        };

        primeraPublicacion ??= publicacion;
        if (especie.nombre === "Manzana" && variedad.nombre === "Gala" && presentacion.nombre === "Cajon") {
            return publicacion;
        }
    }

    return primeraPublicacion;
}

function nombreOpcion(opciones: OpcionEdicion[], id: number) {
    return opciones.find((opcion) => opcion.id === id)?.nombre ?? "Sin definir";
}

export default function PruebaEdicionPublicacion({ opciones }: PruebaEdicionPublicacionProps) {
    const { especies, variedades, presentaciones, categorias, calibres } = opciones;
    const [publicacion, setPublicacion] = useState(() => crearPublicacionInicial(opciones));
    const [abierto, setAbierto] = useState(false);
    const [aviso, setAviso] = useState("");
    const fotoTemporalRef = useRef<string | null>(null);

    useEffect(() => {
        return () => {
            if (fotoTemporalRef.current) URL.revokeObjectURL(fotoTemporalRef.current);
        };
    }, []);

    function guardarCambios(publicacionOperadorId: number, cambios: CambiosPublicacionOperador, fotoNueva: File | null) {
        if (!publicacion || publicacionOperadorId !== publicacion.publicacionOperadorId) {
            throw new Error("La publicación seleccionada cambió.");
        }

        let foto = cambios.foto;
        if (fotoNueva) {
            if (fotoTemporalRef.current) URL.revokeObjectURL(fotoTemporalRef.current);
            foto = URL.createObjectURL(fotoNueva);
            fotoTemporalRef.current = foto;
        }

        const presentacionSeleccionada = presentaciones.find((opcion) => opcion.id === cambios.presentacionId);
        const variedadSeleccionada = variedades.find((opcion) => opcion.id === presentacionSeleccionada?.variedadId);
        const especieSeleccionada = especies.find((opcion) => opcion.id === variedadSeleccionada?.especieId);

        setPublicacion({
            ...publicacion,
            ...cambios,
            foto,
            especieId: especieSeleccionada?.id ?? publicacion.especieId,
            variedadId: variedadSeleccionada?.id ?? publicacion.variedadId,
            especie: especieSeleccionada?.nombre ?? publicacion.especie,
            variedad: variedadSeleccionada?.nombre ?? publicacion.variedad,
        });
        setAviso("Los cambios se aplicaron a esta vista de prueba.");
    }

    if (!publicacion) {
        return (
            <main className={styles.pagina}>
                <div className={styles.contenedor}>
                    <h1 className={styles.titulo}>Mis publicaciones</h1>
                    <p>No hay opciones suficientes en el catálogo para probar la edición.</p>
                </div>
            </main>
        );
    }

    return (
        <main className={styles.pagina}>
            <div className={styles.contenedor}>
                <div className={styles.introduccion}>
                    <span className={styles.etiquetaDemo}>Vista de prueba</span>
                    <h1 className={styles.titulo}>Mis publicaciones</h1>
                </div>

                {aviso && <p className={styles.aviso} role="status">{aviso}</p>}

                <article className={styles.tarjeta}>
                    <div className={styles.imagen}>
                        {publicacion.foto ? <Image className={styles.imagenProducto} src={publicacion.foto} alt={`Foto de ${publicacion.especie} ${publicacion.variedad}`} fill sizes="96px" unoptimized /> : <Inventory2OutlinedIcon aria-hidden="true" />}
                    </div>
                    <div className={styles.informacion}>
                        <span className={styles.sobretitulo}>Publicación #{publicacion.publicacionId}</span>
                        <h2 className={styles.nombre}>{publicacion.especie} · {publicacion.variedad}</h2>
                        <p className={styles.detalles}>{nombreOpcion(presentaciones, publicacion.presentacionId)} · {nombreOpcion(categorias, publicacion.categoriaId)} · {nombreOpcion(calibres, publicacion.calibreId)}</p>
                        <strong className={styles.precio}>{publicacion.precio === null ? "Sin precio" : `$ ${publicacion.precio}`}</strong>
                    </div>
                    <button className={styles.botonEditar} type="button" onClick={() => { setAviso(""); setAbierto(true); }}>
                        <EditOutlinedIcon fontSize="small" /> Editar
                    </button>
                </article>
            </div>

            <DrawerEditarPublicacion abierto={abierto} alCerrar={() => setAbierto(false)} alGuardar={guardarCambios} publicacion={publicacion} especies={especies} variedades={variedades} categorias={categorias} calibres={calibres} presentaciones={presentaciones} />
        </main>
    );
}
