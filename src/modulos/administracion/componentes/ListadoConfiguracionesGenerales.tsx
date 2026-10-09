
"use client";

import { useState } from "react";

import TarjetaInput from "./tarjetaInput";

interface ListadoConfiguracionesGeneralesProps {
    configuracion: Record<string, string | null>;
}

const ORDENAMIENTO_POR_DEFECTO = "true";
const LISTA_INTELIGENTE_POR_DEFECTO = "";

export default function ListadoConfiguracionesGenerales({
    configuracion,
}: ListadoConfiguracionesGeneralesProps) {
    const [ordenamiento, setOrdenamiento] = useState(
        (configuracion.ordenamiento_habilitado ?? ORDENAMIENTO_POR_DEFECTO) === "true"
    );

    const [listaInteligente, setListaInteligente] = useState(
        configuracion.url_lista_inteligente ?? ""
    );

    async function guardarConfiguracion(nombre: string, valor: string): Promise<string> {
        const respuesta = await fetch(
            `/api/configuracion/${encodeURIComponent(nombre)}`,
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ valor }),
            }
        );

        const datos = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(
                datos.errores?.[0] ?? "No se pudo guardar la configuración."
            );
        }

        return datos.valor;
    }

    async function guardarOrdenamiento(checked: boolean) {
        const valorGuardado = await guardarConfiguracion(
            "ordenamiento_habilitado",
            String(checked)
        );

        setOrdenamiento(valorGuardado === "true");
    }

    async function eliminarOrdenamiento() {
        const valorGuardado = await guardarConfiguracion(
            "ordenamiento_habilitado",
            ORDENAMIENTO_POR_DEFECTO
        );

        setOrdenamiento(valorGuardado === "true");
    }

    async function guardarListaInteligente(valor: string) {
        const valorGuardado = await guardarConfiguracion(
            "url_lista_inteligente",
            valor
        );

        setListaInteligente(valorGuardado);
    }

    async function eliminarListaInteligente() {
        const valorGuardado = await guardarConfiguracion(
            "url_lista_inteligente",
            LISTA_INTELIGENTE_POR_DEFECTO
        );

        setListaInteligente(valorGuardado);
    }

    const contenido = (
        <div className="flex flex-col gap-6">
            <TarjetaInput
                titulo="Lista Inteligente"
                descripcion="Configurá la URL de acceso a la Lista Inteligente."
                tipo="url"
                valor={listaInteligente}
                onChangeValor={setListaInteligente}
                onGuardarValor={guardarListaInteligente}
                onEliminarValor={eliminarListaInteligente}
            />
        </div>
    );

    return contenido;
}
