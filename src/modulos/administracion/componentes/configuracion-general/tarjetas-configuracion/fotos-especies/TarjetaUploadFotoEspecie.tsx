"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Autocomplete, Dialog, IconButton, TextField } from "@mui/material";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import ImagenPublicacion from "@/modulos/publicaciones/componentes/ImagenPublicacion";
import { useNotificacionToast } from "@/compartido/componentes/NotificacionToast";
import { useVistaPreviaArchivo } from "./useVistaPreviaArchivo";

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
    cambios: Record<number, File | null>;
    confirmadas?: Record<number, File | null>;
    onChangeFoto: (especieId: number, archivo: File | null | undefined) => void;
    guardando?: boolean;
}

function normalizarTexto(texto: string) {return texto.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "")}

export default function TarjetaUploadFotoEspecie({ titulo, especies, especieSeleccionada, onChangeEspecie, cambios, confirmadas = {}, onChangeFoto, guardando = false }: TarjetaUploadFotoEspecieProps) {
    const [fotoAmpliada, setFotoAmpliada] = useState(false);

    const inputArchivoRef = useRef<HTMLInputElement>(null);

    const { notificar } = useNotificacionToast();

    const especieActual = especies.find((especie) => String(especie.id) === especieSeleccionada);

    const fotoServidor = especieActual?.fotoEspecie ?? null;
    const modificado = Boolean(especieActual && Object.hasOwn(cambios, especieActual.id));
    const fotoBase = especieActual && Object.hasOwn(confirmadas, especieActual.id) ? confirmadas[especieActual.id] : fotoServidor;
    const fotoEfectiva = especieActual && modificado ? cambios[especieActual.id] : fotoBase;
    const archivoVisible = fotoEfectiva && typeof fotoEfectiva !== "string" ? fotoEfectiva : null;
    const previewImagen = useVistaPreviaArchivo(archivoVisible);
    const fotoVisible = typeof fotoEfectiva === "string" ? fotoEfectiva : previewImagen;

    function manejarCambioEspecie(id: string) {
        if (guardando) {
            return;
        }
        setFotoAmpliada(false);
        onChangeEspecie(id);
    }

    function manejarCambioArchivo(evento: ChangeEvent<HTMLInputElement>) {
        const archivo = evento.target.files?.[0];
        evento.target.value = "";
        if (!archivo || guardando || !especieActual) {
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
        onChangeFoto(especieActual.id, archivo);
    }

    function solicitarEliminarImagen() {
        if (guardando || !especieActual) {
            return;
        }
        setFotoAmpliada(false);
        onChangeFoto(especieActual.id, fotoBase ? null : undefined);
    }

    const contenido = (
        <div className={styles.tarjeta}>
            <div className={styles.titulo}>{titulo}</div>
            <div className={styles.filaEspecie}>
                <Autocomplete
                    fullWidth
                    size="small"
                    disabled={guardando}
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
            </div>
            <div className={styles.seccionImagen} data-modificado={modificado}>
                <input ref={inputArchivoRef} type="file" accept="image/jpeg,image/png,image/webp" disabled={guardando || !especieActual} hidden onChange={manejarCambioArchivo}/>
                <div className={styles.contenedorImagen}>
                    <ImagenPublicacion src={fotoEfectiva === null ? null : fotoServidor} alt={especieActual ? `Foto de ${especieActual.nombreEspecie}` : "Foto de especie"} fill sizes="144px" className={styles.imagen}
                        reemplazo={
                            <div className={styles.sinFoto}>
                                <ImageOutlinedIcon className={styles.iconoFoto}/>
                                Sin foto
                            </div>
                        }
                    />
                    {previewImagen && (
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
                        <IconButton type="button" aria-label="Cambiar foto" disabled={!especieActual || guardando} className={styles.botonAccion} onClick={() => inputArchivoRef.current?.click()}>
                            <AddPhotoAlternateOutlinedIcon />
                        </IconButton>
                        <IconButton type="button" aria-label="Quitar foto" disabled={!especieActual || guardando || !fotoVisible} className={styles.botonEliminar} onClick={solicitarEliminarImagen}>
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
