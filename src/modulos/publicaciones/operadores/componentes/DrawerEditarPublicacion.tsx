"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Drawer from "@mui/material/Drawer";
import MenuItem from "@mui/material/MenuItem";
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

function FormularioEdicion({ alCerrar, alGuardar, publicacion, especies, variedades, categorias, calibres, presentaciones, esWeb }: Omit<DrawerEditarPublicacionProps, "abierto"> & { publicacion: PublicacionParaEditar; esWeb: boolean }) {
    const [precio, setPrecio] = useState(publicacion.precio ?? "");
    const [fotoNueva, setFotoNueva] = useState<File | null>(null);
    const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
    const [especieId, setEspecieId] = useState(publicacion.especieId);
    const [variedadId, setVariedadId] = useState(publicacion.variedadId);
    const [categoriaId, setCategoriaId] = useState(publicacion.categoriaId);
    const [calibreId, setCalibreId] = useState(publicacion.calibreId);
    const [presentacionId, setPresentacionId] = useState(publicacion.presentacionId);
    const [error, setError] = useState("");
    const [guardando, setGuardando] = useState(false);
    const inputFotoRef = useRef<HTMLInputElement>(null);
    const urlVistaPreviaRef = useRef<string | null>(null);
    const idBase = `editar-publicacion-${publicacion.publicacionOperadorId}`;
    const fotoVisible = vistaPrevia ?? publicacion.foto;
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

        if (!archivo.type.startsWith("image/")) {
            setError("Seleccioná un archivo de imagen.");
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

    function cambiarEspecie(nuevaEspecieId: number) {
        const primeraVariedad = variedades.find((opcion) => opcion.especieId === nuevaEspecieId);
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

    async function guardar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        setError("");

        const precioNormalizado = precio.trim();
        if (precioNormalizado !== "" && !formatoPrecio.test(precioNormalizado)) {
            setError("El precio debe tener hasta 10 dígitos enteros y 2 decimales.");
            return;
        }

        const variedadValida = variedadesDisponibles.some((opcion) => opcion.id === variedadId);
        const presentacionValida = presentacionesDisponibles.some((opcion) => opcion.id === presentacionId);
        const categoriaValida = categoriasDisponibles.some((opcion) => opcion.id === categoriaId);
        if (!especieSeleccionada || !variedadValida || !presentacionValida || !categoriaValida) {
            setError("Elegí una especie, variedad, presentación y categoría válidas.");
            return;
        }

        const cambios: CambiosPublicacionOperador = {
            precio: precioNormalizado || null,
            foto: publicacion.foto,
            categoriaId,
            calibreId,
            presentacionId,
        };

        setGuardando(true);
        try {
            await alGuardar(publicacion.publicacionOperadorId, cambios, fotoNueva);
            alCerrar();
        } catch {
            setError("No se pudieron guardar los cambios. Intentá de nuevo.");
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
                <button className={styles.cerrar} type="button" onClick={alCerrar} aria-label="Cerrar edición">
                    <CloseIcon fontSize="small" />
                </button>
            </div>

            <form className={styles.formulario} onSubmit={guardar}>
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
                            <input ref={inputFotoRef} className={styles.inputFoto} type="file" accept="image/*" capture={esWeb ? undefined : "environment"} onChange={seleccionarFoto} aria-label="Seleccionar foto del producto" />
                        </div>
                    </div>

                    <div className={styles.campo}>
                        <label className={styles.etiqueta} htmlFor={`${idBase}-precio`}>Precio en pesos</label>
                        <input className={styles.entrada} id={`${idBase}-precio`} type="text" inputMode="decimal" placeholder="Ej. 185.00" value={precio} onChange={(evento) => setPrecio(evento.target.value)} />
                        <small className={styles.ayuda}>Dejalo vacío si el producto no tiene precio.</small>
                    </div>

                    <div className={styles.campo}>
                        <TextField select label="Especie" id={`${idBase}-especie`} value={especieId} onChange={(evento) => cambiarEspecie(Number(evento.target.value))} size="small" fullWidth required className={styles.selectMui}>
                            {especies.map((opcion) => <MenuItem key={opcion.id} value={opcion.id} className={styles.opcionSelect}>{opcion.nombre}</MenuItem>)}
                        </TextField>
                    </div>

                    <div className={styles.campo}>
                        <TextField select label="Variedad" id={`${idBase}-variedad`} value={variedadId} onChange={(evento) => cambiarVariedad(Number(evento.target.value))} size="small" fullWidth required className={styles.selectMui}>
                            {variedadesDisponibles.length === 0 && <MenuItem value={0} disabled className={styles.opcionSelect}>Sin variedades disponibles</MenuItem>}
                            {variedadesDisponibles.map((opcion) => <MenuItem key={opcion.id} value={opcion.id} className={styles.opcionSelect}>{opcion.nombre}</MenuItem>)}
                        </TextField>
                    </div>

                    <div className={styles.campo}>
                        <TextField select label="Presentación" id={`${idBase}-presentacion`} value={presentacionId} onChange={(evento) => setPresentacionId(Number(evento.target.value))} size="small" fullWidth required className={styles.selectMui}>
                            {presentacionesDisponibles.length === 0 && <MenuItem value={0} disabled className={styles.opcionSelect}>Sin presentaciones disponibles</MenuItem>}
                            {presentacionesDisponibles.map((opcion) => <MenuItem key={opcion.id} value={opcion.id} className={styles.opcionSelect}>{opcion.nombre}</MenuItem>)}
                        </TextField>
                    </div>

                    <div className={styles.rejilla}>
                        <div className={styles.campo}>
                            <TextField select label="Categoría" id={`${idBase}-categoria`} value={categoriaId} onChange={(evento) => setCategoriaId(Number(evento.target.value))} size="small" fullWidth required className={styles.selectMui}>
                                {categoriasDisponibles.length === 0 && <MenuItem value={0} disabled className={styles.opcionSelect}>Sin categorías disponibles</MenuItem>}
                                {categoriasDisponibles.map((opcion) => <MenuItem key={opcion.id} value={opcion.id} className={styles.opcionSelect}>{opcion.nombre}</MenuItem>)}
                            </TextField>
                        </div>
                        <div className={styles.campo}>
                            <TextField select label="Calibre" id={`${idBase}-calibre`} value={calibreId} onChange={(evento) => setCalibreId(Number(evento.target.value))} size="small" fullWidth required className={styles.selectMui}>
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
        </>
    );
}

export default function DrawerEditarPublicacion({ abierto, alCerrar, publicacion, alGuardar, especies, variedades, categorias, calibres, presentaciones }: DrawerEditarPublicacionProps) {
    const esWeb = useMediaQuery("(min-width: 768px)");

    return (
        <Drawer anchor={esWeb ? "right" : "bottom"} open={abierto} onClose={alCerrar} slotProps={{ paper: { className: styles.panel } }}>
            {publicacion && (
                <FormularioEdicion key={`${publicacion.publicacionOperadorId}-${abierto}`} publicacion={publicacion} alCerrar={alCerrar} alGuardar={alGuardar} especies={especies} variedades={variedades} categorias={categorias} calibres={calibres} presentaciones={presentaciones} esWeb={esWeb} />
            )}
        </Drawer>
    );
}
