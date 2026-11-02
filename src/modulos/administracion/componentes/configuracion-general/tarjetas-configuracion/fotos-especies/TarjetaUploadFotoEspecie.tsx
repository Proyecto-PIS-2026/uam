"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Autocomplete, Dialog, IconButton, TextField } from "@mui/material";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import CheckOutlinedIcon from "@mui/icons-material/CheckOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import ImagenPublicacion from "@/modulos/publicaciones/componentes/ImagenPublicacion";
import { useNotificacionToast } from "@/compartido/componentes/NotificacionToast";

import styles from "./TarjetaUploadFotoEspecie.module.css";

export interface Especie {
    id: number;
    nombreEspecie: string;
    fotoEspecie: string | null;
}

interface TarjetaUploadFotoEspecieProps {
    titulo: string;
    especies: Especie[];
    especieSeleccionada: string;
    onChangeEspecie: (id: string) => void;
    onGuardarFoto: (especieId: number, archivo: File) => Promise<void>;
    onEliminarFoto: (especieId: number) => Promise<void>;
}

function normalizarTexto(texto: string) {return texto.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "")}

export default function TarjetaUploadFotoEspecie({titulo, especies, especieSeleccionada, onChangeEspecie, onGuardarFoto, onEliminarFoto }: TarjetaUploadFotoEspecieProps) {
    const [guardando, setGuardando] = useState(false);
    const [esperandoActualizacion, setEsperandoActualizacion] = useState(false);
    const [archivoPendiente, setArchivoPendiente] = useState<File | null>(null);
    const [previewImagen, setPreviewImagen] = useState<string | null>(null);
    const [eliminacionPendiente, setEliminacionPendiente] = useState(false);
    const [fotoAmpliada, setFotoAmpliada] = useState(false);

    const inputArchivoRef = useRef<HTMLInputElement>(null);
    const fotoAnteriorRef = useRef<string | null>(null);
    const fotoCargadaRef = useRef<string | null>(null);

    const { notificar } = useNotificacionToast();

    const especieActual = especies.find((especie) => String(especie.id) === especieSeleccionada);

    const fotoServidor = especieActual?.fotoEspecie ?? null;
    const ocupado = guardando || esperandoActualizacion;
    const huboCambios = archivoPendiente !== null || eliminacionPendiente;
    const fotoVisible = eliminacionPendiente ? null : previewImagen ?? fotoServidor;

    useEffect(() => {
        return () => {
            if (previewImagen) {
                URL.revokeObjectURL(previewImagen);
            }
        };
    }, [previewImagen]);

    useEffect(() => {
        if (!esperandoActualizacion) {
            return;
        }
        const eliminacionConfirmada = eliminacionPendiente && !fotoServidor;
        const nuevaFotoCargada = !eliminacionPendiente && fotoServidor !== null && fotoServidor !== fotoAnteriorRef.current && fotoCargadaRef.current === fotoServidor;
        if (eliminacionConfirmada || nuevaFotoCargada) {
            setArchivoPendiente(null);
            setPreviewImagen(null);
            setEliminacionPendiente(false);
            setEsperandoActualizacion(false);
        }
    }, [esperandoActualizacion, eliminacionPendiente, fotoServidor]);

    function limpiarCambioImagen() {
        setArchivoPendiente(null);
        setPreviewImagen(null);
        setEliminacionPendiente(false);
        setEsperandoActualizacion(false);
        setFotoAmpliada(false);
    }

    function manejarCambioEspecie(id: string) {
        if (ocupado) {
            return;
        }
        limpiarCambioImagen();
        fotoCargadaRef.current = null;
        onChangeEspecie(id);
    }

    function manejarCambioArchivo(evento: ChangeEvent<HTMLInputElement>) {
        const archivo = evento.target.files?.[0];
        evento.target.value = "";
        if (!archivo || ocupado || !especieActual) {
            return;
        }
        if (!["image/jpeg", "image/png", "image/webp"].includes(archivo.type)) {
            notificar("La imagen debe ser JPEG, PNG o WebP.", "error");
            return;
        }
        if (archivo.size === 0 || archivo.size > 10 * 1024 * 1024) {
            notificar("La imagen debe pesar menos de 10 MB.", "error");
            return;
        }
        setFotoAmpliada(false);
        setEliminacionPendiente(false);
        setArchivoPendiente(archivo);
        setPreviewImagen(URL.createObjectURL(archivo));
    }

    function solicitarEliminarImagen() {
        if (ocupado || !especieActual) {
            return;
        }
        setFotoAmpliada(false);
        setArchivoPendiente(null);
        setPreviewImagen(null);
        setEliminacionPendiente(Boolean(fotoServidor));
    }

    function manejarCargaFotoGuardada() {
        fotoCargadaRef.current = fotoServidor;
        if (!esperandoActualizacion || eliminacionPendiente || !fotoServidor || fotoServidor === fotoAnteriorRef.current) {
            return;
        }
        setArchivoPendiente(null);
        setPreviewImagen(null);
        setEsperandoActualizacion(false);
    }

    async function confirmarCambioImagen() {
        if (!especieActual || ocupado || !huboCambios) {
            return;
        }
        setGuardando(true);
        fotoAnteriorRef.current = fotoServidor;
        try {
            if (eliminacionPendiente) {
                await onEliminarFoto(especieActual.id);
            } else if (archivoPendiente) {
                await onGuardarFoto(especieActual.id, archivoPendiente);
            }
            setEsperandoActualizacion(true);
            setFotoAmpliada(false);
            notificar("La foto de la especie se actualizó correctamente.", "success");
        } catch (error) {
            notificar(error instanceof Error ? error.message : "No se pudo actualizar la foto.", "error");
        } finally {
            setGuardando(false);
        }
    }

    const contenido = (
        <div className={styles.tarjeta}>
            <div className={styles.titulo}>{titulo}</div>
            <span className={styles.descripcion}>Seleccioná una especie para actualizar o quitar su foto.</span>
            <div className={styles.filaEspecie}>
                <Autocomplete
                    fullWidth
                    size="small"
                    disabled={ocupado}
                    options={especies}
                    value={especieActual ?? null}
                    getOptionLabel={(especie) => especie.nombreEspecie}
                    isOptionEqualToValue={(opcion, valor) => opcion.id === valor.id}
                    onChange={(_, especie) => {manejarCambioEspecie(especie ? String(especie.id) : "")}}
                    filterOptions={(opciones, { inputValue }) => {const texto = normalizarTexto(inputValue.trim()); return opciones.filter((especie) => normalizarTexto(especie.nombreEspecie).startsWith(texto))}}
                    noOptionsText="No se encontraron especies"
                    loadingText="Cargando especies…"
                    clearText="Limpiar selección"
                    openText="Abrir opciones"
                    closeText="Cerrar opciones"
                    className={`${styles.selectMui}`}
                    slotProps={{listbox: {sx: {maxHeight: "min(20rem, 50dvh)"}}}}
                    renderOption={(props, especie) => {const { key, ...otrasProps } = props; return (<li key={key} {...otrasProps} className={`${otrasProps.className ?? ""} ${styles.opcionAutocomplete}`}>{especie.nombreEspecie}</li>)}}
                    renderInput={(params) => (<TextField {...params} label="Especie" placeholder="Buscá una especie"/>)}
                />
                <IconButton aria-label="Guardar cambios" disabled={!huboCambios || ocupado} className={styles.botonGuardar} onClick={confirmarCambioImagen}>
                    <CheckOutlinedIcon />
                </IconButton>
            </div>
            <div className={styles.seccionImagen}>
                <input ref={inputArchivoRef} type="file" accept="image/jpeg,image/png,image/webp" disabled={ocupado} hidden onChange={manejarCambioArchivo}/>
                <div className={styles.contenedorImagen}>
                    <ImagenPublicacion src={eliminacionPendiente ? null : fotoServidor} alt={especieActual ? `Foto de ${especieActual.nombreEspecie}` : "Foto de especie"} fill sizes="144px" className={styles.imagen} onLoad={manejarCargaFotoGuardada}
                        reemplazo={
                            <div className={styles.sinFoto}>
                                <ImageOutlinedIcon className={styles.iconoFoto}/>
                                Sin foto
                            </div>
                        }
                    />
                    {previewImagen && !eliminacionPendiente && (
                        <div className={styles.capaPreview}>
                            <ImagenPublicacion src={previewImagen} alt={`Vista previa de ${especieActual?.nombreEspecie ?? "especie"}`} fill sizes="144px" className={styles.imagen} reemplazo={null}/>
                        </div>
                    )}
                    {fotoVisible && (
                        <button type="button" className={styles.ampliarFoto} aria-label={`Ampliar foto de ${especieActual?.nombreEspecie ?? "especie"}`} onClick={() => setFotoAmpliada(true)}/>
                    )}
                </div>
                <div className={styles.detalleFoto}>
                    <div className={styles.tituloFoto}>
                        {especieActual ? `Foto de ${especieActual.nombreEspecie}` : "Foto de especie"}
                    </div>
                    <span className={styles.ayudaFoto}>JPEG, PNG o WebP, hasta 10 MB.</span>
                    <div className={styles.accionesImagen}>
                        <IconButton aria-label="Cambiar foto" disabled={!especieActual || ocupado} className={styles.botonAccion} onClick={() => inputArchivoRef.current?.click()}>
                            <AddPhotoAlternateOutlinedIcon />
                        </IconButton>
                        <IconButton aria-label="Quitar foto" disabled={!especieActual || ocupado || !fotoVisible} className={styles.botonEliminar} onClick={solicitarEliminarImagen}>
                            <DeleteOutlinedIcon />
                        </IconButton>
                    </div>
                </div>
            </div>
                <Dialog open={fotoAmpliada && Boolean(fotoVisible)} onClose={() => setFotoAmpliada(false)} maxWidth={false} fullWidth aria-label="Foto ampliada de especie" slotProps={{paper: {className: styles.modalFoto, "aria-label": "Foto ampliada de especie"}, backdrop: {sx: { backgroundColor: "rgba(0, 0, 0, 0.85)" }}}}>                
                <button type="button" autoFocus aria-label="Cerrar foto ampliada" className={styles.cerrarFoto} onClick={() => setFotoAmpliada(false)}>
                    <CloseOutlinedIcon fontSize="small" />
                </button>
                <div className={styles.fotoAmpliada}>
                    <ImagenPublicacion src={fotoVisible} alt={`Foto ampliada de ${especieActual?.nombreEspecie ?? "especie"}`} fill loading="eager" sizes="(min-width: 832px) 50rem, (min-width: 768px) calc(100vw - 2rem), (min-width: 536px) 32rem, calc(100vw - 1.5rem)" className={styles.imagenAmpliada}
                        reemplazo={
                            <div className={styles.sinFoto}>
                                <ImageOutlinedIcon className={styles.iconoFoto}/>
                                Sin foto
                            </div>
                        }
                    />
                </div>
            </Dialog>
        </div>
    );
    return contenido; 
}