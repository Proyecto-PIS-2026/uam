"use client";

import { useState } from "react";

import TarjetaInput from "./tarjetaInput";
import TarjetaUploadFotoEspecie from "./tarjetaUploadFotoEspecie";
import type { Especie } from "./tarjetaUploadFotoEspecie";

interface ListadoConfiguracionesProps {
    configuracion: Record<string, string | null>;
    especies: Especie[];
}

const IMPORTE_POR_DEFECTO = "10";
const VIGENCIA_POR_DEFECTO = "30";

export default function ListadoConfiguraciones({ configuracion, especies }: ListadoConfiguracionesProps) {
    const [importe, setImporte] = useState(configuracion.incremento_precio ?? "");
    const [vigencia, setVigencia] = useState(configuracion.vigencia_fotografias ?? "");
    const [especieId, setEspecieId] = useState("");
    const [especiesLocales, setEspeciesLocales] = useState(especies);

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

    async function guardarVigencia(valor: string) {
        const valorGuardado = await guardarConfiguracion("vigencia_fotografias", valor);
        setVigencia(valorGuardado);
    }

    async function eliminarVigencia() {
        const valorGuardado = await guardarConfiguracion("vigencia_fotografias", VIGENCIA_POR_DEFECTO);
        setVigencia(valorGuardado);
    }

    async function guardarFotoEspecie(especieId: number, archivo: File) {
        const formulario = new FormData();
        formulario.append("fotografia", archivo);
        const respuesta = await fetch(
            `/api/especies/${especieId}/foto`,
            {
                method: "PATCH",
                body: formulario,
            },
        );
        const datos = await respuesta.json();
        if (!respuesta.ok) {
            throw new Error(
                datos.errores?.[0] ?? "No se pudo guardar la fotografía.",
            );
        }
        setEspeciesLocales((anteriores) => anteriores.map((especie) => especie.id === especieId ? { ...especie, fotoEspecie: datos.fotoEspecie } : especie));
    }

    async function eliminarFotoEspecie(especieId: number) {
        const respuesta = await fetch(
            `/api/especies/${especieId}/foto`,
            {
                method: "DELETE",
            },
        );
        const datos = await respuesta.json();
        if (!respuesta.ok) {
            throw new Error(
                datos.errores?.[0] ?? "No se pudo eliminar la fotografía.",
            );
        }
        setEspeciesLocales((anteriores) => anteriores.map((especie) => especie.id === especieId ? { ...especie, fotoEspecie: null } : especie));
    }
    const contenido = (
        <div className="flex flex-col gap-6">
            <TarjetaUploadFotoEspecie
                titulo="Foto predeterminada por especie"
                descripcion="Configurá la fotografía predeterminada para cada especie."
                especies={especiesLocales}
                especieSeleccionada={especieId}
                onChangeEspecie={setEspecieId}
                onGuardarFoto={guardarFotoEspecie}
                onEliminarFoto={eliminarFotoEspecie}
            />
            <TarjetaInput
                titulo="Importe de ajuste rápido de precios"
                descripcion="Configurá el importe utilizado para aumentar o disminuir rápidamente el precio de una publicación."
                tipo="numero"
                valor={importe}
                onChangeValor={setImporte}
                onGuardarValor={guardarImporte}
                onEliminarValor={eliminarImporte}
            />
            <TarjetaInput
                titulo="Vigencia de fotografías"
                descripcion="Configurá durante cuántos días se considera vigente la fotografía de una publicación."
                tipo="numero"
                valor={vigencia}
                onChangeValor={setVigencia}
                onGuardarValor={guardarVigencia}
                onEliminarValor={eliminarVigencia}
            />
        </div>
    );
    return contenido; 
}