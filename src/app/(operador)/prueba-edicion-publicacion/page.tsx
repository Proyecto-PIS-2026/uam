"use client";

import { useEffect, useRef, useState } from "react";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import Image from "next/image";
import DrawerEditarPublicacion, { type OpcionCategoria, type OpcionEdicion, type OpcionPresentacion, type OpcionVariedad, type PublicacionParaEditar } from "@/modulos/publicaciones/operadores/componentes/DrawerEditarPublicacion";
import type { CambiosPublicacionOperador } from "@/modulos/publicaciones/operadores/modificar-publicacion";
import styles from "./page.module.css";

const especies: OpcionEdicion[] = [
    { id: 1, nombre: "Manzana" },
    { id: 2, nombre: "Pera" },
];

const variedades: OpcionVariedad[] = [
    { id: 1, nombre: "Gala", especieId: 1 },
    { id: 2, nombre: "Fuji", especieId: 1 },
    { id: 3, nombre: "Williams", especieId: 2 },
];

const categorias: OpcionCategoria[] = [
    { id: 1, nombre: "Primera", especieId: 1 },
    { id: 2, nombre: "Segunda", especieId: 1 },
    { id: 3, nombre: "Primera", especieId: 2 },
    { id: 4, nombre: "Segunda", especieId: 2 },
];

const calibres: OpcionEdicion[] = [
    { id: 1, nombre: "70 a 80 mm" },
    { id: 2, nombre: "80 a 90 mm" },
];

const presentaciones: OpcionPresentacion[] = [
    { id: 1, nombre: "Cajón de 18 kg", variedadId: 1 },
    { id: 2, nombre: "Bolsa de 10 kg", variedadId: 1 },
    { id: 3, nombre: "Cajón de 15 kg", variedadId: 2 },
    { id: 4, nombre: "Cajón de 20 kg", variedadId: 3 },
];

const publicacionInicial: PublicacionParaEditar = {
    publicacionOperadorId: 13,
    publicacionId: 52,
    especieId: 1,
    variedadId: 1,
    especie: "Manzana",
    variedad: "Gala",
    precio: "185.00",
    foto: null,
    categoriaId: 1,
    calibreId: 2,
    presentacionId: 1,
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
                    <p className={styles.descripcion}>Abrí el producto para probar el formulario de edición en celular y en web.</p>
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

                <p className={styles.nota}>Los cambios de esta pantalla quedan solo en el navegador y se pierden al recargar.</p>
            </div>

            <DrawerEditarPublicacion abierto={abierto} alCerrar={() => setAbierto(false)} alGuardar={guardarCambios} publicacion={publicacion} especies={especies} variedades={variedades} categorias={categorias} calibres={calibres} presentaciones={presentaciones} />
        </main>
    );
}
