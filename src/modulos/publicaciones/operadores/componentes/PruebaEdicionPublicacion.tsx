"use client";

import { useEffect, useRef, useState } from "react";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import Image from "next/image";
import DrawerEditarPublicacion, { type OpcionCategoria, type OpcionEdicion, type OpcionPresentacion, type OpcionVariedad, type PublicacionParaEditar } from "./DrawerEditarPublicacion";
import type { CambiosPublicacionOperador } from "../modificar-publicacion";
import styles from "./PruebaEdicionPublicacion.module.css";

// ESTOS ARCHIVOS SE VAN A BORRAR, ES SOLO PARA PROBAR EL DRAWER MIENTRAS NO ESTA LA VISTA

const especies: OpcionEdicion[] = [
    { id: 49, nombre: "Manzana" },
    { id: 52, nombre: "Pera" },
    { id: 15, nombre: "Lechuga" },
    { id: 41, nombre: "Tomate" },
];

const variedades: OpcionVariedad[] = [
    { id: 116, nombre: "Gala", especieId: 49 },
    { id: 114, nombre: "Fuji", especieId: 49 },
    { id: 122, nombre: "Williams", especieId: 52 },
    { id: 123, nombre: "Packhams", especieId: 52 },
    { id: 21, nombre: "Crespa", especieId: 15 },
    { id: 19, nombre: "Mantecosa", especieId: 15 },
    { id: 82, nombre: "Redondo", especieId: 41 },
    { id: 86, nombre: "Cherry", especieId: 41 },
];

const categorias: OpcionCategoria[] = [
    { id: 1, nombre: "I", especieId: null },
    { id: 2, nombre: "II", especieId: null },
    { id: 3, nombre: "E", especieId: null },
    { id: 4, nombre: "-", especieId: null },
];

const calibres: OpcionEdicion[] = [
    { id: 1, nombre: "EX - EXTRA" },
    { id: 2, nombre: "8P - 8 PLANTAS" },
    { id: 3, nombre: "18P - 18 PLANTAS" },
    { id: 4, nombre: "12P - 12 PLANTAS" },
    { id: 5, nombre: "C - CHICO" },
    { id: 6, nombre: "M - MEDIANO" },
    { id: 7, nombre: "G - GRANDE" },
    { id: 8, nombre: "EG - EXTRAGRANDE" },
    { id: 9, nombre: "SV - SIN VARIACION" },
];

const presentaciones: OpcionPresentacion[] = [
    { id: 250, nombre: "Cajon", variedadId: 116 },
    { id: 249, nombre: "Plancha", variedadId: 116 },
    { id: 253, nombre: "Cajon", variedadId: 114 },
    { id: 252, nombre: "Plancha", variedadId: 114 },
    { id: 262, nombre: "Cajon", variedadId: 122 },
    { id: 261, nombre: "Plancha", variedadId: 122 },
    { id: 265, nombre: "Cajon", variedadId: 123 },
    { id: 264, nombre: "Plancha", variedadId: 123 },
    { id: 30, nombre: "Docena", variedadId: 21 },
    { id: 29, nombre: "Docena", variedadId: 19 },
    { id: 108, nombre: "Cajon", variedadId: 82 },
    { id: 107, nombre: "Plancha", variedadId: 82 },
    { id: 114, nombre: "Plancha", variedadId: 86 },
    { id: 113, nombre: "Plancha Chica", variedadId: 86 },
];

const publicacionInicial: PublicacionParaEditar = {
    publicacionOperadorId: 13,
    publicacionId: 52,
    especieId: 49,
    variedadId: 116,
    especie: "Manzana",
    variedad: "Gala",
    precio: "180.00",
    foto: null,
    categoriaId: 1,
    calibreId: 7,
    presentacionId: 250,
    disponible: true,
};

function nombreOpcion(opciones: OpcionEdicion[], id: number) {
    return opciones.find((opcion) => opcion.id === id)?.nombre ?? "Sin definir";
}

export default function PruebaEdicionPublicacion() {
    const [publicacion, setPublicacion] = useState(publicacionInicial);
    const [abierto, setAbierto] = useState(false);
    const [aviso, setAviso] = useState("");
    const fotoTemporalRef = useRef<string | null>(null);

    useEffect(() => {
        return () => {
            if (fotoTemporalRef.current) URL.revokeObjectURL(fotoTemporalRef.current);
        };
    }, []);

    function guardarCambios(publicacionOperadorId: number, cambios: CambiosPublicacionOperador, fotoNueva: File | null) {
        if (publicacionOperadorId !== publicacion.publicacionOperadorId) {
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

        setPublicacion((actual) => ({
            ...actual,
            ...cambios,
            foto,
            especieId: especieSeleccionada?.id ?? actual.especieId,
            variedadId: variedadSeleccionada?.id ?? actual.variedadId,
            especie: especieSeleccionada?.nombre ?? actual.especie,
            variedad: variedadSeleccionada?.nombre ?? actual.variedad,
        }));
        setAviso("Los cambios se aplicaron a esta vista de prueba.");
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
