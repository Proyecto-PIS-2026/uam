"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { useNotificacionToast } from "@/compartido/componentes/NotificacionToast";
import AvisoErrorToast from "@/compartido/componentes/AvisoErrorToast";
import DrawerDeslizable from "@/compartido/componentes/DrawerDeslizable";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import OutlinedInput from "@mui/material/OutlinedInput";
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
import { AvisoVigenciaFoto } from "../../componentes/AvisoVigenciaFoto";
import type { CambiosPublicacionOperador, OpcionCategoria, OpcionEdicion, OpcionVariedad, PublicacionParaEditar } from "../tipos";
import { AYUDA_PRECIO_PUBLICACION, MAXIMO_DIGITOS_PRECIO, MAXIMO_PRECIO_PUBLICACION, PRECIO_PUBLICACION_INVALIDO, esEntradaPrecioPublicacion, normalizarPrecioPublicacion, precioPublicacionValido } from "../../precio-publicacion";
import styles from "./DrawerEditarPublicacion.module.css";
import CampoComentario from "../../componentes/CampoComentario";

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
    mostrarAvisoFoto?: boolean;
    children?: ReactNode;
    alGuardar?: (publicacionOperadorId: number, cambios: CambiosPublicacionOperador, fotoNueva: File | null) => void | Promise<void>;
    publicacion: PublicacionParaEditar | null;
    especies: OpcionEdicion[];
    variedades: OpcionVariedad[];
    categorias: OpcionCategoria[];
    calibres: OpcionEdicion[];
    envases: OpcionEdicion[];
    kilos: OpcionEdicion[];
    paises: OpcionEdicion[];
};

const formatoCantidad = /^(0|[1-9]\d{0,9})$/;
const propiedadesMenuSelect = { select: { MenuProps: { slotProps: { paper: { sx: { maxHeight: "min(20rem, 50dvh)", overflowY: "auto" } } } } } } as const;

function precioParaEdicion(precio: string | null) {
    if (precio === null) return "";
    const valor = Number(precio);
    return Number.isInteger(valor) ? String(valor) : precio;
}

function FormularioEdicion({ alCerrar, alGuardar, publicacion: recibida, especies, variedades, categorias, calibres, envases, kilos, paises, incrementoPrecio = 10, modoInicial = "edicion", puedeModificar = true, puedeEliminar = true, alEliminar, alCompartir, compartiendo = false, eliminando = false, actualizando = false, mostrarAvisoFoto = false, esWeb, guardando, setGuardando }: Omit<DrawerEditarPublicacionProps, "abierto"> & { publicacion: PublicacionParaEditar; esWeb: boolean; guardando: boolean; setGuardando: (valor: boolean) => void }) {
    const { notificar, cerrarNotificacion } = useNotificacionToast();
    const [editando, setEditando] = useState(modoInicial === "edicion" && puedeModificar);
    const [baseEdicion, setBaseEdicion] = useState(recibida);
    const [guardada, setGuardada] = useState<{ origen: PublicacionParaEditar; datos: PublicacionParaEditar } | null>(null);
    const vigente = guardada?.origen === recibida ? guardada.datos : recibida;
    const publicacion = editando ? baseEdicion : vigente;
    const [precioEditado, setPrecio] = useState(() => precioParaEdicion(publicacion.precio));
    const [cantidadUnidadesEditado, setCantidadUnidades] = useState(() => publicacion.cantidadUnidades == null ? "" : String(publicacion.cantidadUnidades));
    const [comentarioEditado, setComentario] = useState(() => publicacion.comentario ?? "");
    const [fotoEditado, setFoto] = useState(publicacion.foto);
    const [fotoNueva, setFotoNueva] = useState<File | null>(null);
    const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
    const [especieIdEditado, setEspecieId] = useState(publicacion.especieId);
    const [variedadIdEditado, setVariedadId] = useState(publicacion.variedadId ?? 0);
    const [categoriaIdEditado, setCategoriaId] = useState(publicacion.categoriaId ?? 0);
    const [calibreIdEditado, setCalibreId] = useState(publicacion.calibreId ?? 0);
    const [envaseIdEditado, setEnvaseId] = useState(publicacion.envaseId ?? 0);
    const [kilosIdEditado, setKilosId] = useState(publicacion.kilosId ?? 0);
    const [paisIdEditado, setPaisId] = useState(publicacion.paisId ?? 0);
    const [disponibleEditado, setDisponible] = useState(publicacion.disponible);
    const precio = editando ? precioEditado : (precioParaEdicion(publicacion.precio));
    const cantidadUnidades = editando ? cantidadUnidadesEditado : (publicacion.cantidadUnidades == null ? "" : String(publicacion.cantidadUnidades));
    const comentario = editando ? comentarioEditado : (publicacion.comentario ?? "");
    const foto = editando ? fotoEditado : (publicacion.foto);
    const especieId = editando ? especieIdEditado : (publicacion.especieId);
    const variedadId = editando ? variedadIdEditado : (publicacion.variedadId ?? 0);
    const categoriaId = editando ? categoriaIdEditado : (publicacion.categoriaId ?? 0);
    const calibreId = editando ? calibreIdEditado : (publicacion.calibreId ?? 0);
    const envaseId = editando ? envaseIdEditado : (publicacion.envaseId ?? 0);
    const kilosId = editando ? kilosIdEditado : (publicacion.kilosId ?? 0);
    const paisId = editando ? paisIdEditado : (publicacion.paisId ?? 0);
    const disponible = editando ? disponibleEditado : (publicacion.disponible);
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
    const envasesDisponibles = envases;
    const categoriasDisponibles = categorias;
    const paisesOrdenados = [...paises].sort((primero, segundo) => compararPaisesPorPrioridad(primero.nombre, segundo.nombre));
    const fechaFormateada = publicacion ? new Intl.DateTimeFormat("es-UY", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Montevideo" }).format(new Date(publicacion.fecha)) : "";
    const [fechaVigenciaEditada, setFechaVigencia] = useState(publicacion.fechaVigencia ?? "");
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
            notificar("Seleccioná una imagen JPEG, PNG o WebP de hasta 10 MB.", "error");
            evento.target.value = "";
            return;
        }

        if (urlVistaPreviaRef.current) URL.revokeObjectURL(urlVistaPreviaRef.current);
        const url = URL.createObjectURL(archivo);
        urlVistaPreviaRef.current = url;
        setVistaPrevia(url);
        setFotoNueva(archivo);
        cerrarNotificacion();
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
        setPrecio(nuevoPrecio <= 0 ? "" : String(nuevoPrecio));
    }

    function cambiarEspecie(nuevaEspecieId: number) {
        if (bloqueado) return;
        setEspecieId(nuevaEspecieId);
        setVariedadId(0);
    }

    function cambiarVariedad(nuevaVariedadId: number) {
        if (bloqueado) return;
        setVariedadId(nuevaVariedadId);
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
        setComentario(vigente.comentario ?? "");
        setEspecieId(vigente.especieId);
        setVariedadId(vigente.variedadId ?? 0);
        setEnvaseId(vigente.envaseId ?? 0);
        setKilosId(vigente.kilosId ?? 0);
        setCategoriaId(vigente.categoriaId ?? 0);
        setCalibreId(vigente.calibreId ?? 0);
        setPaisId(vigente.paisId ?? 0);
        setDisponible(vigente.disponible);
        cerrarNotificacion();
        setFechaVigencia(vigente.fechaVigencia ?? "");
    }

    function cancelarEdicion() {
        if (modoInicial === "edicion") { alCerrar(); return; }
        prepararEdicion();
        setEditando(false);
    }

    function solicitarGuardado(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        if (bloqueado) return;
        cerrarNotificacion();
        if (!precioPublicacionValido(precio)) {
            notificar(PRECIO_PUBLICACION_INVALIDO, "error");
            return;
        }

        const cantidadNormalizada = typeof cantidadUnidades === "string" ? cantidadUnidades.trim() : String(cantidadUnidades ?? "").trim();
        if (cantidadNormalizada !== "" && !formatoCantidad.test(cantidadNormalizada)) {
            notificar("La cantidad de unidades debe ser un número entero de hasta 10 dígitos.", "error");
            return;
        }

        const variedadValida = variedadId === 0 || variedadesDisponibles.some((opcion) => opcion.id === variedadId);
        const envaseValido = envaseId === 0 || envasesDisponibles.some((opcion) => opcion.id === envaseId);
        const kilosValidos = kilosId === 0 || kilos.some((opcion) => opcion.id === kilosId);
        const categoriaValida = categoriaId === 0 || categoriasDisponibles.some((opcion) => opcion.id === categoriaId);
        const calibreValido = calibreId === 0 || calibres.some((opcion) => opcion.id === calibreId);
        const paisValido = paisId === 0 || paises.some((opcion) => opcion.id === paisId);
        if (!especieSeleccionada || !variedadValida || !envaseValido || !kilosValidos || !categoriaValida || !calibreValido || !paisValido) {
            notificar("Elegí una especie, variedad, empaquetado, kilos, categoría, calibre y país válidos.", "error");
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
        const comentarioFinal = comentario.trim() || null;
        const comentarioOriginal = publicacion.comentario ?? null;

        const sinCambios =
            precioNuevo === precioOriginal &&
            cantidadFinal === cantidadOriginal &&
            comentarioFinal === comentarioOriginal &&
            foto === publicacion.foto &&
            fotoNueva === null &&
            especieId === publicacion.especieId &&
            variedadId === (publicacion.variedadId ?? 0) &&
            categoriaId === (publicacion.categoriaId ?? 0) &&
            calibreId === (publicacion.calibreId ?? 0) &&
            envaseId === (publicacion.envaseId ?? 0) &&
            kilosId === (publicacion.kilosId ?? 0) &&
            paisId === (publicacion.paisId ?? 0) &&
            disponible === publicacion.disponible &&
            fechaVigenciaEditada === (publicacion.fechaVigencia ?? "");

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
            comentario: comentarioFinal,
            foto: foto === publicacion.foto ? undefined : foto,
            especieId,
            variedadId: variedadId || null,
            categoriaId: categoriaId || null,
            calibreId: calibreId || null,
            envaseId: envaseId || null,
            kilosId: kilosId || null,
            paisId: paisId || null,
            disponible,
            fechaVigencia: fechaVigenciaEditada || null,
        };
        setGuardando(true);
        try {
            await alGuardar(publicacion.publicacionOperadorId, cambios, fotoNueva);
            setGuardada({ origen: recibida, datos: {
                ...publicacion, ...cambios, version: cambios.version + 1, foto,
                estadoFoto: fotoNueva || (foto === null && publicacion.foto !== null) ? null : publicacion.estadoFoto,
                especie: especieSeleccionada?.nombre ?? publicacion.especie,
                variedad: variedadSeleccionada?.nombre ?? "",
                envase: envases.find((opcion) => opcion.id === envaseId)?.nombre ?? "",
                kilos: kilos.find((opcion) => opcion.id === kilosId)?.nombre ?? "",
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
            notificar(error instanceof Error ? error.message : "No se pudieron guardar los cambios. Intentá de nuevo.", "error");
        } finally {
            setGuardando(false);
        }
    }
    const envaseActual = envaseId ? envases.find(p => p.id === envaseId)?.nombre || publicacion.envase : null;
    const campoPrecio = (
        <div key="precio" className={styles.campo}>
            <label className={styles.etiqueta} htmlFor={`${idBase}-precio`}>Precio en pesos</label>
            <div className={styles.controlesPrecio} data-editando={editando}>
                {editando && <button className={styles.ajustarPrecio} type="button" onClick={() => cambiarPrecio(-incrementoPrecio)} disabled={bloqueado} aria-label={`Disminuir precio en ${incrementoPrecio}`}><RemoveIcon aria-hidden="true" fontSize="inherit" /></button>}
                <OutlinedInput color="secondary" className={styles.entrada} size="small" id={`${idBase}-precio`} type="text" slotProps={{ input: { inputMode: "numeric", maxLength: MAXIMO_DIGITOS_PRECIO } }} placeholder={editando ? "Ingresar precio aquí" : "Sin precio"} value={precio} onChange={(evento) => escribirPrecio(evento.target.value)} readOnly={!editando} disabled={ocupado} />
                {editando && <button className={styles.ajustarPrecio} type="button" onClick={() => cambiarPrecio(incrementoPrecio)} disabled={bloqueado} aria-label={`Aumentar precio en ${incrementoPrecio}`}><AddIcon aria-hidden="true" fontSize="inherit" /></button>}
            </div>
            {editando && <small className={styles.ayuda}>{AYUDA_PRECIO_PUBLICACION}</small>}
        </div>
    );
    const seccionFoto = (
        <div key="foto" className={styles.seccionFoto}>
            {mostrarAvisoFoto && <AvisoVigenciaFoto estado={publicacion.estadoFoto} />}
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
                <TextField select label="Empaquetado" id={`${idBase}-envase`} value={envaseId} onChange={(evento) => { if (!bloqueado) setEnvaseId(Number(evento.target.value)); }} size="small" fullWidth disabled={bloqueado} className={styles.selectMui} slotProps={propiedadesMenuSelect}>
                    <MenuItem value={0} className={styles.opcionSelect}>{editando ? "Sin especificar" : "-"}</MenuItem>
                    {!editando && envaseId !== 0 && !envasesDisponibles.some((opcion) => opcion.id === envaseId) && <MenuItem value={envaseId} className={styles.opcionSelect}>{publicacion.envase?.trim() || "-"}</MenuItem>}
                    {envasesDisponibles.map((opcion) => <MenuItem key={opcion.id} value={opcion.id} className={styles.opcionSelect}>{opcion.nombre}</MenuItem>)}
                </TextField>
            </div>
            <div className={styles.campo}>
                <TextField select label="Kilos del empaquetado" id={`${idBase}-kilos`} value={kilosId} onChange={(evento) => { if (!bloqueado) setKilosId(Number(evento.target.value)); }} size="small" fullWidth disabled={bloqueado} className={styles.selectMui} slotProps={propiedadesMenuSelect}>
                    <MenuItem value={0} className={styles.opcionSelect}>{editando ? "Sin especificar" : "-"}</MenuItem>
                    {!editando && kilosId !== 0 && !kilos.some((opcion) => opcion.id === kilosId) && <MenuItem value={kilosId} className={styles.opcionSelect}>{publicacion.kilos?.trim() ? `${publicacion.kilos.trim()} kg` : "-"}</MenuItem>}
                    {kilos.map((opcion) => <MenuItem key={opcion.id} value={opcion.id} className={styles.opcionSelect}>{opcion.nombre} kg</MenuItem>)}
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
                Unidades{envaseActual ? ` (${envaseActual})` : ""}
            </label>
            <div className={styles.controlesPrecio} data-editando={false}>
                <OutlinedInput color="secondary" className={styles.entrada} size="small" id={`${idBase}-cantidadUnidades`} type="text" slotProps={{ input: { inputMode: "numeric", maxLength: 10 } }} placeholder={editando ? "Ingresar cantidad aquí" : "-"} value={cantidadUnidades} onChange={(evento) => escribirCantidadUnidades(evento.target.value)} readOnly={!editando} disabled={ocupado} />
            </div>
        </div>
    );
    const campoFechaVigencia = (
        <div key="fechaVigencia" className={styles.campo}>
            <label className={styles.etiqueta} htmlFor={`${idBase}-fechaVigencia`}>
                Fecha de vigencia
            </label>
            <OutlinedInput
                className={styles.entrada}
                size="small"
                id={`${idBase}-fechaVigencia`}
                type="date"
                value={editando ? fechaVigenciaEditada : (publicacion.fechaVigencia ?? "")}
                onChange={(evento) => setFechaVigencia(evento.target.value)}
                readOnly={!editando}
                disabled={ocupado}
            />
        </div>
    );
    const campoComentario = (
        <CampoComentario
            key="comentario"
            id={`${idBase}-comentario`}
            valor={comentario}
            alCambiar={setComentario}
            editando={editando}
            deshabilitado={ocupado}
            clases={{ campo: styles.campo, etiqueta: styles.etiqueta, entrada: styles.entrada, ayuda: styles.ayuda }}
        />
    );
    return (
        <>
            <div className={styles.encabezado}>
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
            <form className={styles.formulario} onSubmit={solicitarGuardado} aria-busy={ocupado}>
                <div className={styles.cuerpo}>
                    {[campoPrecio, campoUnidades, campoFechaVigencia, campoComentario, seccionFoto, accionesPublicacion, datosProducto]}
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

export default function DrawerEditarPublicacion({ abierto, alCerrar, publicacion, alGuardar, especies, variedades, categorias, calibres, envases, kilos, paises, incrementoPrecio = 10, modoInicial = "edicion", puedeModificar = true, puedeEliminar = true, alEliminar, alCompartir, compartiendo = false, eliminando = false, actualizando = false, errorConsulta, mostrarAvisoFoto = false, children }: DrawerEditarPublicacionProps) {
    const esWeb = useMediaQuery("(min-width: 768px)");
    const [guardando, setGuardando] = useState(false);
    function cerrar() {
        if (!guardando && !eliminando && !actualizando) alCerrar();
    }
    return (
        <>
        <AvisoErrorToast mensaje={abierto && publicacion ? errorConsulta : null} />
        <DrawerDeslizable anchor={esWeb ? "right" : "bottom"} open={abierto && publicacion !== null} onClose={cerrar} arrastreDeshabilitado={guardando || eliminando || actualizando} slotProps={{ paper: { className: styles.panel, role: "dialog", "aria-modal": true, "aria-labelledby": publicacion ? `editar-publicacion-${publicacion.publicacionOperadorId}-titulo` : undefined } }}>
            {publicacion && (
                <FormularioEdicion key={`${publicacion.publicacionOperadorId}-${abierto}-${modoInicial}`} publicacion={publicacion} alCerrar={alCerrar} alGuardar={alGuardar} especies={especies} variedades={variedades} categorias={categorias} calibres={calibres} envases={envases} kilos={kilos} paises={paises} incrementoPrecio={incrementoPrecio} modoInicial={modoInicial} puedeModificar={puedeModificar} puedeEliminar={puedeEliminar} alEliminar={alEliminar} alCompartir={alCompartir} compartiendo={compartiendo} eliminando={eliminando} actualizando={actualizando} mostrarAvisoFoto={mostrarAvisoFoto} esWeb={esWeb} guardando={guardando} setGuardando={setGuardando} />
            )}
            {publicacion && children}
        </DrawerDeslizable>
        </>
    );
}
