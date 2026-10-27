"use client";

import { useEffect, useId, useRef, useState } from "react";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";

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
			className="confirm-modal fixed inset-0 m-auto w-[min(90vw,28rem)] max-w-none rounded-[var(--radio-panel)] border border-border bg-surface p-0 text-foreground shadow-2xl"
			data-state={visible ? "open" : "closed"}
			role="alertdialog"
			aria-labelledby={tituloId}
			aria-describedby={descripcionId}
			aria-modal="true"
			onClose={(evento) => evento.stopPropagation()}
			onKeyDown={(evento) => { if (evento.key === "Escape") evento.stopPropagation(); }}
			onCancel={(evento) => { evento.preventDefault(); if (!procesando) alCancelar(); }}
			onClick={(evento) => { if (evento.target === evento.currentTarget && !procesando) alCancelar(); }}
		>
            <div className="p-[var(--padding-panel)]">
				<div className="mb-[var(--espacio-secciones)] flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-danger" aria-hidden="true">
					<DeleteOutlinedIcon aria-hidden="true" className="h-6 w-6" />
				</div>
				<h2 id={tituloId} className="titulo-seccion">{titulo}</h2>
				<p id={descripcionId} className="mt-[var(--espacio-inline)] text-[length:var(--tamano-texto-secundario)] leading-[var(--interlineado-texto)] text-muted">{descripcion}</p>
                <div className="mt-[var(--espacio-secciones)] flex flex-col-reverse gap-[var(--espacio-controles)] sm:flex-row sm:justify-end">
					<button ref={cancelarRef} type="button" onClick={alCancelar} disabled={procesando} className="boton-secundario">{textoCancelar}</button>
					<button type="button" onClick={alConfirmar} disabled={procesando} className="boton-peligro">{procesando ? "Eliminando..." : textoConfirmar}</button>
				</div>
			</div>
		</dialog>
	);
}
