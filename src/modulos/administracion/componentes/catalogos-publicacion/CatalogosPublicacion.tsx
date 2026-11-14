"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, TextField } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { ConfirmModal } from "@/compartido/componentes/ConfirmModal";
import { eliminarElementoCatalogo, guardarElementoCatalogo, listarCatalogo } from "../../catalogos/acciones";
import type { DatosCatalogo, ElementoCatalogo, TipoCatalogo } from "../../catalogos/tipos";
import EditorCatalogo from "./EditorCatalogo";
import styles from "./CatalogosPublicacion.module.css";

const catalogos: { tipo: TipoCatalogo; etiqueta: string }[] = [
    { tipo: "empaquetados", etiqueta: "Empaquetados" },
    { tipo: "kilos", etiqueta: "Kilos" },
    { tipo: "calibres", etiqueta: "Calibres" },
    { tipo: "categorias", etiqueta: "Categorías" },
];

const propiedadesMenuSelect = {
    select: {
        MenuProps: { slotProps: { paper: { sx: { maxHeight: "min(20rem, 50dvh)", overflowY: "auto" } } } },
    },
} as const;

type Carga = { tipo: TipoCatalogo; revision: number; elementos: ElementoCatalogo[]; error?: string };

function nombreCompleto(elemento: ElementoCatalogo) {
    return elemento.codigo && elemento.codigo !== elemento.nombre ? `${elemento.codigo} - ${elemento.nombre}` : elemento.nombre;
}

export default function CatalogosPublicacion() {
    const selectId = useId();
    const avisoTituloId = useId();
    const avisoDescripcionId = useId();
    const [tipo, setTipo] = useState<TipoCatalogo>("empaquetados");
    const [revision, setRevision] = useState(0);
    const [carga, setCarga] = useState<Carga | null>(null);
    const [editor, setEditor] = useState<{ elemento: ElementoCatalogo | null } | null>(null);
    const [errorEdicion, setErrorEdicion] = useState<string | null>(null);
    const [porEliminar, setPorEliminar] = useState<ElementoCatalogo | null>(null);
    const [procesando, setProcesando] = useState(false);
    const operacionEnCurso = useRef(false);
    const [aviso, setAviso] = useState<string | null>(null);
    const [mensaje, setMensaje] = useState<string | null>(null);
    const cargando = carga === null || carga.tipo !== tipo || carga.revision !== revision;
    const datos = cargando ? null : carga;

    useEffect(() => {
        let vigente = true;
        listarCatalogo(tipo).then((elementos) => {
            if (vigente) setCarga({ tipo, revision, elementos });
        }).catch(() => {
            if (vigente) setCarga({ tipo, revision, elementos: [], error: "No se pudo cargar el catálogo. Intentá nuevamente." });
        });
        return () => { vigente = false; };
    }, [tipo, revision]);

    function cambiarCatalogo(nuevoTipo: TipoCatalogo) {
        if (procesando) return;
        setTipo(nuevoTipo);
        setEditor(null);
        setPorEliminar(null);
        setMensaje(null);
        setErrorEdicion(null);
    }

    function abrirEditor(elemento: ElementoCatalogo | null) {
        setErrorEdicion(null);
        setMensaje(null);
        setEditor({ elemento });
    }

    async function guardar(datos: DatosCatalogo) {
        if (operacionEnCurso.current || !editor) return;
        operacionEnCurso.current = true;
        setProcesando(true);
        setErrorEdicion(null);
        try {
            const resultado = await guardarElementoCatalogo(tipo, datos, editor.elemento?.id);
            if (!resultado.ok) {
                setErrorEdicion(resultado.mensaje);
                return;
            }
            setEditor(null);
            setMensaje(editor.elemento ? "El valor se modificó correctamente." : "El valor se agregó correctamente.");
            setRevision((actual) => actual + 1);
        } catch {
            setErrorEdicion("No se pudo guardar el valor. Intentá nuevamente.");
        } finally {
            operacionEnCurso.current = false;
            setProcesando(false);
        }
    }

    async function eliminar() {
        if (operacionEnCurso.current || !porEliminar) return;
        operacionEnCurso.current = true;
        setProcesando(true);
        setMensaje(null);
        try {
            const resultado = await eliminarElementoCatalogo(tipo, porEliminar.id);
            setPorEliminar(null);
            if (!resultado.ok) {
                setAviso(resultado.mensaje);
                return;
            }
            setMensaje("El valor se eliminó correctamente.");
            setRevision((actual) => actual + 1);
        } catch {
            setPorEliminar(null);
            setAviso("No se pudo eliminar el valor. Intentá nuevamente.");
        } finally {
            operacionEnCurso.current = false;
            setProcesando(false);
        }
    }

    return (
        <section className={styles.contenedor} aria-label="Catálogos de publicaciones">
            <header className={styles.encabezado}>
                <h2 className={styles.titulo}>Catálogos de publicaciones</h2>
            </header>
            <div className={styles.controles}>
                <TextField select fullWidth id={selectId} label="Catálogo" value={tipo} size="small"
                    className={styles.selector} disabled={procesando} slotProps={propiedadesMenuSelect}
                    onChange={(evento) => cambiarCatalogo(evento.target.value as TipoCatalogo)}>
                    {catalogos.map(({ tipo, etiqueta }) => <MenuItem key={tipo} value={tipo} className={styles.opcionSelect}>{etiqueta}</MenuItem>)}
                </TextField>
                <button type="button" className={`boton-primario ${styles.botonAgregar}`} aria-label="Agregar valor" onClick={() => abrirEditor(null)} disabled={procesando || cargando || Boolean(datos?.error)}>
                    <AddIcon fontSize="small" aria-hidden="true" />
                    <span className={styles.textoBotonAgregar}>Agregar valor</span>
                </button>
            </div>
            {mensaje && <p role="status" className={styles.mensaje}>{mensaje}</p>}
            <div aria-busy={cargando}>
                {cargando ? <p role="status">Cargando catálogo...</p> : datos?.error ? (
                    <div className={styles.estado}>
                        <p role="alert" className={styles.error}>{datos.error}</p>
                        <button type="button" className="boton-secundario" onClick={() => setRevision((actual) => actual + 1)}>Reintentar</button>
                    </div>
                ) : datos?.elementos.length === 0 ? <p className={styles.estado}>No hay valores en este catálogo.</p> : (
                    <div className={styles.contenedorTabla}>
                        <table className={styles.tabla} aria-label={`Valores de ${catalogos.find((catalogo) => catalogo.tipo === tipo)?.etiqueta}`}>
                            <thead>
                                <tr>
                                    <th scope="col" className={styles.columnaValor}>Valor</th>
                                    <th scope="col" className={styles.columnaAcciones}>Opciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {datos?.elementos.map((elemento) => (
                                    <tr key={elemento.id} className={styles.fila}>
                                        <td className={styles.valor}>{nombreCompleto(elemento)}</td>
                                        <td className={styles.columnaAcciones}>
                                            <div className={styles.acciones}>
                                                <IconButton type="button" className={styles.botonEditar} disabled={procesando} title="Modificar"
                                                    aria-label={`Modificar ${nombreCompleto(elemento)}`} onClick={() => abrirEditor(elemento)}>
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                                <IconButton type="button" className={styles.botonEliminar} disabled={procesando} title="Eliminar"
                                                    aria-label={`Eliminar ${nombreCompleto(elemento)}`} onClick={() => setPorEliminar(elemento)}>
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            {editor && <EditorCatalogo tipo={tipo} elemento={editor.elemento} procesando={procesando} error={errorEdicion}
                alGuardar={guardar} alCerrar={() => { if (!procesando) setEditor(null); }} />}
            <ConfirmModal abierto={porEliminar !== null} titulo="Eliminar valor"
                descripcion={`¿Querés eliminar «${porEliminar ? nombreCompleto(porEliminar) : ""}»? Solo se puede eliminar si ninguna publicación lo utiliza.`}
                textoConfirmar="Eliminar" procesando={procesando} alConfirmar={() => { void eliminar(); }} alCancelar={() => setPorEliminar(null)} />
            <Dialog open={aviso !== null} onClose={() => setAviso(null)} fullWidth maxWidth="sm" role="alertdialog"
                aria-labelledby={avisoTituloId} aria-describedby={avisoDescripcionId} slotProps={{ paper: { className: styles.dialogo } }}>
                <DialogTitle id={avisoTituloId}>No se pudo eliminar</DialogTitle>
                <DialogContent><p id={avisoDescripcionId}>{aviso}</p></DialogContent>
                <DialogActions className={styles.accionesDialogo}>
                    <button type="button" className="boton-primario" onClick={() => setAviso(null)}>Entendido</button>
                </DialogActions>
            </Dialog>
        </section>
    );
}
