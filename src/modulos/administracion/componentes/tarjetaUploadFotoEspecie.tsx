"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { IconButton, MenuItem, TextField } from "@mui/material";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import SearchIcon from "@mui/icons-material/Search";
import styles from "./tarjetaUploadFotoEspecie.module.css";
import ImagenPublicacion from "@/modulos/publicaciones/componentes/ImagenPublicacion";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import CheckOutlinedIcon from "@mui/icons-material/CheckOutlined";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";

export interface Especie {
    id: number;
    nombreEspecie: string;
    fotoEspecie: string | null;
}

interface TarjetaUploadFotoEspecieProps {
    titulo: string;
    descripcion: string;
    especies: Especie[];
    especieSeleccionada: string;
    onChangeEspecie: (id: string) => void;
    onGuardarFoto: (especieId: number, archivo: File) => Promise<void>;
    onEliminarFoto: (especieId: number) => Promise<void>;
}

const propiedadesMenuSelect = { select: { MenuProps: { slotProps: { paper: { sx: { maxHeight: "min(20rem, 50dvh)", overflowY: "auto" } } } } } } as const;

function normalizarTexto(texto: string) {
    return texto.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export default function TarjetaUploadFotoEspecie({ titulo, descripcion, especies, especieSeleccionada, onChangeEspecie, onGuardarFoto, onEliminarFoto }: TarjetaUploadFotoEspecieProps) {
    const [mostrarImagen, setMostrarImagen] = useState(true);
    const [busqueda, setBusqueda] = useState("");
    const inputArchivoRef = useRef<HTMLInputElement>(null);
    const contenedorImagenRef = useRef<HTMLDivElement>(null);
    const [archivoPendiente, setArchivoPendiente] = useState<File | null>(null);
    const [previewImagen, setPreviewImagen] = useState<string | null>(null);
    const [eliminacionPendiente, setEliminacionPendiente] = useState(false);
    const especieActual = especies.find((especie) => String(especie.id) === especieSeleccionada);

    function limpiarFiltros() {
        setBusqueda("");
        cancelarCambioImagen();
        onChangeEspecie("");
        setMostrarImagen(true);
    }

    function manejarCambioEspecie(id: string) {
        cancelarCambioImagen();
        onChangeEspecie(id);
        setMostrarImagen(true);
    }

    const especiesFiltradas = useMemo(() => {
        const textoBusqueda = normalizarTexto(busqueda.trim());
        if (textoBusqueda === "") {
            return especies;
        }
        return especies.filter((especie) => normalizarTexto(especie.nombreEspecie).startsWith(textoBusqueda));
    }, [busqueda, especies]);

    useEffect(() => {
        const textoBusqueda = normalizarTexto(busqueda.trim());
        if (textoBusqueda === "") {
            return;
        }
        const coincidenciaExacta = especies.find((especie) => normalizarTexto(especie.nombreEspecie) === textoBusqueda);
        if (coincidenciaExacta) {
            onChangeEspecie(String(coincidenciaExacta.id));
            setMostrarImagen(true);
        }
    }, [busqueda, especies, onChangeEspecie]);

    function seleccionarArchivo() {
        inputArchivoRef.current?.click();
    }

    function manejarCambioArchivo(evento: ChangeEvent<HTMLInputElement>) {
        const archivo = evento.target.files?.[0];
        if (!archivo) {
            return;
        }
        if (previewImagen) {
            URL.revokeObjectURL(previewImagen);
        }
        setEliminacionPendiente(false);
        setArchivoPendiente(archivo);
        setPreviewImagen(URL.createObjectURL(archivo));
        evento.target.value = "";
    }

    function solicitarEliminarImagen() {
        setArchivoPendiente(null);
        if (previewImagen) {
            URL.revokeObjectURL(previewImagen);
            setPreviewImagen(null);
        }
        setEliminacionPendiente(true);
    }

    async function confirmarCambioImagen() {
        if (!especieActual) {
            return;
        }
        if (eliminacionPendiente) {
            await onEliminarFoto(especieActual.id);
            setEliminacionPendiente(false);
            return;
        }
        if (!archivoPendiente) {
            return;
        }
        await onGuardarFoto(especieActual.id, archivoPendiente);
        setArchivoPendiente(null);
        setPreviewImagen(null);
    }

    function cancelarCambioImagen() {
        if (previewImagen) {
            URL.revokeObjectURL(previewImagen);
        }
        setArchivoPendiente(null);
        setPreviewImagen(null);
        setEliminacionPendiente(false);
    }

    useEffect(() => {
        function manejarClickFuera(evento: MouseEvent) {
            if ((archivoPendiente || eliminacionPendiente) && contenedorImagenRef.current && !contenedorImagenRef.current.contains(evento.target as Node)) {
                cancelarCambioImagen();
            }
        }
        document.addEventListener("mousedown", manejarClickFuera);
        return () => {document.removeEventListener("mousedown", manejarClickFuera)};
    }, [archivoPendiente, eliminacionPendiente, previewImagen]);

    const contenido = (
        <div className={styles.tarjeta}>
            <div className={styles.titulo}>{titulo}</div>
            <div className={styles.descripcion}>{descripcion}</div>
            <div className={styles.contenido}>
                <div className={styles.contenedorFiltro}>   
                    <div className={styles.contenedorBusqueda}>
                        <TextField fullWidth size="small" label="Buscar especie" type="search" value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} className={`${styles.selectMui} ${styles.filtroBuscador}`}
                            slotProps={{input: {startAdornment: (<SearchIcon aria-hidden="true" sx={{ color: "var(--color-muted)" }}/>)}}}
                        />
                        <TextField select fullWidth label="Especie" value={especieSeleccionada} onChange={(evento) => manejarCambioEspecie(evento.target.value)} size="small" className={`${styles.selectMui} ${styles.filtroEspecie}`} slotProps={{ ...propiedadesMenuSelect }}>
                            {especiesFiltradas.map((especie) => (
                                <MenuItem key={especie.id} value={String(especie.id)} className={styles.opcionSelect}>
                                    {especie.nombreEspecie}
                                </MenuItem>
                            ))}
                        </TextField>
                    </div>
                    <div className={styles.pie}>
                        <span className={styles.resultados}>
                            {especiesFiltradas.length}{" "}{especiesFiltradas.length === 1 ? "especie" : "especies"}
                        </span>
                        <button type="button" className={styles.limpiar} onClick={limpiarFiltros}>
                            Limpiar filtros
                        </button>
                    </div>
                </div>
                <div ref={contenedorImagenRef} className={styles.seccionImagen}>
                    <input ref={inputArchivoRef} type="file" accept="image/*" hidden onChange={manejarCambioArchivo}/>
                    <div className={styles.marcoImagen}>
                        <div className={styles.contenedorImagen}>
                            <div className={styles.cajaImagen}>
                                <ImagenPublicacion src={eliminacionPendiente ? null : previewImagen ?? especieActual?.fotoEspecie ?? null} alt={especieActual ? `Foto de ${especieActual.nombreEspecie}`  : "Foto predeterminada de la especie"} fill sizes="256px" className={styles.imagen} 
                                    reemplazo={
                                        <div className={styles.sinFoto}>
                                            <ImageOutlinedIcon className={styles.iconoFoto}/>Sin foto
                                        </div>
                                    }
                                />
                                {especieActual && (
                                    <div className={`${styles.overlayImagen} ${ archivoPendiente || eliminacionPendiente ? styles.overlayActivo : ""}`}>
                                        {archivoPendiente || eliminacionPendiente ? (
                                            <div className={styles.accionesImagen}>
                                                <IconButton aria-label="Guardar" className={styles.botonGuardar} onClick={confirmarCambioImagen}>
                                                    <CheckOutlinedIcon />
                                                </IconButton>
                                                <IconButton aria-label="Descartar cambios" className={styles.botonDescartar} onClick={cancelarCambioImagen}>
                                                    <CloseOutlinedIcon />
                                                </IconButton>
                                            </div>
                                        ) : (
                                            <div className={styles.accionesImagen}>
                                                <IconButton aria-label="Editar" className={styles.botonAccion} onClick={seleccionarArchivo}>
                                                    <EditOutlinedIcon />
                                                </IconButton>
                                                <IconButton aria-label="Eliminar" className={styles.botonDescartar} onClick={solicitarEliminarImagen}>
                                                    <DeleteOutlinedIcon />
                                                </IconButton>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
    return contenido; 
}