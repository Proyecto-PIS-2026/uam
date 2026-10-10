"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import TarjetaInput from "../TarjetaInput";

interface ListadoConfiguracionesGeneralesProps {
    configuracion: Record<string, string | null>;
}

export default function ListadoConfiguracionesGenerales({ configuracion }: ListadoConfiguracionesGeneralesProps) {
    const router = useRouter();
    const valorServer = configuracion.url_lista_inteligente ?? "";
    const [listaInteligente, setListaInteligente] = useState(valorServer);

    const [valorPropAnterior, setValorPropAnterior] = useState(valorServer);
    if (valorPropAnterior !== valorServer) {
        setValorPropAnterior(valorServer);
        setListaInteligente(valorServer);
    }
    
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

    async function guardarListaInteligente(valor: string) {
        const valorGuardado = await guardarConfiguracion("url_lista_inteligente", valor);
        setListaInteligente(valorGuardado);
        router.refresh();
    }

    return (
        <div className="flex flex-col gap-6">
            <TarjetaInput
                titulo="Lista Inteligente"
                descripcion="Configurá la URL de acceso a la Lista Inteligente."
                tipo="url"
                valor={listaInteligente}
                onChangeValor={setListaInteligente}
                onGuardarValor={guardarListaInteligente}
            />
        </div>
    );
}