"use client"; // https://nextjs.org/docs/app/api-reference/directives/use-client

import Link from "next/link";
import HojasDecorativas from "../../../../../compartido/HojasDecorativas";
import { useState } from "react";
import EncabezadoPagina from "../../../../../compartido/EncabezadoPagina";
import type { OperadorListado } from "../../consultas-listado-publico";
import ControlesListadoOperadores from "./ControlesListadoOperadores";
import TarjetaOperador from "./TarjetaOperador";
import styles from "./ListadoOperadores.module.css";

type ListadoOperadoresProps = {
    operadores: OperadorListado[];
};

function normalizarTexto(texto: string) {
    return texto.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u0302\u0304-\u036f]/g, ""); // Busque en internet como ignorar los tildes
}

export default function ListadoOperadores({ operadores }: ListadoOperadoresProps) {
    const [busqueda, setBusqueda] = useState("");
    const [orden, setOrden] = useState("a-z");
    const [naveSeleccionada, setNaveSeleccionada] = useState("Todas");

    const mostrarBotonNuevoOperador = true; //HAY QUE INTEGRAR CON AUTENTICACIÓN Y AUTORIZACIÓN

    const conjuntoNaves = new Set<string>();
    for (const operador of operadores) {
        for (const local of operador.locales) {
            conjuntoNaves.add(local.nombreNave);
        }
    }
    const navesDisponibles = Array.from(conjuntoNaves);
    navesDisponibles.sort((primeraNave, segundaNave) =>
        primeraNave.localeCompare(segundaNave, "es", {sensitivity: "base"})
    );

    const textoBuscado = normalizarTexto(busqueda.trim());
    const operadoresFiltrados: OperadorListado[] = [];

    for (const operador of operadores) {
        const nombreOperador = normalizarTexto(operador.nombreFantasia);
        const coincideConBusqueda = nombreOperador.includes(textoBuscado);
        if (coincideConBusqueda) {
            let coincideConNave = naveSeleccionada === "Todas";
            if (!coincideConNave) {
                for (const local of operador.locales) {
                    if (local.nombreNave === naveSeleccionada) {
                        coincideConNave = true;
                        break;
                    }
                }
            }
            if (coincideConNave) {
                operadoresFiltrados.push(operador);
            }
        }
    }

    operadoresFiltrados.sort((primerOperador, segundoOperador) => {
        const comparacion = primerOperador.nombreFantasia.localeCompare(segundoOperador.nombreFantasia, "es", { sensitivity: "base" });
        return orden === "z-a" ? -comparacion : comparacion;
    });

    const contenido = (
        <section className="contenedor-pagina flex flex-col gap-6">
            <header className="encabezado-pagina relative isolate overflow-hidden rounded-2xl bg-secondary">
                <HojasDecorativas variante="separador" />

                <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-primary-soft">
                            Administración
                        </p>

                        <h1 className="titulo-pagina text-white">
                            Operadores
                        </h1>

                        <p className="mt-2 text-sm text-white/80 sm:text-base">
                            Consultá los operadores de la plataforma.
                        </p>
                    </div>

                    <div className="flex flex-col gap-3 sm:items-end">
                        {mostrarBotonNuevoOperador && (
                            <>
                                <p className="text-sm font-semibold text-white/80">
                                    {operadores.length}{" "}
                                    {operadores.length === 1 ? "operador" : "operadores"}
                                </p>

                                <Link
                                    href="/alta-usuario?rol=operador"
                                    className="rounded-lg bg-surface px-4 py-3 text-sm font-semibold text-secondary hover:bg-primary-soft"
                                >
                                    Nuevo operador
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </header>

            <ControlesListadoOperadores
                busqueda={busqueda}
                alCambiarBusqueda={setBusqueda}
                orden={orden}
                alCambiarOrden={setOrden}
                naveSeleccionada={naveSeleccionada}
                alCambiarNave={setNaveSeleccionada}
                navesDisponibles={navesDisponibles}
            />

            <div className={styles.lista}>
                {operadoresFiltrados.map((operador) => (
                    <TarjetaOperador key={operador.id} operador={operador}/>
                ))}
            </div>
        </section>
    );

    return contenido;
}
