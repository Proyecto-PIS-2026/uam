"use client";

import { useState } from "react";

type Props = {
    precioInicial: number;
    incrementoPrecio: number;
    detalle?: string;
};

export default function Precio({ precioInicial, incrementoPrecio, detalle }: Props) {
    const [precio, setPrecio] = useState(precioInicial);
    const [modalAbierto, setModalAbierto] = useState(false);
    const [precioInput, setPrecioInput] = useState("");

    function restar() {
        setPrecio((valorActual) => Math.max(0, valorActual - incrementoPrecio));
    }

    function sumar() {
        setPrecio((valorActual) => valorActual + incrementoPrecio);
    }

    function abrirModal() {
        setPrecioInput(precio === 0 ? "" : String(precio));
        setModalAbierto(true);
    }

    function guardar() {
        const valor = parseFloat(precioInput);
        setPrecio(!isNaN(valor) && valor >= 0 ? valor : 0);
        setModalAbierto(false);
    }

    return (
        <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                Precio
            </p>
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={restar}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-lg font-bold text-[var(--ink)] transition hover:border-primary hover:text-primary active:scale-95"
                >
                    −
                </button>
                <button
                    type="button"
                    onClick={abrirModal}
                    className="text-xl font-extrabold text-[var(--ink)]"
                >
                    {precio === 0 ? "Sin precio" : `$${precio}`}
                </button>
                <button
                    type="button"
                    onClick={sumar}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-lg font-bold text-[var(--ink)] transition hover:border-primary hover:text-primary active:scale-95"
                >
                    +
                </button>
            </div>

            {/* Modal para editar precio a mano */}
            {modalAbierto && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4"
                    onClick={() => setModalAbierto(false)}
                >
                    <div
                    className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    <p className="text-xl font-extrabold text-foreground">
                        Modificar precio
                    </p>
                    {detalle && (
                        <p className="mt-1 mb-4 text-sm text-muted">
                            {detalle}
                        </p>
                    )}
                    <div className="mb-5 flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-3">
                        <span className="text-xl font-extrabold text-foreground">
                            $
                        </span>
                        <input
                            type="number"
                            inputMode="decimal"
                            autoFocus
                            value={precioInput}
                            onChange={(e) => setPrecioInput(e.target.value)}
                            className="w-full bg-transparent text-2xl font-extrabold text-foreground outline-none"
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setModalAbierto(false)}
                            className="rounded-lg border border-gray-200 px-5 py-2 text-sm font-semibold text-gray-500 transition hover:bg-gray-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={guardar}
                            className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover"
                        >
                            Confirmar
                        </button>
                    </div>
                </div>
            </div>
            )}
        </div>
    );
}