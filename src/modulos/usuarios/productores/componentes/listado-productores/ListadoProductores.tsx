"use client"; // https://nextjs.org/docs/app/api-reference/directives/use-client

import EncabezadoPagina from "../../../../../compartido/EncabezadoPagina";
import EstadoVacio from "@/compartido/componentes/EstadoVacio";
import Paginacion from "@/compartido/componentes/Paginacion";
import AgricultureOutlinedIcon from "@mui/icons-material/AgricultureOutlined";
import SearchOffOutlinedIcon from "@mui/icons-material/SearchOffOutlined";
import { useState } from "react";
import type { ProductorListado } from "../../acciones/consultas-productores";
import ControlesListadoProductores from "./controles-listado/ControlesListadoProductores";
import TarjetaProductor from "./tarjetas-productores/TarjetaProductor";
import styles from "./ListadoProductores.module.css";

type ListadoProductoresProps = {
    productores: ProductorListado[];
    puedeGestionar?: boolean;
};

const productoresPorPagina = 20;

function normalizarTexto(texto: string) {
    return texto.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u0302\u0304-\u036f]/g, "");
}

export default function ListadoProductores({ productores, puedeGestionar = false }: ListadoProductoresProps) {
    const [busqueda, setBusqueda] = useState("");
    const [orden, setOrden] = useState("a-z");
    const [departamentoSeleccionado, setDepartamentoSeleccionado] = useState("");
    const [paginaActual, setPaginaActual] = useState(1);
    const departamentosDisponibles = [...new Set(productores.flatMap((productor) => productor.departamentos))]
        .sort((primero, segundo) => primero.localeCompare(segundo, "es", { sensitivity: "base" }));
    const departamentoVigente = departamentosDisponibles.includes(departamentoSeleccionado) ? departamentoSeleccionado : "";
    const textoBuscado = normalizarTexto(busqueda.trim());
    const productoresFiltrados = productores.filter((productor) =>
        normalizarTexto(productor.nombreFantasia).includes(textoBuscado)
        && (!departamentoVigente || productor.departamentos.includes(departamentoVigente))
    );

    productoresFiltrados.sort((primerProductor, segundoProductor) => {
        const comparacion = primerProductor.nombreFantasia.localeCompare(segundoProductor.nombreFantasia, "es", { sensitivity: "base" });
        return orden === "z-a" ? -comparacion : comparacion;
    });

    const totalPaginas = Math.ceil(productoresFiltrados.length / productoresPorPagina);
    const paginaVisible = Math.min(paginaActual, Math.max(1, totalPaginas));
    if (paginaActual !== paginaVisible) {
        setPaginaActual(paginaVisible);
    }
    const indiceInicial = (paginaVisible - 1) * productoresPorPagina;
    const productoresPagina = productoresFiltrados.slice(indiceInicial, indiceInicial + productoresPorPagina);

    const contenido = (
        <div className="contenedor-pagina secciones-pagina">
            <EncabezadoPagina titulo="Productores" subtitulo={`${productores.length} ${productores.length === 1 ? "productor" : "productores"}`} />
            <ControlesListadoProductores busqueda={busqueda} alCambiarBusqueda={(valor) => { setBusqueda(valor); setPaginaActual(1); }}
                orden={orden} alCambiarOrden={(valor) => { setOrden(valor); setPaginaActual(1); }}
                departamento={departamentoVigente} departamentosDisponibles={departamentosDisponibles}
                alCambiarDepartamento={(valor) => { setDepartamentoSeleccionado(valor); setPaginaActual(1); }} />
            {productoresFiltrados.length === 0 ? (
                <EstadoVacio
                    titulo={productores.length === 0 ? "Todavía no hay productores" : "No encontramos productores"}
                    descripcion={productores.length === 0 ? "No hay productores disponibles." : "No se encontraron productores que coincidan con la búsqueda y el departamento seleccionado."}
                    icono={productores.length === 0 ? <AgricultureOutlinedIcon /> : <SearchOffOutlinedIcon />}
                />
            ) : (
                <div className={styles.lista}>
                    {productoresPagina.map((productor) => (
                        <TarjetaProductor key={productor.id} productor={productor} puedeGestionar={puedeGestionar}/>
                    ))}
                </div>
            )}
            <Paginacion
                pagina={paginaVisible}
                totalPaginas={totalPaginas}
                alCambiar={setPaginaActual}
                etiqueta="Paginación de productores"
                resumen={`${indiceInicial + 1}–${indiceInicial + productoresPagina.length} de ${productoresFiltrados.length} productores`}
            />
        </div>
    );
    return contenido;
}
