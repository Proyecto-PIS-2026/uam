"use client";

import { useState, type ReactNode } from "react";
import AvisoErrorToast from "@/compartido/componentes/AvisoErrorToast";
import DrawerDeslizable from "@/compartido/componentes/DrawerDeslizable";
import SelectorFecha from "@/compartido/componentes/SelectorFecha";
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
import HideImageOutlinedIcon from "@mui/icons-material/HideImageOutlined";
import PhotoLibraryOutlinedIcon from "@mui/icons-material/PhotoLibraryOutlined";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import { compararEspeciesPorPrioridad } from "@/compartido/prioridad-especies";
import ImagenPublicacion from "../../componentes/ImagenPublicacion";
import FotoPublicacionAmpliada from "../../componentes/FotoPublicacionAmpliada";
import estilosFoto from "../../componentes/FotoPublicacionAmpliada.module.css";
import { AvisoVigenciaFoto } from "../../componentes/AvisoVigenciaFoto";
import { AvisoVigenciaPublicacion } from "../../componentes/AvisoVigenciaPublicacion";
import type { CambiosPublicacionOperador, PublicacionParaEditar } from "../tipos";
import type { OpcionCategoria, OpcionEdicion, OpcionVariedad } from "../../catalogos/tipos";
import { AYUDA_PRECIO_PUBLICACION, MAXIMO_DIGITOS_PRECIO } from "../../precio-publicacion";
import { useEdicionPublicacion } from "../hooks/useEdicionPublicacion";
import styles from "../../componentes/formulario-publicacion/formulario-publicacion.module.css";
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

const propiedadesMenuSelect = { select: { MenuProps: { slotProps: { paper: { sx: { maxHeight: "min(20rem, 50dvh)", overflowY: "auto" } } } } } } as const;

function FormularioEdicion({ alCerrar, alGuardar, publicacion: recibida, especies, variedades, categorias, calibres, envases, kilos, paises, incrementoPrecio = 10, modoInicial = "edicion", puedeModificar = true, puedeEliminar = true, alEliminar, alCompartir, compartiendo = false, eliminando = false, actualizando = false, mostrarAvisoFoto = false, esWeb, guardando, setGuardando }: Omit<DrawerEditarPublicacionProps, "abierto"> & { publicacion: PublicacionParaEditar; esWeb: boolean; guardando: boolean; setGuardando: (valor: boolean) => void }) {
    const {
        publicacion, editando, setEditando, fotoAmpliada, setFotoAmpliada,
        precio, cantidadUnidades, comentario, fotoVisible, nombreFoto,
        variedadSeleccionada, especieId, variedadId, categoriaId, calibreId,
        envaseId, kilosId, paisId, disponible, inputFotoRef,
        inputGaleriaRef, idBase, ocupado, bloqueado, variedadesDisponibles,
        envasesDisponibles, categoriasDisponibles, paisesOrdenados, fechaFormateada, fechaVigenciaEditada,
        setFechaVigencia, seleccionarFoto, borrarFoto, escribirPrecio, escribirCantidadUnidades,
        cambiarPrecio, cambiarEspecie, cambiarVariedad, prepararEdicion, cancelarEdicion,
        solicitarGuardado, setCategoriaId, setCalibreId, setEnvaseId, setKilosId,
        setPaisId, setDisponible, setComentario,
    } = useEdicionPublicacion({ alCerrar, alGuardar, publicacion: recibida, especies, variedades, categorias, calibres, envases, kilos, paises, modoInicial, puedeModificar, eliminando, actualizando, guardando, setGuardando });
    const reemplazoFoto = <div className={styles.sinFoto}><HideImageOutlinedIcon aria-hidden="true" /><span>Sin foto disponible</span></div>;
    const envaseActual = envaseId ? envases.find(p => p.id === envaseId)?.nombre || publicacion.envase : null;
    const campoPrecio = (
        <div key="precio" className={styles.campo}>
            <label className={styles.etiqueta} htmlFor={`${idBase}-precio`}>Precio en pesos</label>
            <div className={styles.controlesPrecio} data-editando={editando}>
                {editando && <button className={styles.ajustarPrecio} type="button" onClick={() => cambiarPrecio(-incrementoPrecio)} disabled={bloqueado} aria-label={`Disminuir precio en ${incrementoPrecio}`}><RemoveIcon aria-hidden="true" fontSize="inherit" /></button>}
                <OutlinedInput color="secondary" className={styles.entrada} size="small" id={`${idBase}-precio`} type="text" slotProps={{ input: { inputMode: "numeric", maxLength: MAXIMO_DIGITOS_PRECIO } }} placeholder={editando ? "Ingresar precio aquí" : "Sin precio"} value={precio} onChange={(evento) => escribirPrecio(evento.target.value)} readOnly={!editando} disabled={bloqueado} />
                {editando && <button className={styles.ajustarPrecio} type="button" onClick={() => cambiarPrecio(incrementoPrecio)} disabled={bloqueado} aria-label={`Aumentar precio en ${incrementoPrecio}`}><AddIcon aria-hidden="true" fontSize="inherit" /></button>}
            </div>
            {editando && <small className={styles.ayuda}>{AYUDA_PRECIO_PUBLICACION}</small>}
        </div>
    );
    const seccionFoto = (
        <div key="foto" className={styles.seccionFoto}>
            {mostrarAvisoFoto && <AvisoVigenciaFoto estado={publicacion.estadoFoto} />}
            <div className={styles.marcoFoto}>
                <ImagenPublicacion className={styles.imagenFoto} src={fotoVisible} alt={`Foto de ${nombreFoto} ${variedadSeleccionada?.nombre ?? publicacion.variedad}`} fill sizes="(min-width: 768px) 480px, 100vw" unoptimized reemplazo={reemplazoFoto} />
                {!editando && fotoVisible?.trim() && <button type="button" className={estilosFoto.ampliarFoto} aria-label={`Ampliar foto de ${nombreFoto}`} onClick={() => setFotoAmpliada(true)} />}
                {editando && (
                    <>
                        {fotoVisible && <button className={`${styles.botonFoto} ${styles.borrarFoto}`} type="button" onClick={borrarFoto} disabled={bloqueado}><DeleteOutlinedIcon fontSize="small" /> Borrar foto</button>}
                        <button className={styles.botonFoto} type="button" onClick={() => inputFotoRef.current?.click()} disabled={bloqueado}>
                            <PhotoCameraOutlinedIcon fontSize="small" /> {esWeb ? "Editar foto" : "Cámara"}
                        </button>
                        {!esWeb && <button className={`${styles.botonFoto} ${styles.botonGaleria}`} type="button" onClick={() => inputGaleriaRef.current?.click()} disabled={bloqueado}><PhotoLibraryOutlinedIcon fontSize="small" aria-hidden="true" /> Galería</button>}
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
                <OutlinedInput color="secondary" className={styles.entrada} size="small" id={`${idBase}-cantidadUnidades`} type="text" slotProps={{ input: { inputMode: "numeric", maxLength: 10 } }} placeholder={editando ? "Ingresar cantidad aquí" : "-"} value={cantidadUnidades} onChange={(evento) => escribirCantidadUnidades(evento.target.value)} readOnly={!editando} disabled={bloqueado} />
            </div>
        </div>
    );
    const campoFechaVigencia = (
        <div key="fechaVigencia" className={styles.campo}>
            <label className={styles.etiqueta} htmlFor={`${idBase}-fechaVigencia`}>
                Fecha de vigencia
            </label>
            <SelectorFecha
                className={styles.entrada}
                id={`${idBase}-fechaVigencia`}
                labelAccesible="Fecha de vigencia"
                value={editando ? fechaVigenciaEditada : (publicacion.fechaVigencia ?? "")}
                onChange={setFechaVigencia}
                readOnly={!editando}
                disabled={bloqueado}
            />
            <AvisoVigenciaPublicacion estado={publicacion.estadoVigencia} fechaVigencia={publicacion.fechaVigencia} />
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
                <div className={styles.pie} data-acciones-modal>
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
            <FotoPublicacionAmpliada abierta={!editando && fotoAmpliada && Boolean(fotoVisible?.trim())} alCerrar={() => setFotoAmpliada(false)} src={fotoVisible} nombre={nombreFoto} reemplazo={reemplazoFoto} />
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
