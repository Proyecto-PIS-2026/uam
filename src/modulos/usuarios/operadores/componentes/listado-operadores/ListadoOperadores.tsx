"use client"; // https://nextjs.org/docs/app/api-reference/directives/use-client

import { useState } from "react";
import HojasDecorativas from "@/compartido/HojasDecorativas";
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
    const [naveSeleccionada, setNaveSeleccionada] = useState("");

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
            let coincideConNave = naveSeleccionada === ""; // No hay nave seleccionada
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
        <section className={styles.contenedor}>
            <div className={styles.tituloContenedor}>
                <HojasDecorativas variante="separador" />
                <p className={styles.titulo}>Operadores</p>
                <p className={styles.subtitulo}>{operadores.length} Operadores en la plataforma</p>
            </div>

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
