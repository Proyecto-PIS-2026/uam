"use client";

import { useEffect, useId, useRef, useState } from "react";

type ConfirmModalProps = {
	abierto: boolean;
	titulo: string;
	descripcion: string;
	textoConfirmar?: string;
	textoCancelar?: string;
	procesando?: boolean;
	alConfirmar: () => void;
	alCancelar: () => void;
};

export function ConfirmModal({
	abierto,
	titulo,
	descripcion,
	textoConfirmar = "Confirmar",
	textoCancelar = "Cancelar",
	procesando = false,
	alConfirmar,
	alCancelar,
}: ConfirmModalProps) {
	const dialogoRef = useRef<HTMLDialogElement>(null);
	const cancelarRef = useRef<HTMLButtonElement>(null);
	const [visible, setVisible] = useState(false);
	const tituloId = useId();
	const descripcionId = useId();

	useEffect(() => {
		const dialogo = dialogoRef.current;
		if (!dialogo) return;

		if (abierto) {
			if (!dialogo.open) dialogo.showModal();
			const frame = requestAnimationFrame(() => {
				setVisible(true);
				cancelarRef.current?.focus();
			});
			return () => cancelAnimationFrame(frame);
		}

		if (dialogo.open) {
			setVisible(false);
			const duracion = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 220;
			const temporizador = window.setTimeout(() => dialogo.close(), duracion);
			return () => window.clearTimeout(temporizador);
		}
	}, [abierto]);

	return (
		<dialog
			ref={dialogoRef}
			className="confirm-modal fixed inset-0 m-auto w-[min(90vw,28rem)] max-w-none rounded-2xl border border-[#deded7] bg-white p-0 text-[#1a1a1a] shadow-2xl"
			data-state={visible ? "open" : "closed"}
			role="alertdialog"
			aria-labelledby={tituloId}
			aria-describedby={descripcionId}
			aria-modal="true"
			onCancel={(evento) => { evento.preventDefault(); if (!procesando) alCancelar(); }}
			onClick={(evento) => { if (evento.target === evento.currentTarget && !procesando) alCancelar(); }}
		>
			<div className="p-6 sm:p-7">
				<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-700" aria-hidden="true">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m5 4v6m4-6v6" /></svg>
				</div>
				<h2 id={tituloId} className="text-xl font-bold tracking-tight">{titulo}</h2>
				<p id={descripcionId} className="mt-2 text-sm leading-6 text-[#5e665f]">{descripcion}</p>
				<div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
					<button ref={cancelarRef} type="button" onClick={alCancelar} disabled={procesando} className="min-h-11 rounded-lg border border-[#deded7] bg-white px-5 py-2 font-semibold text-[#465047] hover:bg-[#f6f5f0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#008332] disabled:opacity-50">{textoCancelar}</button>
					<button type="button" onClick={alConfirmar} disabled={procesando} className="min-h-11 rounded-lg bg-red-700 px-5 py-2 font-semibold text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:opacity-50">{procesando ? "Eliminando..." : textoConfirmar}</button>
				</div>
			</div>
		</dialog>
	);
}
