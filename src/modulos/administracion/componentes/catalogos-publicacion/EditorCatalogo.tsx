"use client";

import { useId, useState, type FormEvent } from "react";
import { Dialog, DialogActions, DialogContent, DialogTitle, TextField } from "@mui/material";
import type { DatosCatalogo, ElementoCatalogo, TipoCatalogo } from "../../catalogos/tipos";
import styles from "./CatalogosPublicacion.module.css";

interface Props {
    tipo: TipoCatalogo;
    elemento: ElementoCatalogo | null;
    procesando: boolean;
    error: string | null;
    alGuardar: (datos: DatosCatalogo) => Promise<void>;
    alCerrar: () => void;
}

export default function EditorCatalogo({ tipo, elemento, procesando, error, alGuardar, alCerrar }: Props) {
    const tituloId = useId();
    const ayudaId = useId();
    const [nombre, setNombre] = useState(elemento?.nombre ?? "");
    const [codigo, setCodigo] = useState(elemento?.codigo ?? "");
    const esCalibre = tipo === "calibres";
    const etiqueta = tipo === "kilos" ? "Kilos" : esCalibre ? "Descripción" : "Nombre";

    function guardar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        if (procesando || !nombre.trim() || (esCalibre && !codigo.trim())) return;
        void alGuardar(esCalibre ? { nombre, codigo } : { nombre });
    }

    return (
        <Dialog open fullWidth maxWidth="sm" onClose={() => { if (!procesando) alCerrar(); }}
            aria-labelledby={tituloId} aria-describedby={ayudaId}
            slotProps={{ paper: { className: styles.dialogo } }}>
            <form onSubmit={guardar}>
                <DialogTitle id={tituloId}>{elemento ? "Modificar valor" : "Agregar valor"}</DialogTitle>
                <DialogContent>
                    <p id={ayudaId} className={styles.descripcion}>
                        {elemento
                            ? "El cambio se reflejará en todas las publicaciones que usan este valor."
                            : "El valor estará disponible para todas las especies y variedades."}
                    </p>
                    <div className={styles.campos}>
                        {esCalibre && <TextField label="Código" value={codigo} onChange={(evento) => setCodigo(evento.target.value)}
                            required fullWidth autoFocus disabled={procesando} size="small" slotProps={{ htmlInput: { maxLength: 60 } }} />}
                        <TextField label={etiqueta} value={nombre} onChange={(evento) => setNombre(evento.target.value)}
                            required fullWidth autoFocus={!esCalibre} disabled={procesando} size="small"
                            helperText={tipo === "kilos" ? "Podés ingresar un peso o un rango, por ejemplo: 10 o 10-12." : undefined}
                            slotProps={{ htmlInput: { maxLength: 120 } }} />
                        {error && <p role="alert" className={styles.error}>{error}</p>}
                    </div>
                </DialogContent>
                <DialogActions className={styles.accionesDialogo}>
                    <button type="button" className="boton-secundario" onClick={alCerrar} disabled={procesando}>Cancelar</button>
                    <button type="submit" className="boton-primario" disabled={procesando || !nombre.trim() || (esCalibre && !codigo.trim())}>
                        {procesando ? "Guardando..." : "Guardar"}
                    </button>
                </DialogActions>
            </form>
        </Dialog>
    );
}
