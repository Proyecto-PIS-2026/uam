"use client";

import { useId, useRef } from "react";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import Dialog from "@mui/material/Dialog";
import useMediaQuery from "@mui/material/useMediaQuery";

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
	const cancelarRef = useRef<HTMLButtonElement>(null);
	const reducirMovimiento = useMediaQuery("(prefers-reduced-motion: reduce)");
	const tituloId = useId();
	const descripcionId = useId();

	return (
		<Dialog
			open={abierto}
			maxWidth={false}
			role="alertdialog"
			aria-labelledby={tituloId}
			aria-describedby={descripcionId}
			transitionDuration={reducirMovimiento ? 0 : 220}
			onClose={() => { if (!procesando) alCancelar(); }}
			onKeyDown={(evento) => { if (evento.key === "Escape") evento.stopPropagation(); }}
			onClick={(evento) => evento.stopPropagation()}
			slotProps={{
				paper: {
					className: "shadow-2xl",
					sx: {
						m: 2,
						width: "min(90vw, 28rem)",
						maxHeight: "calc(100% - 32px)",
						borderRadius: "var(--radio-panel)",
						border: "1px solid var(--color-border)",
						backgroundColor: "var(--color-surface)",
						color: "var(--color-foreground)",
					},
				},
				backdrop: { sx: { backgroundColor: "rgb(15 23 42 / 48%)" } },
				transition: { onEntered: () => cancelarRef.current?.focus() },
			}}
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
		</Dialog>
	);
}
