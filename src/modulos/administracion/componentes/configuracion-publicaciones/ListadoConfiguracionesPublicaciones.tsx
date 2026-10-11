"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import TarjetaInput from "../TarjetaInput";

interface ListadoConfiguracionesProps {
    configuracion: Record<string, string | null>;
}

export default function ListadoConfiguraciones({ configuracion }: ListadoConfiguracionesProps) {
    const router = useRouter();
    const valorServer = configuracion.incremento_precio ?? "";
    const [importe, setImporte] = useState(valorServer);

    const [valorPropAnterior, setValorPropAnterior] = useState(valorServer);
    if (valorPropAnterior !== valorServer) {
        setValorPropAnterior(valorServer);
        setImporte(valorServer);
    }

    async function guardarConfiguracion(nombre: string, valor: string): Promise<string> {
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
        router.refresh();
    }

    return (
        <div className="flex flex-col gap-6">
            <TarjetaInput
                titulo="Importe de ajuste rápido de precios"
                descripcion="Configurá el importe utilizado para aumentar o disminuir rápidamente el precio de una publicación."
                tipo="numero"
                valor={importe}
                onChangeValor={setImporte}
                onGuardarValor={guardarImporte}
            />
        </div>
    );
}