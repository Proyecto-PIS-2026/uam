"use client"; // https://nextjs.org/docs/app/api-reference/directives/use-client

import EncabezadoPagina from "../../../../../compartido/EncabezadoPagina";
import EstadoVacio from "@/compartido/componentes/EstadoVacio";
import AgricultureOutlinedIcon from "@mui/icons-material/AgricultureOutlined";
import SearchOffOutlinedIcon from "@mui/icons-material/SearchOffOutlined";
import { useState } from "react";
import type { ProductorListado } from "../../acciones/consultas-listado-por-operador";
import ControlesListadoProductores from "./controles-listado/ControlesListadoProductores";
import TarjetaProductor from "./tarjetas-productores/TarjetaProductor";
import styles from "./ListadoProductores.module.css";

type ListadoProductoresProps = {
    productores: ProductorListado[];
    puedeGestionar?: boolean;
};

function normalizarTexto(texto: string) {
    return texto.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u0302\u0304-\u036f]/g, "");
}

export default function ListadoProductores({ productores, puedeGestionar = false }: ListadoProductoresProps) {
    const [busqueda, setBusqueda] = useState("");
    const [orden, setOrden] = useState("a-z");
    const textoBuscado = normalizarTexto(busqueda.trim());
    const productoresFiltrados = productores.filter((productor) =>
        normalizarTexto(productor.nombreFantasia).includes(textoBuscado)
    );

    productoresFiltrados.sort((primerProductor, segundoProductor) => {
        const comparacion = primerProductor.nombreFantasia.localeCompare(segundoProductor.nombreFantasia, "es", { sensitivity: "base" });
        return orden === "z-a" ? -comparacion : comparacion;
    });

    const contenido = (
        <div className="contenedor-pagina secciones-pagina">
            <EncabezadoPagina titulo="Productores" subtitulo="Consultá los productores de la plataforma." />
            <ControlesListadoProductores busqueda={busqueda} alCambiarBusqueda={setBusqueda} orden={orden} alCambiarOrden={setOrden}/>
            {productoresFiltrados.length === 0 ? (
                <EstadoVacio
                    titulo={productores.length === 0 ? "Todavía no hay productores" : "No encontramos productores"}
                    descripcion={productores.length === 0 ? "No hay productores disponibles." : "No se encontraron productores que coincidan con la búsqueda."}
                    icono={productores.length === 0 ? <AgricultureOutlinedIcon /> : <SearchOffOutlinedIcon />}
                />
            ) : (
                <div className={styles.lista}>
                    {productoresFiltrados.map((productor) => (
                        <TarjetaProductor key={productor.id} productor={productor} puedeGestionar={puedeGestionar}/>
                    ))}
                </div>
            )}
        </div>
    );
    return contenido;
}
