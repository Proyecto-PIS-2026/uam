"use client";

import { useState } from "react";

import TarjetaInput from "./tarjetaInput";

interface ListadoConfiguracionesProps {
    configuracion: Record<string, string | null>;
}

const IMPORTE_POR_DEFECTO = "10";

export default function ListadoConfiguraciones({ configuracion }: ListadoConfiguracionesProps) {
    const [importe, setImporte] = useState(configuracion.incremento_precio ?? "");

    async function guardarConfiguracion(nombre: string, valor: string,): Promise<string> {
        const respuesta = await fetch(
            `/api/configuracion/${encodeURIComponent(nombre)}`,
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    valor,
                }),
            },
        );
        const datos = await respuesta.json();
        if (!respuesta.ok) {
            throw new Error(
                datos.errores?.[0] ?? "No se pudo guardar la configuración.",
            );
        }
        return datos.valor;
    }

    async function guardarImporte(valor: string) {
        const valorGuardado = await guardarConfiguracion("incremento_precio", valor);
        setImporte(valorGuardado);
    }

    async function eliminarImporte() {
        const valorGuardado = await guardarConfiguracion("incremento_precio", IMPORTE_POR_DEFECTO);
        setImporte(valorGuardado);
    }

    const contenido = (
        <div className="flex flex-col gap-6">
            <TarjetaInput
                titulo="Importe de ajuste rápido de precios"
                descripcion="Configurá el importe utilizado para aumentar o disminuir rápidamente el precio de una publicación."
                tipo="numero"
                valor={importe}
                onChangeValor={setImporte}
                onGuardarValor={guardarImporte}
                onEliminarValor={eliminarImporte}
            />
        </div>
    );
    return contenido; 
}