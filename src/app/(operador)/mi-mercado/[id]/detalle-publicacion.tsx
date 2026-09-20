"use client";
import { useState } from "react";

type Props = {
    nombreProducto: string;
    precioInicial: number;
    incrementoPrecio: number;
};

export default function DetallePublicacion({ nombreProducto, precioInicial, incrementoPrecio }: Props) {
    const [precio, setPrecio] = useState(precioInicial);

    function restar() {
        setPrecio((valorActual) => Math.max(0, valorActual - incrementoPrecio));
    }

    function sumar() {
        setPrecio((valorActual) => valorActual + incrementoPrecio);
    }

    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-8">
            <h1 className="text-4xl font-extrabold text-[var(--ink)]">
                {nombreProducto}
            </h1>

            <div className="mt-6">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                    Precio
                </p>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={restar}>−</button>
                    <p className="text-xl font-extrabold text-[var(--ink)]">
                        {precio === 0 ? "Sin precio" : `$${precio}`}
                    </p>
                    <button type="button" onClick={sumar}>+</button>
                </div>
            </div>
        </div>
    );
}