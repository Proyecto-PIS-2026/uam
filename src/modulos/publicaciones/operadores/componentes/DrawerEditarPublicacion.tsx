"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
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
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";
import Image from "next/image";
// import HojasDecorativas from "../../../../compartido/HojasDecorativas";
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
    presentacion?: string;
    categoria?: string;
    calibre?: string;
};

type DrawerEditarPublicacionProps = {
    abierto: boolean;
    alCerrar: () => void;
    modoInicial?: "consulta" | "edicion";
    alEliminar?: () => void;
    eliminando?: boolean;
    actualizando?: boolean;
    errorConsulta?: string;
    children?: ReactNode;
    alGuardar: (publicacionOperadorId: number, cambios: CambiosPublicacionOperador, fotoNueva: File | null) => void | Promise<void>;
    publicacion: PublicacionParaEditar | null;
    especies: OpcionEdicion[];
    variedades: OpcionVariedad[];
    categorias: OpcionCategoria[];
    calibres: OpcionEdicion[];
    presentaciones: OpcionPresentacion[];
    paises: OpcionEdicion[];
};

const formatoPrecio = /^(0|[1-9]\d{0,9})$/;

function FormularioEdicion({ alCerrar, alGuardar, publicacion, especies, variedades, categorias, calibres, presentaciones, paises, modoInicial = "edicion", alEliminar, eliminando = false, actualizando = false, errorConsulta = "", esWeb, guardando, setGuardando }: Omit<DrawerEditarPublicacionProps, "abierto"> & { publicacion: PublicacionParaEditar; esWeb: boolean; guardando: boolean; setGuardando: (valor: boolean) => void }) {
    const [editando, setEditando] = useState(modoInicial === "edicion");
    const [precio, setPrecio] = useState(() => {
        if (publicacion.precio === null) return "";
        const valor = Number(publicacion.precio);
        return Number.isInteger(valor) ? String(valor) : publicacion.precio;
    });
    const [foto, setFoto] = useState(publicacion.foto);
    const [fotoNueva, setFotoNueva] = useState<File | null>(null);
    const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
    const [especieId, setEspecieId] = useState(publicacion.especieId);
    const [variedadId, setVariedadId] = useState(publicacion.variedadId);
    const [categoriaId, setCategoriaId] = useState(publicacion.categoriaId);
    const [calibreId, setCalibreId] = useState(publicacion.calibreId);
    const [presentacionId, setPresentacionId] = useState(publicacion.presentacionId);
    const [paisId, setPaisId] = useState(publicacion.paisId);
    const [disponible, setDisponible] = useState(publicacion.disponible);
    const [error, setError] = useState("");
    const [confirmacionAbierta, setConfirmacionAbierta] = useState(false);
    const inputFotoRef = useRef<HTMLInputElement>(null);
    const urlVistaPreviaRef = useRef<string | null>(null);
    const idBase = `editar-publicacion-${publicacion.publicacionOperadorId}`;
    const ocupado = guardando || eliminando || actualizando;
    const bloqueado = ocupado || !editando;
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
        if (bloqueado) return;
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
        if (bloqueado) return;
        if (urlVistaPreviaRef.current) URL.revokeObjectURL(urlVistaPreviaRef.current);
        urlVistaPreviaRef.current = null;
        setVistaPrevia(null);
        setFotoNueva(null);
        setFoto(null);
    }

    function escribirPrecio(nuevoPrecio: string) {
        if (bloqueado) return;
        if (/^\d{0,10}$/.test(nuevoPrecio)) setPrecio(nuevoPrecio);
    }

    function cambiarPrecio(cantidad: number) {
        if (bloqueado) return;
        const precioActual = Number(precio || "0");
        if (!Number.isInteger(precioActual)) return;
        const nuevoPrecio = Math.min(9999999999, Math.max(0, precioActual + cantidad));
        setPrecio(String(nuevoPrecio));
    }

    function cambiarEspecie(nuevaEspecieId: number) {
        if (bloqueado) return;
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
        if (bloqueado) return;
        const primeraPresentacion = presentaciones.find((opcion) => opcion.variedadId === nuevaVariedadId);
        setVariedadId(nuevaVariedadId);
        setPresentacionId(primeraPresentacion?.id ?? 0);
    }

    function solicitarGuardado(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        if (bloqueado) return;
        setError("");

        const precioNormalizado = precio.trim();
        if (precioNormalizado !== "" && !formatoPrecio.test(precioNormalizado)) {
            setError("El precio debe ser un número entero de hasta 10 dígitos.");
            return;
        }

        const variedadValida = variedadesDisponibles.some((opcion) => opcion.id === variedadId);
        const presentacionValida = presentacionesDisponibles.some((opcion) => opcion.id === presentacionId);
        const categoriaValida = categoriasDisponibles.some((opcion) => opcion.id === categoriaId);
        const calibreValido = calibres.some((opcion) => opcion.id === calibreId);
        const paisValido = paises.some((opcion) => opcion.id === paisId);
        if (!especieSeleccionada || !variedadValida || !presentacionValida || !categoriaValida || !calibreValido || !paisValido) {
            setError("Elegí una especie, variedad, presentación, categoría, calibre y país válidos.");
            return;
        }

        setConfirmacionAbierta(true);
    }

    async function guardar() {
        if (bloqueado) return;
        setConfirmacionAbierta(false);

        const cambios: CambiosPublicacionOperador = {
            precio: precio.trim() || null,
            foto,
            categoriaId,
            calibreId,
            presentacionId,
            paisId,
            disponible,
        };

        setGuardando(true);
        try {
            await alGuardar(publicacion.publicacionOperadorId, cambios, fotoNueva);
            if (modoInicial === "consulta") {
                setFotoNueva(null);
                setEditando(false);
            } else {
                alCerrar();
            }
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
                <h2 className={styles.titulo} id={`${idBase}-titulo`}>{editando ? "Editar publicación" : "Consultar publicación"}</h2>
                <button className={styles.cerrar} type="button" onClick={alCerrar} disabled={ocupado} aria-label={editando ? "Cerrar edición" : "Cerrar consulta"}>
                    <CloseIcon fontSize="small" />
                </button>
            </div>

            <form className={styles.formulario} onSubmit={solicitarGuardado}>
                <div className={styles.cuerpo}>
                    <div className={styles.datosProducto} data-editando={editando}>
                        <div className={styles.campo}>
                            <TextField select label="Especie" id={`${idBase}-especie`} value={!editando || especies.some((opcion) => opcion.id === especieId) ? especieId : ""} onChange={(evento) => cambiarEspecie(Number(evento.target.value))} size="small" fullWidth required disabled={bloqueado} className={styles.selectMui}>
                                {!editando && !especies.some((opcion) => opcion.id === especieId) && <MenuItem value={especieId} className={styles.opcionSelect}>{publicacion.especie}</MenuItem>}
                                {especies.map((opcion) => <MenuItem key={opcion.id} value={opcion.id} className={styles.opcionSelect}>{opcion.nombre}</MenuItem>)}
                            </TextField>
                        </div>
                        <div className={styles.campo}>
                            <TextField select label="Variedad" id={`${idBase}-variedad`} value={!editando || variedadesDisponibles.some((opcion) => opcion.id === variedadId) ? variedadId : ""} onChange={(evento) => cambiarVariedad(Number(evento.target.value))} size="small" fullWidth required disabled={bloqueado} className={styles.selectMui}>
                                {!editando && !variedadesDisponibles.some((opcion) => opcion.id === variedadId) && <MenuItem value={variedadId} className={styles.opcionSelect}>{publicacion.variedad}</MenuItem>}
                                {variedadesDisponibles.length === 0 && <MenuItem value={0} disabled className={styles.opcionSelect}>Sin variedades disponibles</MenuItem>}
                                {variedadesDisponibles.map((opcion) => <MenuItem key={opcion.id} value={opcion.id} className={styles.opcionSelect}>{opcion.nombre}</MenuItem>)}
                            </TextField>
                        </div>
                        <div className={styles.campo}>
                            <TextField select label="Presentación" id={`${idBase}-presentacion`} value={!editando || presentacionesDisponibles.some((opcion) => opcion.id === presentacionId) ? presentacionId : ""} onChange={(evento) => { if (!bloqueado) setPresentacionId(Number(evento.target.value)); }} size="small" fullWidth required disabled={bloqueado} className={styles.selectMui}>
                                {!editando && !presentacionesDisponibles.some((opcion) => opcion.id === presentacionId) && <MenuItem value={presentacionId} className={styles.opcionSelect}>{publicacion.presentacion ?? "Sin presentación"}</MenuItem>}
                                {presentacionesDisponibles.length === 0 && <MenuItem value={0} disabled className={styles.opcionSelect}>Sin presentaciones disponibles</MenuItem>}
                                {presentacionesDisponibles.map((opcion) => <MenuItem key={opcion.id} value={opcion.id} className={styles.opcionSelect}>{opcion.nombre}</MenuItem>)}
                            </TextField>
                        </div>
                        <div className={styles.campo}>
                            <TextField select label="País" id={`${idBase}-pais`} value={paises.some((opcion) => opcion.id === paisId) ? paisId : ""} onChange={(evento) => { if (!bloqueado) setPaisId(Number(evento.target.value)); }} size="small" fullWidth required disabled={bloqueado} className={styles.selectMui}>
                                {paises.length === 0 && <MenuItem value={0} disabled className={styles.opcionSelect}>Sin países disponibles</MenuItem>}
                                {paises.map((opcion) => <MenuItem key={opcion.id} value={opcion.id} className={styles.opcionSelect}>{opcion.nombre}</MenuItem>)}
                            </TextField>
                        </div>
                        <div className={styles.campo}>
                            <TextField select label="Categoría" id={`${idBase}-categoria`} value={!editando || categoriasDisponibles.some((opcion) => opcion.id === categoriaId) ? categoriaId : ""} onChange={(evento) => { if (!bloqueado) setCategoriaId(Number(evento.target.value)); }} size="small" fullWidth required disabled={bloqueado} className={styles.selectMui}>
                                {!editando && !categoriasDisponibles.some((opcion) => opcion.id === categoriaId) && <MenuItem value={categoriaId} className={styles.opcionSelect}>{publicacion.categoria ?? "Sin categoría"}</MenuItem>}
                                {categoriasDisponibles.length === 0 && <MenuItem value={0} disabled className={styles.opcionSelect}>Sin categorías disponibles</MenuItem>}
                                {categoriasDisponibles.map((opcion) => <MenuItem key={opcion.id} value={opcion.id} className={styles.opcionSelect}>{opcion.nombre}</MenuItem>)}
                            </TextField>
                        </div>
                        <div className={styles.campo}>
                            <TextField select label="Calibre" id={`${idBase}-calibre`} value={!editando || calibres.some((opcion) => opcion.id === calibreId) ? calibreId : ""} onChange={(evento) => { if (!bloqueado) setCalibreId(Number(evento.target.value)); }} size="small" fullWidth required disabled={bloqueado} className={styles.selectMui}>
                                {!editando && !calibres.some((opcion) => opcion.id === calibreId) && <MenuItem value={calibreId} className={styles.opcionSelect}>{publicacion.calibre ?? "Sin calibre"}</MenuItem>}
                                {calibres.map((opcion) => <MenuItem key={opcion.id} value={opcion.id} className={styles.opcionSelect}>{opcion.nombre}</MenuItem>)}
                            </TextField>
                        </div>
                    </div>

                    {(error || errorConsulta) && <p className={styles.error} role="alert">{error || errorConsulta}</p>}

                    <div className={styles.campo}>
                        <label className={styles.etiqueta} htmlFor={`${idBase}-precio`}>Precio en pesos</label>
                        <div className={styles.controlesPrecio} data-editando={editando}>
                            {editando && <button className={styles.ajustarPrecio} type="button" onClick={() => cambiarPrecio(-10)} disabled={bloqueado} aria-label="Disminuir precio en 10">−</button>}
                            <input className={styles.entrada} id={`${idBase}-precio`} type="text" inputMode="numeric" maxLength={10} placeholder="Ingresar precio aquí" value={precio} onChange={(evento) => escribirPrecio(evento.target.value)} readOnly={!editando} disabled={ocupado} />
                            {editando && <button className={styles.ajustarPrecio} type="button" onClick={() => cambiarPrecio(10)} disabled={bloqueado} aria-label="Aumentar precio en 10">+</button>}
                        </div>
                        <small className={styles.ayuda}>Dejalo vacío si el producto no tiene precio.</small>
                    </div>

                    <label className={styles.disponibilidad} htmlFor={editando ? `${idBase}-disponibilidad` : undefined} data-disponible={disponible} data-guardando={ocupado} data-editando={editando}>
                        <span className={styles.textoDisponibilidad}>
                            <span className={styles.etiqueta}>Disponibilidad</span>
                            <span className={styles.estadoDisponibilidad}>{disponible ? "Disponible" : "No disponible"}</span>
                        </span>
                        {editando && <Switch className={styles.interruptorDisponibilidad} checked={disponible} onChange={(_, seleccionado) => { if (!bloqueado) setDisponible(seleccionado); }} disabled={bloqueado} slotProps={{ input: { id: `${idBase}-disponibilidad`, role: "switch", "aria-label": "Publicación disponible" } }} />}
                    </label>

                    <div className={styles.seccionFoto}>
                        <div className={styles.marcoFoto}>
                            {fotoVisible ? (
                                <Image className={styles.imagenFoto} src={fotoVisible} alt={`Foto de ${especieSeleccionada?.nombre ?? publicacion.especie} ${variedadSeleccionada?.nombre ?? publicacion.variedad}`} fill sizes="(min-width: 768px) 480px, 100vw" unoptimized />
                            ) : (
                                <div className={styles.sinFoto}><PhotoCameraOutlinedIcon aria-hidden="true" /><span>Sin foto</span></div>
                            )}
                            {editando && (
                                <>
                                    {fotoVisible && <button className={`${styles.botonFoto} ${styles.borrarFoto}`} type="button" onClick={borrarFoto} disabled={bloqueado}><DeleteOutlinedIcon fontSize="small" /> Borrar foto</button>}
                                    <button className={styles.botonFoto} type="button" onClick={() => inputFotoRef.current?.click()} disabled={bloqueado}>
                                        <PhotoCameraOutlinedIcon fontSize="small" /> Editar foto
                                    </button>
                                    <input ref={inputFotoRef} className={styles.inputFoto} type="file" accept="image/jpeg,image/png,image/webp" capture={esWeb ? undefined : "environment"} onChange={seleccionarFoto} disabled={bloqueado} aria-label="Seleccionar foto del producto" />
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className={styles.pie}>
                    {editando ? (
                        <>
                            <button className={styles.cancelar} type="button" onClick={alCerrar} disabled={ocupado}>Cancelar</button>
                            <button className={styles.guardar} type="submit" disabled={ocupado}>{guardando ? "Guardando..." : "Guardar"}</button>
                        </>
                    ) : (
                        <>
                            <button className={`${styles.cancelar} ${styles.eliminar}`} type="button" onClick={alEliminar} disabled={ocupado || !alEliminar}>{eliminando ? "Eliminando..." : "Eliminar"}</button>
                            <button className={styles.guardar} type="button" onClick={(evento) => { evento.preventDefault(); setError(""); setEditando(true); }} disabled={ocupado}>Editar</button>
                        </>
                    )}
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

export default function DrawerEditarPublicacion({ abierto, alCerrar, publicacion, alGuardar, especies, variedades, categorias, calibres, presentaciones, paises, modoInicial = "edicion", alEliminar, eliminando = false, actualizando = false, errorConsulta, children }: DrawerEditarPublicacionProps) {
    const esWeb = useMediaQuery("(min-width: 768px)");
    const [guardando, setGuardando] = useState(false);

    function cerrar() {
        if (!guardando && !eliminando && !actualizando) alCerrar();
    }

    return (
        <Drawer anchor={esWeb ? "right" : "bottom"} open={abierto && publicacion !== null} onClose={cerrar} slotProps={{ paper: { className: styles.panel, role: "dialog", "aria-modal": true, "aria-labelledby": publicacion ? `editar-publicacion-${publicacion.publicacionOperadorId}-titulo` : undefined } }}>
            {/* <HojasDecorativas variante="fondo" className={styles.hojasDrawer} /> */}
            {publicacion && (
                <FormularioEdicion key={`${publicacion.publicacionOperadorId}-${abierto}-${modoInicial}-${publicacion.precio}-${publicacion.foto}-${publicacion.presentacionId}-${publicacion.categoriaId}-${publicacion.calibreId}-${publicacion.paisId}-${publicacion.disponible}`} publicacion={publicacion} alCerrar={alCerrar} alGuardar={alGuardar} especies={especies} variedades={variedades} categorias={categorias} calibres={calibres} presentaciones={presentaciones} paises={paises} modoInicial={modoInicial} alEliminar={alEliminar} eliminando={eliminando} actualizando={actualizando} errorConsulta={errorConsulta} esWeb={esWeb} guardando={guardando} setGuardando={setGuardando} />
            )}
            {publicacion && children}
        </Drawer>
    );
}
