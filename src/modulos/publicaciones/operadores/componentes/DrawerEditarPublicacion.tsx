"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Drawer from "@mui/material/Drawer";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import useMediaQuery from "@mui/material/useMediaQuery";
import CloseIcon from "@mui/icons-material/Close";
import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";
import Image from "next/image";
import type { CambiosPublicacionOperador } from "../modificar-publicacion";
import styles from "./DrawerEditarPublicacion.module.css";

export type OpcionEdicion = {
    id: number;
    nombre: string;
};

export type OpcionVariedad = OpcionEdicion & {
    especieId: number;
};

export type OpcionPresentacion = OpcionEdicion & {
    variedadId: number;
};

export type OpcionCategoria = OpcionEdicion & {
    especieId: number | null;
};

export type PublicacionParaEditar = CambiosPublicacionOperador & {
    publicacionOperadorId: number;
    publicacionId: number;
    especieId: number;
    variedadId: number;
    especie: string;
    variedad: string;
};

type DrawerEditarPublicacionProps = {
    abierto: boolean;
    alCerrar: () => void;
    alGuardar: (publicacionOperadorId: number, cambios: CambiosPublicacionOperador, fotoNueva: File | null) => void | Promise<void>;
    publicacion: PublicacionParaEditar | null;
    especies: OpcionEdicion[];
    variedades: OpcionVariedad[];
    categorias: OpcionCategoria[];
    calibres: OpcionEdicion[];
    presentaciones: OpcionPresentacion[];
};

const formatoPrecio = /^(0|[1-9]\d{0,9})(\.\d{1,2})?$/;

function FormularioEdicion({ alCerrar, alGuardar, publicacion, especies, variedades, categorias, calibres, presentaciones, esWeb, guardando, setGuardando }: Omit<DrawerEditarPublicacionProps, "abierto"> & { publicacion: PublicacionParaEditar; esWeb: boolean; guardando: boolean; setGuardando: (valor: boolean) => void }) {
    const [precio, setPrecio] = useState(publicacion.precio ?? "");
    const [foto, setFoto] = useState(publicacion.foto);
    const [fotoNueva, setFotoNueva] = useState<File | null>(null);
    const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
    const [especieId, setEspecieId] = useState(publicacion.especieId);
    const [variedadId, setVariedadId] = useState(publicacion.variedadId);
    const [categoriaId, setCategoriaId] = useState(publicacion.categoriaId);
    const [calibreId, setCalibreId] = useState(publicacion.calibreId);
    const [presentacionId, setPresentacionId] = useState(publicacion.presentacionId);
    const [disponible, setDisponible] = useState(publicacion.disponible);
    const [error, setError] = useState("");
    const [confirmacionAbierta, setConfirmacionAbierta] = useState(false);
    const inputFotoRef = useRef<HTMLInputElement>(null);
    const urlVistaPreviaRef = useRef<string | null>(null);
    const idBase = `editar-publicacion-${publicacion.publicacionOperadorId}`;
    const fotoVisible = vistaPrevia ?? foto;
    const especieSeleccionada = especies.find((opcion) => opcion.id === especieId);
    const variedadSeleccionada = variedades.find((opcion) => opcion.id === variedadId);
    const variedadesDisponibles = variedades.filter((opcion) => opcion.especieId === especieId);
    const presentacionesDisponibles = presentaciones.filter((opcion) => opcion.variedadId === variedadId);
    const categoriasDisponibles = categorias.filter((opcion) => opcion.especieId === null || opcion.especieId === especieId);

    useEffect(() => {
        return () => {
            if (urlVistaPreviaRef.current) URL.revokeObjectURL(urlVistaPreviaRef.current);
        };
    }, []);

    function seleccionarFoto(evento: ChangeEvent<HTMLInputElement>) {
        const archivo = evento.target.files?.[0];
        if (!archivo) return;

        if (!["image/jpeg", "image/png", "image/webp"].includes(archivo.type) || archivo.size === 0 || archivo.size > 5 * 1024 * 1024) {
            setError("Seleccioná una imagen JPEG, PNG o WebP de hasta 5 MB.");
            evento.target.value = "";
            return;
        }

        if (urlVistaPreviaRef.current) URL.revokeObjectURL(urlVistaPreviaRef.current);
        const url = URL.createObjectURL(archivo);
        urlVistaPreviaRef.current = url;
        setVistaPrevia(url);
        setFotoNueva(archivo);
        setError("");
        evento.target.value = "";
    }

    function borrarFoto() {
        if (urlVistaPreviaRef.current) URL.revokeObjectURL(urlVistaPreviaRef.current);
        urlVistaPreviaRef.current = null;
        setVistaPrevia(null);
        setFotoNueva(null);
        setFoto(null);
    }

    function cambiarPrecio(cantidad: number) {
        const precioActual = Number(precio || "0");
        if (!Number.isFinite(precioActual)) return;
        const nuevoPrecio = Math.min(9999999999.99, Math.max(0, precioActual + cantidad));
        setPrecio(String(Math.round(nuevoPrecio * 100) / 100));
    }

    function cambiarEspecie(nuevaEspecieId: number) {
        const variedadesDeLaEspecie = variedades.filter((opcion) => opcion.especieId === nuevaEspecieId);
        const primeraVariedad = variedadesDeLaEspecie.find((variedad) => presentaciones.some((presentacion) => presentacion.variedadId === variedad.id)) ?? variedadesDeLaEspecie[0];
        const primeraPresentacion = presentaciones.find((opcion) => opcion.variedadId === primeraVariedad?.id);
        const categoriaActual = categorias.find((opcion) => opcion.id === categoriaId);
        const categoriaCompatible = categoriaActual?.especieId === null || categoriaActual?.especieId === nuevaEspecieId;
        const primeraCategoria = categorias.find((opcion) => opcion.especieId === null || opcion.especieId === nuevaEspecieId);

        setEspecieId(nuevaEspecieId);
        setVariedadId(primeraVariedad?.id ?? 0);
        setPresentacionId(primeraPresentacion?.id ?? 0);
        if (!categoriaCompatible) setCategoriaId(primeraCategoria?.id ?? 0);
    }

    function cambiarVariedad(nuevaVariedadId: number) {
        const primeraPresentacion = presentaciones.find((opcion) => opcion.variedadId === nuevaVariedadId);
        setVariedadId(nuevaVariedadId);
        setPresentacionId(primeraPresentacion?.id ?? 0);
    }

    function solicitarGuardado(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        if (guardando) return;
        setError("");

        const precioNormalizado = precio.trim();
        if (precioNormalizado !== "" && !formatoPrecio.test(precioNormalizado)) {
            setError("El precio debe tener hasta 10 dígitos enteros y 2 decimales.");
            return;
        }

        const variedadValida = variedadesDisponibles.some((opcion) => opcion.id === variedadId);
        const presentacionValida = presentacionesDisponibles.some((opcion) => opcion.id === presentacionId);
        const categoriaValida = categoriasDisponibles.some((opcion) => opcion.id === categoriaId);
        const calibreValido = calibres.some((opcion) => opcion.id === calibreId);
        if (!especieSeleccionada || !variedadValida || !presentacionValida || !categoriaValida || !calibreValido) {
            setError("Elegí una especie, variedad, presentación, categoría y calibre válidos.");
            return;
        }

        setConfirmacionAbierta(true);
    }

    async function guardar() {
        if (guardando) return;
        setConfirmacionAbierta(false);

        const cambios: CambiosPublicacionOperador = {
            precio: precio.trim() || null,
            foto,
            categoriaId,
            calibreId,
            presentacionId,
            disponible,
        };

        setGuardando(true);
        try {
            await alGuardar(publicacion.publicacionOperadorId, cambios, fotoNueva);
            alCerrar();
        } catch (error) {
            setError(error instanceof Error ? error.message : "No se pudieron guardar los cambios. Intentá de nuevo.");
        } finally {
            setGuardando(false);
        }
    }

    return (
        <>
            <div className={styles.asa} aria-hidden="true" />
            <div className={styles.encabezado}>
                <div>
                    <h2 className={styles.titulo} id={`${idBase}-titulo`}>Editar publicación</h2>
                    <p className={styles.subtitulo}>Actualizá los datos de tu producto</p>
                </div>
                <button className={styles.cerrar} type="button" onClick={alCerrar} disabled={guardando} aria-label="Cerrar edición">
                    <CloseIcon fontSize="small" />
                </button>
            </div>

            <form className={styles.formulario} onSubmit={solicitarGuardado}>
                <div className={styles.cuerpo}>
                    <div className={styles.seccionFoto}>
                        <div className={styles.marcoFoto}>
                            {fotoVisible ? (
                                <Image className={styles.imagenFoto} src={fotoVisible} alt={`Foto de ${especieSeleccionada?.nombre ?? publicacion.especie} ${variedadSeleccionada?.nombre ?? publicacion.variedad}`} fill sizes="(min-width: 768px) 480px, 100vw" unoptimized />
                            ) : (
                                <div className={styles.sinFoto}><PhotoCameraOutlinedIcon aria-hidden="true" /><span>Sin foto</span></div>
                            )}
                            <button className={styles.botonFoto} type="button" onClick={() => inputFotoRef.current?.click()} disabled={guardando}>
                                <PhotoCameraOutlinedIcon fontSize="small" /> Editar foto
                            </button>
                            <input ref={inputFotoRef} className={styles.inputFoto} type="file" accept="image/jpeg,image/png,image/webp" capture={esWeb ? undefined : "environment"} onChange={seleccionarFoto} disabled={guardando} aria-label="Seleccionar foto del producto" />
                        </div>
                        {fotoVisible && <button className={styles.borrarFoto} type="button" onClick={borrarFoto} disabled={guardando}>Borrar foto</button>}
                    </div>

                    <label className={styles.disponibilidad} htmlFor={`${idBase}-disponibilidad`} data-disponible={disponible} data-guardando={guardando}>
                        <span className={styles.textoDisponibilidad}>
                            <span className={styles.etiqueta}>Disponibilidad</span>
                            <span className={styles.estadoDisponibilidad}>{disponible ? "Disponible" : "No disponible"}</span>
                        </span>
                        <Switch className={styles.interruptorDisponibilidad} checked={disponible} onChange={(_, seleccionado) => setDisponible(seleccionado)} disabled={guardando} slotProps={{ input: { id: `${idBase}-disponibilidad`, role: "switch", "aria-label": "Publicación disponible" } }} />
                    </label>

                    <div className={styles.campo}>
                        <label className={styles.etiqueta} htmlFor={`${idBase}-precio`}>Precio en pesos</label>
                        <div className={styles.controlesPrecio}>
                            <button className={styles.ajustarPrecio} type="button" onClick={() => cambiarPrecio(-10)} disabled={guardando} aria-label="Disminuir precio en 10">−</button>
                            <input className={styles.entrada} id={`${idBase}-precio`} type="text" inputMode="decimal" placeholder="Ingresar precio aquí" value={precio} onChange={(evento) => setPrecio(evento.target.value)} disabled={guardando} />
                            <button className={styles.ajustarPrecio} type="button" onClick={() => cambiarPrecio(10)} disabled={guardando} aria-label="Aumentar precio en 10">+</button>
                        </div>
                        <small className={styles.ayuda}>Dejalo vacío si el producto no tiene precio.</small>
                    </div>

                    <div className={styles.datosProducto}>
                        <div className={styles.campo}>
                            <TextField select label="Especie" id={`${idBase}-especie`} value={especies.some((opcion) => opcion.id === especieId) ? especieId : ""} onChange={(evento) => cambiarEspecie(Number(evento.target.value))} size="small" fullWidth required disabled={guardando} className={styles.selectMui}>
                                {especies.map((opcion) => <MenuItem key={opcion.id} value={opcion.id} className={styles.opcionSelect}>{opcion.nombre}</MenuItem>)}
                            </TextField>
                        </div>
                        <div className={styles.campo}>
                            <TextField select label="Variedad" id={`${idBase}-variedad`} value={variedadesDisponibles.some((opcion) => opcion.id === variedadId) ? variedadId : ""} onChange={(evento) => cambiarVariedad(Number(evento.target.value))} size="small" fullWidth required disabled={guardando} className={styles.selectMui}>
                                {variedadesDisponibles.length === 0 && <MenuItem value={0} disabled className={styles.opcionSelect}>Sin variedades disponibles</MenuItem>}
                                {variedadesDisponibles.map((opcion) => <MenuItem key={opcion.id} value={opcion.id} className={styles.opcionSelect}>{opcion.nombre}</MenuItem>)}
                            </TextField>
                        </div>
                    </div>

                    <div className={styles.campo}>
                        <TextField select label="Presentación" id={`${idBase}-presentacion`} value={presentacionesDisponibles.some((opcion) => opcion.id === presentacionId) ? presentacionId : ""} onChange={(evento) => setPresentacionId(Number(evento.target.value))} size="small" fullWidth required disabled={guardando} className={styles.selectMui}>
                            {presentacionesDisponibles.length === 0 && <MenuItem value={0} disabled className={styles.opcionSelect}>Sin presentaciones disponibles</MenuItem>}
                            {presentacionesDisponibles.map((opcion) => <MenuItem key={opcion.id} value={opcion.id} className={styles.opcionSelect}>{opcion.nombre}</MenuItem>)}
                        </TextField>
                    </div>

                    <div className={styles.rejilla}>
                        <div className={styles.campo}>
                            <TextField select label="Categoría" id={`${idBase}-categoria`} value={categoriasDisponibles.some((opcion) => opcion.id === categoriaId) ? categoriaId : ""} onChange={(evento) => setCategoriaId(Number(evento.target.value))} size="small" fullWidth required disabled={guardando} className={styles.selectMui}>
                                {categoriasDisponibles.length === 0 && <MenuItem value={0} disabled className={styles.opcionSelect}>Sin categorías disponibles</MenuItem>}
                                {categoriasDisponibles.map((opcion) => <MenuItem key={opcion.id} value={opcion.id} className={styles.opcionSelect}>{opcion.nombre}</MenuItem>)}
                            </TextField>
                        </div>
                        <div className={styles.campo}>
                            <TextField select label="Calibre" id={`${idBase}-calibre`} value={calibres.some((opcion) => opcion.id === calibreId) ? calibreId : ""} onChange={(evento) => setCalibreId(Number(evento.target.value))} size="small" fullWidth required disabled={guardando} className={styles.selectMui}>
                                {calibres.map((opcion) => <MenuItem key={opcion.id} value={opcion.id} className={styles.opcionSelect}>{opcion.nombre}</MenuItem>)}
                            </TextField>
                        </div>
                    </div>

                    {error && <p className={styles.error} role="alert">{error}</p>}
                </div>

                <div className={styles.pie}>
                    <button className={styles.cancelar} type="button" onClick={alCerrar} disabled={guardando}>Cancelar</button>
                    <button className={styles.guardar} type="submit" disabled={guardando}>{guardando ? "Guardando..." : "Guardar cambios"}</button>
                </div>
            </form>

            <Dialog className={styles.confirmacion} open={confirmacionAbierta} onClose={() => setConfirmacionAbierta(false)} aria-labelledby={`${idBase}-confirmacion`} fullWidth maxWidth="xs">
                <DialogTitle id={`${idBase}-confirmacion`}>¿Guardar los cambios?</DialogTitle>
                <DialogContent>Se actualizarán los datos de esta publicación.</DialogContent>
                <DialogActions>
                    <button className={styles.cancelar} type="button" onClick={() => setConfirmacionAbierta(false)}>Cancelar</button>
                    <button className={styles.guardar} type="button" onClick={() => void guardar()}>Confirmar</button>
                </DialogActions>
            </Dialog>
        </>
    );
}

export default function DrawerEditarPublicacion({ abierto, alCerrar, publicacion, alGuardar, especies, variedades, categorias, calibres, presentaciones }: DrawerEditarPublicacionProps) {
    const esWeb = useMediaQuery("(min-width: 768px)");
    const [guardando, setGuardando] = useState(false);

    function cerrar() {
        if (!guardando) alCerrar();
    }

    return (
        <Drawer anchor={esWeb ? "right" : "bottom"} open={abierto && publicacion !== null} onClose={cerrar} slotProps={{ paper: { className: styles.panel, role: "dialog", "aria-modal": true, "aria-labelledby": publicacion ? `editar-publicacion-${publicacion.publicacionOperadorId}-titulo` : undefined } }}>
            {publicacion && (
                <FormularioEdicion key={`${publicacion.publicacionOperadorId}-${abierto}`} publicacion={publicacion} alCerrar={alCerrar} alGuardar={alGuardar} especies={especies} variedades={variedades} categorias={categorias} calibres={calibres} presentaciones={presentaciones} esWeb={esWeb} guardando={guardando} setGuardando={setGuardando} />
            )}
        </Drawer>
    );
}
