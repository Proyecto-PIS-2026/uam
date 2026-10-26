"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import NotificacionToast, { useNotificacionToast } from "@/compartido/componentes/NotificacionToast";
import DrawerDeslizable from "@/compartido/componentes/DrawerDeslizable";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import useMediaQuery from "@mui/material/useMediaQuery";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import { compararPaisesPorPrioridad } from "@/compartido/prioridad-paises";
import { compararEspeciesPorPrioridad } from "@/compartido/prioridad-especies";
import ImagenPublicacion from "../../componentes/ImagenPublicacion";
import type { CambiosPublicacionOperador, OpcionCategoria, OpcionEdicion, OpcionPresentacion, OpcionVariedad, PublicacionParaEditar } from "../tipos";
import { AYUDA_PRECIO_PUBLICACION, MAXIMO_DIGITOS_PRECIO, MAXIMO_PRECIO_PUBLICACION, PRECIO_PUBLICACION_INVALIDO, esEntradaPrecioPublicacion, normalizarPrecioPublicacion, precioPublicacionValido } from "../../precio-publicacion";
import styles from "./DrawerEditarPublicacion.module.css";

type DrawerEditarPublicacionProps = {
    abierto: boolean;
    incrementoPrecio?: number;
    alCerrar: () => void;
    modoInicial?: "consulta" | "edicion";
    puedeModificar?: boolean;
    puedeEliminar?: boolean;
    alEliminar?: () => void;
    alCompartir?: () => void;
    compartiendo?: boolean;
    eliminando?: boolean;
    actualizando?: boolean;
    errorConsulta?: string;
    children?: ReactNode;
    alGuardar?: (publicacionOperadorId: number, cambios: CambiosPublicacionOperador, fotoNueva: File | null) => void | Promise<void>;
    publicacion: PublicacionParaEditar | null;
    especies: OpcionEdicion[];
    variedades: OpcionVariedad[];
    categorias: OpcionCategoria[];
    calibres: OpcionEdicion[];
    presentaciones: OpcionPresentacion[];
    paises: OpcionEdicion[];
};

const formatoCantidad = /^(0|[1-9]\d{0,9})$/;
const propiedadesMenuSelect = { select: { MenuProps: { slotProps: { paper: { sx: { maxHeight: "min(20rem, 50dvh)", overflowY: "auto" } } } } } } as const;

function precioParaEdicion(precio: string | null) {
    if (precio === null) return "";
    const valor = Number(precio);
    return Number.isInteger(valor) ? String(valor) : precio;
}

function FormularioEdicion({ alCerrar, alGuardar, publicacion: recibida, especies, variedades, categorias, calibres, presentaciones, paises, incrementoPrecio = 10, modoInicial = "edicion", puedeModificar = true, puedeEliminar = true, alEliminar, alCompartir, compartiendo = false, eliminando = false, actualizando = false, errorConsulta = "", esWeb, guardando, setGuardando, alErrorGuardar, alIniciarGuardado }: Omit<DrawerEditarPublicacionProps, "abierto"> & { publicacion: PublicacionParaEditar; esWeb: boolean; guardando: boolean; setGuardando: (valor: boolean) => void; alErrorGuardar: (mensaje: string) => void; alIniciarGuardado: () => void }) {
    const [editando, setEditando] = useState(modoInicial === "edicion" && puedeModificar);
    const [baseEdicion, setBaseEdicion] = useState(recibida);
    const [guardada, setGuardada] = useState<{ origen: PublicacionParaEditar; datos: PublicacionParaEditar } | null>(null);
    const vigente = guardada?.origen === recibida ? guardada.datos : recibida;
    const publicacion = editando ? baseEdicion : vigente;
    const [precioEditado, setPrecio] = useState(() => precioParaEdicion(publicacion.precio));
    const [cantidadUnidadesEditado, setCantidadUnidades] = useState(() => publicacion.cantidadUnidades == null ? "" : String(publicacion.cantidadUnidades));
    const [fotoEditado, setFoto] = useState(publicacion.foto);
    const [fotoNueva, setFotoNueva] = useState<File | null>(null);
    const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
    const [especieIdEditado, setEspecieId] = useState(publicacion.especieId);
    const [variedadIdEditado, setVariedadId] = useState(publicacion.variedadId ?? 0);
    const [categoriaIdEditado, setCategoriaId] = useState(publicacion.categoriaId ?? 0);
    const [calibreIdEditado, setCalibreId] = useState(publicacion.calibreId ?? 0);
    const [presentacionIdEditado, setPresentacionId] = useState(publicacion.presentacionId ?? 0);
    const [paisIdEditado, setPaisId] = useState(publicacion.paisId ?? 0);
    const [disponibleEditado, setDisponible] = useState(publicacion.disponible);
    const precio = editando ? precioEditado : (precioParaEdicion(publicacion.precio));
    const cantidadUnidades = editando ? cantidadUnidadesEditado : (publicacion.cantidadUnidades == null ? "" : String(publicacion.cantidadUnidades));
    const foto = editando ? fotoEditado : (publicacion.foto);
    const especieId = editando ? especieIdEditado : (publicacion.especieId);
    const variedadId = editando ? variedadIdEditado : (publicacion.variedadId ?? 0);
    const categoriaId = editando ? categoriaIdEditado : (publicacion.categoriaId ?? 0);
    const calibreId = editando ? calibreIdEditado : (publicacion.calibreId ?? 0);
    const presentacionId = editando ? presentacionIdEditado : (publicacion.presentacionId ?? 0);
    const paisId = editando ? paisIdEditado : (publicacion.paisId ?? 0);
    const disponible = editando ? disponibleEditado : (publicacion.disponible);
    const [error, setError] = useState("");
    const inputFotoRef = useRef<HTMLInputElement>(null);
    const inputGaleriaRef = useRef<HTMLInputElement>(null);
    const urlVistaPreviaRef = useRef<string | null>(null);
    const idBase = `editar-publicacion-${publicacion.publicacionOperadorId}`;
    const ocupado = guardando || eliminando || actualizando;
    const bloqueado = ocupado || !editando;
    const fotoVisible = editando || guardada?.origen === recibida ? vistaPrevia ?? foto : publicacion.foto;
    const especieSeleccionada = especies.find((opcion) => opcion.id === especieId);
    const variedadSeleccionada = variedades.find((opcion) => opcion.id === variedadId);
    const variedadesDisponibles = variedades.filter((opcion) => opcion.especieId === especieId);
    const presentacionesDisponibles = presentaciones.filter((opcion) => opcion.variedadId === variedadId);
    const categoriasDisponibles = categorias.filter((opcion) => opcion.especieId === null || opcion.especieId === especieId);
    const paisesOrdenados = [...paises].sort((primero, segundo) => compararPaisesPorPrioridad(primero.nombre, segundo.nombre));
    const fechaFormateada = publicacion ? new Intl.DateTimeFormat("es-UY", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Montevideo" }).format(new Date(publicacion.fecha)) : "";
    useEffect(() => {
        return () => {
            if (urlVistaPreviaRef.current) URL.revokeObjectURL(urlVistaPreviaRef.current);
        };
    }, []);
    useEffect(() => {
        if (!editando && guardada?.origen !== recibida && urlVistaPreviaRef.current) {
            URL.revokeObjectURL(urlVistaPreviaRef.current);
            urlVistaPreviaRef.current = null;
        }
    }, [editando, guardada, recibida]);

    function seleccionarFoto(evento: ChangeEvent<HTMLInputElement>) {
        if (bloqueado) return;
        const archivo = evento.target.files?.[0];
        if (!archivo) return;

        if (!["image/jpeg", "image/png", "image/webp"].includes(archivo.type) || archivo.size === 0 || archivo.size > 10 * 1024 * 1024) {
            setError("Seleccioná una imagen JPEG, PNG o WebP de hasta 10 MB.");
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
        if (esEntradaPrecioPublicacion(nuevoPrecio)) setPrecio(nuevoPrecio);
    }

    function escribirCantidadUnidades(nuevaCantidad: string) {
        if (bloqueado) return;
        if (nuevaCantidad === "") {
            setCantidadUnidades("");
            return;
        }
        if (!/^\d+$/.test(nuevaCantidad)) return;
        const valorLimpio = String(Number(nuevaCantidad));
        if (Number(valorLimpio) > 2147483647) return;
        setCantidadUnidades(valorLimpio);
    }

    function cambiarPrecio(cantidad: number) {
        if (bloqueado) return;
        const precioActual = Number(precio || "0");
        if (!Number.isInteger(precioActual)) return;
        const nuevoPrecio = Math.min(MAXIMO_PRECIO_PUBLICACION, precioActual + cantidad);
        if (nuevoPrecio <= 0) return;
        setPrecio(String(nuevoPrecio));
    }

    function cambiarEspecie(nuevaEspecieId: number) {
        if (bloqueado) return;
        const categoriaActual = categorias.find((opcion) => opcion.id === categoriaId);
        const categoriaCompatible = categoriaActual?.especieId === null || categoriaActual?.especieId === nuevaEspecieId;
        setEspecieId(nuevaEspecieId);
        setVariedadId(0);
        setPresentacionId(0);
        if (!categoriaCompatible) setCategoriaId(0);
    }

    function cambiarVariedad(nuevaVariedadId: number) {
        if (bloqueado) return;
        setVariedadId(nuevaVariedadId);
        setPresentacionId(0);
    }

    function prepararEdicion() {
        if (urlVistaPreviaRef.current) URL.revokeObjectURL(urlVistaPreviaRef.current);
        urlVistaPreviaRef.current = null;
        if (inputFotoRef.current) inputFotoRef.current.value = "";
        if (inputGaleriaRef.current) inputGaleriaRef.current.value = "";
        setBaseEdicion(vigente);
        setVistaPrevia(null);
        setFotoNueva(null);
        setFoto(vigente.foto);
        setPrecio(precioParaEdicion(vigente.precio));
        setCantidadUnidades(vigente.cantidadUnidades == null ? "" : String(vigente.cantidadUnidades));
        setEspecieId(vigente.especieId);
        setVariedadId(vigente.variedadId ?? 0);
        setPresentacionId(vigente.presentacionId ?? 0);
        setCategoriaId(vigente.categoriaId ?? 0);
        setCalibreId(vigente.calibreId ?? 0);
        setPaisId(vigente.paisId ?? 0);
        setDisponible(vigente.disponible);
        setError("");
    }

    function cancelarEdicion() {
        if (modoInicial === "edicion") { alCerrar(); return; }
        prepararEdicion();
        setEditando(false);
    }

    function solicitarGuardado(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        if (bloqueado) return;
        setError("");
        if (!precioPublicacionValido(precio)) {
            setError(PRECIO_PUBLICACION_INVALIDO);
            return;
        }

        const cantidadNormalizada = typeof cantidadUnidades === "string" ? cantidadUnidades.trim() : String(cantidadUnidades ?? "").trim();
        if (cantidadNormalizada !== "" && !formatoCantidad.test(cantidadNormalizada)) {
            setError("La cantidad de unidades debe ser un número entero de hasta 10 dígitos.");
            return;
        }

        const variedadValida = variedadId === 0 || variedadesDisponibles.some((opcion) => opcion.id === variedadId);
        const presentacionValida = presentacionId === 0 || presentacionesDisponibles.some((opcion) => opcion.id === presentacionId);
        const categoriaValida = categoriaId === 0 || categoriasDisponibles.some((opcion) => opcion.id === categoriaId);
        const calibreValido = calibreId === 0 || calibres.some((opcion) => opcion.id === calibreId);
        const paisValido = paisId === 0 || paises.some((opcion) => opcion.id === paisId);
        if (!especieSeleccionada || !variedadValida || !presentacionValida || !categoriaValida || !calibreValido || !paisValido) {
            setError("Elegí una especie, variedad, presentación, categoría, calibre y país válidos.");
            return;
        }

        void guardar();
    }

    async function guardar() {
        if (bloqueado || !alGuardar) return;
        const precioNuevo = normalizarPrecioPublicacion(precio);
        const precioOriginal = precioParaEdicion(publicacion.precio).trim() || null;
        const cantidadUnidadesNormalizada = typeof cantidadUnidades === "string" ? cantidadUnidades.trim() : String(cantidadUnidades ?? "").trim();
        const cantidadFinal = (cantidadUnidadesNormalizada === "" ? null : Number(cantidadUnidadesNormalizada)) as number | null;
        const cantidadOriginal = publicacion.cantidadUnidades ?? null;

        const sinCambios =
            precioNuevo === precioOriginal &&
            cantidadFinal === cantidadOriginal &&
            foto === publicacion.foto &&
            fotoNueva === null &&
            especieId === publicacion.especieId &&
            variedadId === (publicacion.variedadId ?? 0) &&
            categoriaId === (publicacion.categoriaId ?? 0) &&
            calibreId === (publicacion.calibreId ?? 0) &&
            presentacionId === (publicacion.presentacionId ?? 0) &&
            paisId === (publicacion.paisId ?? 0) &&
            disponible === publicacion.disponible

        if(sinCambios) {
            if(modoInicial === "consulta") {
                setFotoNueva(null);
                setEditando(false);
            } else {
                alCerrar();
            }
            return;
        }

        const cambios: CambiosPublicacionOperador = {
            version: publicacion.version ?? 0,
            precio: precioNuevo,
            cantidadUnidades: cantidadFinal,
            foto: foto === publicacion.foto ? undefined : foto,
            especieId,
            variedadId: variedadId || null,
            categoriaId: categoriaId || null,
            calibreId: calibreId || null,
            presentacionId: presentacionId || null,
            paisId: paisId || null,
            disponible,
        };
        alIniciarGuardado();
        setGuardando(true);
        try {
            await alGuardar(publicacion.publicacionOperadorId, cambios, fotoNueva);
            setGuardada({ origen: recibida, datos: {
                ...publicacion, ...cambios, version: cambios.version + 1, foto,
                especie: especieSeleccionada?.nombre ?? publicacion.especie,
                variedad: variedadSeleccionada?.nombre ?? "",
                presentacion: presentaciones.find((opcion) => opcion.id === presentacionId)?.nombre ?? "",
                categoria: categorias.find((opcion) => opcion.id === categoriaId)?.nombre ?? "",
                calibre: calibres.find((opcion) => opcion.id === calibreId)?.nombre ?? "",
            } });
            if (modoInicial === "consulta") {
                setFotoNueva(null);
                setEditando(false);
            } else {
                alCerrar();
            }
        } catch (error) {
            alErrorGuardar(error instanceof Error ? error.message : "No se pudieron guardar los cambios. Intentá de nuevo.");
        } finally {
            setGuardando(false);
        }
    }
    const presentacionActual = presentacionId ? presentaciones.find(p => p.id === presentacionId)?.nombre || publicacion.presentacion : null;
    const campoPrecio = (
        <div key="precio" className={styles.campo}>
            <label className={styles.etiqueta} htmlFor={`${idBase}-precio`}>Precio en pesos</label>
            <div className={styles.controlesPrecio} data-editando={editando}>
                {editando && <button className={styles.ajustarPrecio} type="button" onClick={() => cambiarPrecio(-incrementoPrecio)} disabled={bloqueado} aria-label={`Disminuir precio en ${incrementoPrecio}`}><RemoveIcon aria-hidden="true" fontSize="inherit" /></button>}
                <input className={styles.entrada} id={`${idBase}-precio`} type="text" inputMode="numeric" maxLength={MAXIMO_DIGITOS_PRECIO} placeholder={editando ? "Ingresar precio aquí" : "Consultar precio"} value={precio} onChange={(evento) => escribirPrecio(evento.target.value)} readOnly={!editando} disabled={ocupado} />
                {editando && <button className={styles.ajustarPrecio} type="button" onClick={() => cambiarPrecio(incrementoPrecio)} disabled={bloqueado} aria-label={`Aumentar precio en ${incrementoPrecio}`}><AddIcon aria-hidden="true" fontSize="inherit" /></button>}
            </div>
            {editando && <small className={styles.ayuda}>{AYUDA_PRECIO_PUBLICACION}</small>}
        </div>
    );
    const seccionFoto = (
        <div key="foto" className={styles.seccionFoto}>
            <div className={styles.marcoFoto}>
                <ImagenPublicacion className={styles.imagenFoto} src={fotoVisible} alt={`Foto de ${especieSeleccionada?.nombre ?? publicacion.especie} ${variedadSeleccionada?.nombre ?? publicacion.variedad}`} fill sizes="(min-width: 768px) 480px, 100vw" unoptimized reemplazo={<div className={styles.sinFoto}><PhotoCameraOutlinedIcon aria-hidden="true" /><span>Sin foto</span></div>} />
                {editando && (
                    <>
                        {fotoVisible && <button className={`${styles.botonFoto} ${styles.borrarFoto}`} type="button" onClick={borrarFoto} disabled={bloqueado}><DeleteOutlinedIcon fontSize="small" /> Borrar foto</button>}
                        <button className={styles.botonFoto} type="button" onClick={() => inputFotoRef.current?.click()} disabled={bloqueado}>
                            <PhotoCameraOutlinedIcon fontSize="small" /> {esWeb ? "Editar foto" : "Cámara"}
                        </button>
                        {!esWeb && <button className={`${styles.botonFoto} ${styles.botonGaleria}`} type="button" onClick={() => inputGaleriaRef.current?.click()} disabled={bloqueado}>Galería</button>}
                        <input ref={inputFotoRef} className={styles.inputFoto} type="file" accept="image/jpeg,image/png,image/webp" capture={esWeb ? undefined : "environment"} onChange={seleccionarFoto} disabled={bloqueado} aria-label="Seleccionar foto del producto" />
                        {!esWeb && <input ref={inputGaleriaRef} className={styles.inputFoto} type="file" accept="image/jpeg,image/png,image/webp" onChange={seleccionarFoto} disabled={bloqueado} aria-label="Seleccionar foto desde galería" />}
                    </>
                )}
            </div>
        </div>
    );
    const accionesPublicacion = (
        <div key="acciones" className={styles.accionesPublicacion} data-editando={editando}>
            <label className={styles.disponibilidad} htmlFor={editando ? `${idBase}-disponibilidad` : undefined} data-disponible={disponible} data-guardando={ocupado} data-editando={editando}>
                <span className={styles.textoDisponibilidad}>
                    {editando && <span className={styles.etiqueta}>Disponibilidad</span>}
                    <span className={`${styles.estadoDisponibilidad} ${!editando ? styles.estadoDisponibilidadConsulta : ""}`}>{disponible ? "Disponible" : "No disponible"}</span>
                </span>
                {editando && <Switch className={styles.interruptorDisponibilidad} checked={disponible} onChange={(_, seleccionado) => { if (!bloqueado) setDisponible(seleccionado); }} disabled={bloqueado} slotProps={{ input: { id: `${idBase}-disponibilidad`, role: "switch", "aria-label": "Publicación disponible" } }} />}
            </label>
            {!editando && alCompartir && (
                <button type="button" className={`boton-primario ${styles.compartirConsulta}`} onClick={alCompartir} disabled={ocupado || compartiendo} aria-busy={compartiendo} aria-label="Compartir en WhatsApp">
                    <WhatsAppIcon fontSize="small" aria-hidden="true" />
                    {compartiendo ? "Preparando…" : "Compartir"}
                </button>
            )}
        </div>
    );
    const datosProducto = (
        <div key="datos" className={styles.datosProducto} data-editando={editando}>
            <div className={styles.campo}>
                <TextField select label="Especie" id={`${idBase}-especie`} value={!editando || especies.some((opcion) => opcion.id === especieId) ? especieId : ""} onChange={(evento) => cambiarEspecie(Number(evento.target.value))} size="small" fullWidth required disabled={bloqueado} className={styles.selectMui} slotProps={propiedadesMenuSelect}>
                    {!editando && !especies.some((opcion) => opcion.id === especieId) && <MenuItem value={especieId} className={styles.opcionSelect}>{publicacion.especie}</MenuItem>}
                    {[...especies].sort((primera, segunda) => compararEspeciesPorPrioridad(primera.nombre, segunda.nombre)).map((opcion) => <MenuItem key={opcion.id} value={opcion.id} className={styles.opcionSelect}>{opcion.nombre}</MenuItem>)}
                </TextField>
            </div>
            <div className={styles.campo}>
                <TextField select label="Variedad" id={`${idBase}-variedad`} value={variedadId} onChange={(evento) => cambiarVariedad(Number(evento.target.value))} size="small" fullWidth disabled={bloqueado} className={styles.selectMui} slotProps={propiedadesMenuSelect}>
                    <MenuItem value={0} className={styles.opcionSelect}>{editando ? "Sin especificar" : "-"}</MenuItem>
                    {!editando && variedadId !== 0 && !variedadesDisponibles.some((opcion) => opcion.id === variedadId) && <MenuItem value={variedadId} className={styles.opcionSelect}>{publicacion.variedad?.trim() || "-"}</MenuItem>}
                    {variedadesDisponibles.map((opcion) => <MenuItem key={opcion.id} value={opcion.id} className={styles.opcionSelect}>{opcion.nombre}</MenuItem>)}
                </TextField>
            </div>
            <div className={styles.campo}>
                <TextField select label="Presentación" id={`${idBase}-presentacion`} value={presentacionId} onChange={(evento) => { if (!bloqueado) setPresentacionId(Number(evento.target.value)); }} size="small" fullWidth disabled={bloqueado} className={styles.selectMui} slotProps={propiedadesMenuSelect}>
                    <MenuItem value={0} className={styles.opcionSelect}>{editando ? "Sin especificar" : "-"}</MenuItem>
                    {!editando && presentacionId !== 0 && !presentacionesDisponibles.some((opcion) => opcion.id === presentacionId) && <MenuItem value={presentacionId} className={styles.opcionSelect}>{publicacion.presentacion?.trim() || "-"}</MenuItem>}
                    {presentacionesDisponibles.map((opcion) => <MenuItem key={opcion.id} value={opcion.id} className={styles.opcionSelect}>{opcion.nombre}</MenuItem>)}
                </TextField>
            </div>
            <div className={styles.campo}>
                <TextField select label="País" id={`${idBase}-pais`} value={paisId} onChange={(evento) => { if (!bloqueado) setPaisId(Number(evento.target.value)); }} size="small" fullWidth disabled={bloqueado} className={styles.selectMui} slotProps={propiedadesMenuSelect}>
                    <MenuItem value={0} className={styles.opcionSelect}>{editando ? "Sin especificar" : "-"}</MenuItem>
                    {!editando && paisId !== 0 && !paises.some((opcion) => opcion.id === paisId) && <MenuItem value={paisId} className={styles.opcionSelect}>-</MenuItem>}
                    {paisesOrdenados.map((opcion) => <MenuItem key={opcion.id} value={opcion.id} className={styles.opcionSelect}>{opcion.nombre}</MenuItem>)}
                </TextField>
            </div>
            <div className={styles.campo}>
                <TextField select label="Categoría" id={`${idBase}-categoria`} value={categoriaId} onChange={(evento) => { if (!bloqueado) setCategoriaId(Number(evento.target.value)); }} size="small" fullWidth disabled={bloqueado} className={styles.selectMui} slotProps={propiedadesMenuSelect}>
                    <MenuItem value={0} className={styles.opcionSelect}>{editando ? "Sin especificar" : "-"}</MenuItem>
                    {!editando && categoriaId !== 0 && !categoriasDisponibles.some((opcion) => opcion.id === categoriaId) && <MenuItem value={categoriaId} className={styles.opcionSelect}>{publicacion.categoria?.trim() || "-"}</MenuItem>}
                    {categoriasDisponibles.map((opcion) => <MenuItem key={opcion.id} value={opcion.id} className={styles.opcionSelect}>{opcion.nombre}</MenuItem>)}
                </TextField>
            </div>
            <div className={styles.campo}>
                <TextField select label="Calibre" id={`${idBase}-calibre`} value={calibreId} onChange={(evento) => { if (!bloqueado) setCalibreId(Number(evento.target.value)); }} size="small" fullWidth disabled={bloqueado} className={styles.selectMui} slotProps={propiedadesMenuSelect}>
                    <MenuItem value={0} className={styles.opcionSelect}>{editando ? "Sin especificar" : "-"}</MenuItem>
                    {!editando && calibreId !== 0 && !calibres.some((opcion) => opcion.id === calibreId) && <MenuItem value={calibreId} className={styles.opcionSelect}>{publicacion.calibre?.trim() || "-"}</MenuItem>}
                    {calibres.map((opcion) => <MenuItem key={opcion.id} value={opcion.id} className={styles.opcionSelect}>{opcion.nombre}</MenuItem>)}
                </TextField>
            </div>
        </div>
    );
    const campoUnidades = (
        <div key="unidades" className={styles.campo}>
            <label className={styles.etiqueta} htmlFor={`${idBase}-cantidadUnidades`}>
                Unidades{presentacionActual ? ` (${presentacionActual})` : ""}
            </label>
            <div className={styles.controlesPrecio} data-editando={false}>
                <input className={`${styles.entrada} w-full grow shrink-0`} id={`${idBase}-cantidadUnidades`} type="text" inputMode="numeric" maxLength={10} placeholder={editando ? "Ingresar cantidad aquí" : "-"} value={cantidadUnidades} onChange={(evento) => escribirCantidadUnidades(evento.target.value)} readOnly={!editando} disabled={ocupado} />
            </div>
            {editando && <small className={styles.ayuda}>Dejalo vacío si no quieres ingresar una cantidad.</small>}
        </div>
    );
    const errorFormulario = (error || errorConsulta) ? <p key="error" className={styles.error} role="alert">{error || errorConsulta}</p> : null;
    return (
        <>
            <div className={`${styles.encabezado} ${styles.encabezadoConAsa}`}>
                <div className={styles.bloqueSuperior}>
                    <div className={styles.titulo} id={`${idBase}-titulo`}>{editando ? "Editar publicación" : "Consulta de publicación"}</div>
                    <div className={styles.informacionDetallada}>
                        <span className={styles.nombreInformacion}>Actualización</span>
                        <time dateTime={publicacion.fecha} className={styles.valorInformacion}>{fechaFormateada}</time>
                    </div>
                </div>
                <button className={styles.cerrar} type="button" onClick={alCerrar} disabled={ocupado} aria-label={editando ? "Cerrar edición" : "Cerrar consulta"}>
                    <CloseIcon fontSize="small" />
                </button>
            </div>
            <form className={styles.formulario} onSubmit={solicitarGuardado}>
                <div className={styles.cuerpo}>
                    {[campoPrecio, campoUnidades, seccionFoto, accionesPublicacion, datosProducto, errorFormulario]}
                </div>
                <div className={styles.pie}>
                    {editando ? (
                        <>
                            <button className={styles.cancelar} type="button" onClick={cancelarEdicion} disabled={ocupado}>Cancelar</button>
                            <button className={styles.guardar} type="submit" disabled={ocupado}>{guardando ? "Guardando..." : "Guardar"}</button>
                        </>
                    ) : (
                        <>
                            <button className={`${styles.cancelar} ${styles.eliminar}`} type="button" onClick={alEliminar} disabled={ocupado || !puedeEliminar || !alEliminar}>{eliminando ? "Eliminando..." : "Eliminar"}</button>
                            <button className={styles.guardar} type="button" onClick={(evento) => { evento.preventDefault(); prepararEdicion(); setEditando(true); }} disabled={ocupado || !puedeModificar || !alGuardar}>Editar</button>
                        </>
                    )}
                </div>
            </form>
        </>
    );
}

export default function DrawerEditarPublicacion({ abierto, alCerrar, publicacion, alGuardar, especies, variedades, categorias, calibres, presentaciones, paises, incrementoPrecio = 10, modoInicial = "edicion", puedeModificar = true, puedeEliminar = true, alEliminar, alCompartir, compartiendo = false, eliminando = false, actualizando = false, errorConsulta, children }: DrawerEditarPublicacionProps) {
    const { notificacion, notificar, cerrarNotificacion } = useNotificacionToast();
    const esWeb = useMediaQuery("(min-width: 768px)");
    const [guardando, setGuardando] = useState(false);
    function cerrar() {
        if (!guardando && !eliminando && !actualizando) alCerrar();
    }
    return (
        <>
        <DrawerDeslizable anchor={esWeb ? "right" : "bottom"} open={abierto && publicacion !== null} onClose={cerrar} arrastreDeshabilitado={guardando || eliminando || actualizando} slotProps={{ paper: { className: styles.panel, role: "dialog", "aria-modal": true, "aria-labelledby": publicacion ? `editar-publicacion-${publicacion.publicacionOperadorId}-titulo` : undefined } }}>
            {publicacion && (
                <FormularioEdicion key={`${publicacion.publicacionOperadorId}-${abierto}-${modoInicial}`} publicacion={publicacion} alCerrar={alCerrar} alGuardar={alGuardar} especies={especies} variedades={variedades} categorias={categorias} calibres={calibres} presentaciones={presentaciones} paises={paises} incrementoPrecio={incrementoPrecio} modoInicial={modoInicial} puedeModificar={puedeModificar} puedeEliminar={puedeEliminar} alEliminar={alEliminar} alCompartir={alCompartir} compartiendo={compartiendo} eliminando={eliminando} actualizando={actualizando} errorConsulta={errorConsulta} esWeb={esWeb} guardando={guardando} setGuardando={setGuardando} alErrorGuardar={(mensaje) => notificar(mensaje, "error")} alIniciarGuardado={cerrarNotificacion} />
            )}
            {publicacion && children}
        </DrawerDeslizable>
        <NotificacionToast notificacion={notificacion} alCerrar={cerrarNotificacion} />
        </>
    );
}
