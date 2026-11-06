"use client";

import OutlinedInput from "@mui/material/OutlinedInput";

import { LARGO_MAXIMO_COMENTARIO } from "../validarComentario";

type ClasesCampoComentario = {
    campo?: string;
    etiqueta?: string;
    entrada?: string;
    ayuda?: string;
};

type CampoComentarioProps = {
    id: string;
    valor: string;
    alCambiar?: (valor: string) => void;
    editando?: boolean;
    deshabilitado?: boolean;
    clases: ClasesCampoComentario;
};

export default function CampoComentario({ id, valor, alCambiar, editando = true, deshabilitado = false, clases }: CampoComentarioProps) {
    return (
        <div className={clases.campo}>
            <label className={clases.etiqueta} htmlFor={id}>
                Comentario
            </label>
            <OutlinedInput
                color="secondary"
                className={clases.entrada}
                size="small"
                id={id}
                multiline
                minRows={2}
                maxRows={6}
                slotProps={{ input: { maxLength: LARGO_MAXIMO_COMENTARIO } }}
                placeholder={editando ? "Agregá un comentario sobre la publicación (opcional)" : "-"}
                value={valor}
                onChange={(evento) => alCambiar?.(evento.target.value)}
                readOnly={!editando}
                disabled={deshabilitado}
            />
            {editando && (
                <small className={clases.ayuda}>
                    {valor.length}/{LARGO_MAXIMO_COMENTARIO} caracteres
                </small>
            )}
        </div>
    );
}