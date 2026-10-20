"use client"; // https://nextjs.org/docs/app/api-reference/directives/use-client

import HojasDecorativas from "../../../../../compartido/HojasDecorativas";
import { useState } from "react";
import type { ProductorListado } from "../../acciones/consultas-listado-por-operador";
import ControlesListadoProductores from "./ControlesListadoProductores";
import TarjetaProductor from "./TarjetaProductor";
import styles from "./ListadoProductores.module.css";

type ListadoProductoresProps = {
    productores: ProductorListado[];
};

function normalizarTexto(texto: string) {
    return texto.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u0302\u0304-\u036f]/g, "");
}

export default function ListadoProductores({ productores }: ListadoProductoresProps) {
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
        <div className="contenedor-pagina flex flex-col gap-6">
            <div className="encabezado-pagina relative isolate overflow-hidden rounded-2xl bg-secondary">
                <HojasDecorativas />
                <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <div className="titulo-pagina text-white">
                            Productores
                        </div>
                        <div className="mt-2 text-sm text-white/80 sm:text-base">
                            Consultá los productores de la plataforma.
                        </div>
                    </div>
                </div>
            </div>
            <ControlesListadoProductores busqueda={busqueda} alCambiarBusqueda={setBusqueda} orden={orden} alCambiarOrden={setOrden}/>
            {productoresFiltrados.length === 0 ? (
                <div role="status" className="py-8 text-center text-muted">
                    {productores.length === 0 ? "No hay productores disponibles." : "No se encontraron productores que coincidan con la búsqueda."}
                </div>
            ) : (
                <div className={styles.lista}>
                    {productoresFiltrados.map((productor) => (
                        <TarjetaProductor key={productor.id} productor={productor}/>
                    ))}
                </div>
            )}
        </div>
    );
    return contenido;
}